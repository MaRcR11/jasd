import { S } from '../state.js';
import { escHtml, formatTs, formatBytes } from '../lib/formatters.js';
import { syncOverlayToView, refreshOverlay } from '../components/ui.js';

const STATUS_MAP = {
  queued: { label: 'Queued', cls: 'queued', color: 'var(--text3)' },
  downloading: {
    label: 'Downloading',
    cls: 'downloading',
    color: 'linear-gradient(90deg,var(--accent),#7c5cf6)',
  },
  done: { label: 'Done', cls: 'done', color: 'var(--success)' },
  error: { label: 'Error', cls: 'error', color: 'var(--danger)' },
  cancelled: { label: 'Cancelled', cls: 'cancelled', color: 'var(--text3)' },
};

export function updateBadge() {
  const n = S.queue.filter(
    (q) => q.opts && (q.status === 'downloading' || q.status === 'queued')
  ).length;
  const badge = document.getElementById('queueBadge');
  badge.style.display = n > 0 ? '' : 'none';
  badge.textContent = n;
}

export function updateEmptyState() {
  document.getElementById('emptyQueue').style.display = S.queue.length === 0 ? '' : 'none';
}

export function primaryActiveId() {
  return [...S.activeDownloadIds][0] ?? null;
}

export function processNextInQueue() {
  const max = Number(S.settings.maxConcurrent) || 1;

  while (S.activeDownloadIds.size < max) {
    const next = S.queue.find((q) => q.status === 'queued' && q.opts);
    if (!next) break;

    next.status = 'downloading';
    S.activeDownloadIds.add(next.id);
    const el = document.getElementById(`qi-${next.id}`);
    if (el) updateQueueEl(el, next);

    window.api.startDownload(next.opts).then((result) => {
      if (result?.error && !S.cancelledIds.has(next.id)) {
        console.warn(`[queue] startDownload returned error for ${next.id}:`, result.error);
      }
    });
  }

  updateBadge();
  syncOverlayToView();
  refreshOverlay();
}

export function enqueueDownload(qItem) {
  S.queue.unshift(qItem);
  const list = document.getElementById('queueList');
  const el = buildQueueEl(qItem);
  list.insertBefore(el, list.firstChild);
  updateEmptyState();
  persistQueue();
  updateBadge();
  processNextInQueue();
}

export function onProgress(data) {
  const { downloadId, percent, speed, eta } = data;
  const item = S.queue.find((q) => q.id === downloadId);
  if (!item || item.status !== 'downloading') return;
  patchQueue(downloadId, { percent, speed, eta });
  if (downloadId === primaryActiveId()) {
    document.getElementById('dlProgBar').style.width = `${percent}%`;
    document.getElementById('dlOvPct').textContent = `${Math.round(percent)}%`;
    document.getElementById('dlOvSpeed').textContent = speed || '';
    document.getElementById('dlOvEta').textContent = eta ? `ETA ${eta}` : '';
  }
}

export function onComplete(data) {
  const { downloadId, outputDir, outputFile, outputFileHash, outputFileSize } = data;
  S.activeDownloadIds.delete(downloadId);
  const ts = new Date().toISOString();
  patchQueue(downloadId, {
    status: 'done',
    percent: 100,
    outputDir,
    outputFile,
    outputFileHash,
    outputFileSize: outputFileSize ?? null,
    completedAt: ts,
  });
  persistQueue();
  updateBadge();
  processNextInQueue();
  refreshOverlay();
  syncOverlayToView();
}

export function onDlError(data) {
  const { downloadId } = data;
  if (S.cancelledIds.has(downloadId)) return;
  S.activeDownloadIds.delete(downloadId);
  patchQueue(downloadId, { status: 'error', percent: 0 });
  persistQueue();
  updateBadge();
  processNextInQueue();
  refreshOverlay();
  syncOverlayToView();
}

export function onCancelled(data) {
  const { downloadId } = data;
  S.cancelledIds.add(downloadId);
  S.activeDownloadIds.delete(downloadId);
  patchQueue(downloadId, { status: 'cancelled', percent: 0 });
  persistQueue();
  updateBadge();
  processNextInQueue();
  refreshOverlay();
  syncOverlayToView();
}

export function cancelSpecific(id) {
  const item = S.queue.find((q) => q.id === id);
  if (item?.isPlaylistGroup) {
    const children = S.queue.filter((q) => q.parentId === id);
    children.forEach((c) => {
      if (S.activeDownloadIds.has(c.id)) {
        window.api.cancelDownload(c.id);
      } else if (c.status === 'queued') {
        c.status = 'cancelled';
        c.percent = 0;
        updateQueueEl(document.getElementById(`qi-${c.id}`), c);
      }
    });
    updateGroupFromChildren(id);
    processNextInQueue();
    persistQueue();
    return;
  }
  if (!S.activeDownloadIds.has(id)) return;
  window.api.cancelDownload(id);
}

export function removeFromQueue(id) {
  const item = S.queue.find((q) => q.id === id);
  if (item?.isPlaylistGroup) {
    removePlaylistGroup(id);
    return;
  }
  if (S.activeDownloadIds.has(id)) window.api.cancelDownload(id);
  const parentId = item?.parentId;
  S.queue = S.queue.filter((q) => q.id !== id);
  S.activeDownloadIds.delete(id);
  const el = document.getElementById(`qi-${id}`);
  if (el) el.remove();
  if (parentId) {
    updateGroupFromChildren(parentId);
  } else {
    updateEmptyState();
    updateBadge();
    persistQueue();
  }
  refreshOverlay();
  syncOverlayToView();
}

function removePlaylistGroup(id) {
  const children = S.queue.filter((q) => q.parentId === id);
  children.forEach((c) => {
    if (S.activeDownloadIds.has(c.id)) window.api.cancelDownload(c.id);
    S.activeDownloadIds.delete(c.id);
  });
  const allIds = new Set([id, ...children.map((c) => c.id)]);
  S.queue = S.queue.filter((q) => !allIds.has(q.id));
  const el = document.getElementById(`qi-${id}`);
  if (el) el.remove();
  updateEmptyState();
  updateBadge();
  persistQueue();
  refreshOverlay();
  syncOverlayToView();
}

export function cancelActive() {
  const id = primaryActiveId();
  if (!id) return;
  const item = S.queue.find((q) => q.id === id);
  const targetId = item?.parentId || id;
  cancelSpecific(targetId);
}

export async function persistQueue() {
  const toSave = S.queue.map((q) => {
    const copy = { ...q };
    delete copy.opts;
    if (copy.status === 'downloading') {
      copy.status = 'cancelled';
      copy.percent = 0;
    }
    if (copy.status === 'queued') {
      copy.status = 'cancelled';
      copy.percent = 0;
    }
    return copy;
  });
  await window.api.saveQueue(toSave);
}

export function renderQueue() {
  const list = document.getElementById('queueList');
  S.queue.forEach((item) => {
    if (item.isPlaylistGroup) {
      if (!document.getElementById(`qi-${item.id}`)) {
        const kids = S.queue.filter((q) => q.parentId === item.id);
        list.appendChild(buildGroupEl(item, kids));
      }
      updateGroupEl(document.getElementById(`qi-${item.id}`), item);
    } else if (item.parentId) {
      if (!document.getElementById(`qi-${item.id}`)) {
        const parentEl = document.getElementById(`qi-${item.parentId}`);
        if (parentEl) {
          const childrenDiv = parentEl.querySelector('.qi-children');
          if (childrenDiv) childrenDiv.appendChild(buildQueueEl(item, true));
        }
      }
      updateQueueEl(document.getElementById(`qi-${item.id}`), item);
    } else {
      if (!document.getElementById(`qi-${item.id}`)) {
        list.appendChild(buildQueueEl(item));
      }
      updateQueueEl(document.getElementById(`qi-${item.id}`), item);
    }
  });
  updateEmptyState();
  updateBadge();
}

export function buildQueueEl(item, isChild = false) {
  const el = document.createElement('div');
  el.className = isChild ? 'qi-child' : 'queue-item';
  el.id = `qi-${item.id}`;
  el.innerHTML = `
    <img class="qi-thumb" src="${escHtml(item.thumb || '')}" alt=""/>
    <div class="qi-body">
      <div class="qi-title">${escHtml(item.title)}</div>
      <div class="qi-row">
        <div class="qi-pw"><div class="qi-p" style="width:0%"></div></div>
        <span class="qi-badge">…</span>
        <div class="qi-btns">
          <button class="qi-cancel" style="display:none" title="Cancel download">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
            </svg>
          </button>
          <button class="qi-retry" style="display:none" title="Retry download">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 8a6 6 0 1 0 1-3.3"/>
              <polyline points="2,2 2,5 5,5"/>
            </svg>
          </button>
          <button class="qi-play" style="display:none" title="Play file">
            <svg viewBox="0 0 16 16" fill="currentColor">
              <polygon points="4,2 13,8 4,14"/>
            </svg>
          </button>
          <button class="qi-action" style="display:none">Open</button>
        </div>
      </div>
      <div class="qi-status"></div>
    </div>
  `;
  return el;
}

export function updateQueueEl(el, item) {
  if (!el) return;
  const p = el.querySelector('.qi-p');
  const badge = el.querySelector('.qi-badge');
  const stat = el.querySelector('.qi-status');
  const act = el.querySelector('.qi-action');
  const cancelBtn = el.querySelector('.qi-cancel');
  const retryBtn = el.querySelector('.qi-retry');
  const playBtn = el.querySelector('.qi-play');

  const s = STATUS_MAP[item.status] || STATUS_MAP.queued;
  p.style.width = `${item.percent || 0}%`;
  p.style.background = s.color;
  badge.textContent = s.label;
  badge.className = `qi-badge ${s.cls}`;

  if (item.status === 'downloading') {
    const pct = `${Math.round(item.percent || 0)}%`;
    const parts = [pct, item.speed, item.eta ? `ETA ${item.eta}` : ''].filter(Boolean);
    stat.textContent = parts.join(' · ');
  } else if (item.status === 'done' && item.completedAt) {
    const parts = [formatTs(item.completedAt)];
    if (item.fileType) parts.push(item.fileType.toUpperCase());
    if (item.outputFileSize != null) parts.push(formatBytes(item.outputFileSize));
    stat.textContent = parts.join(' · ');
  } else if (item.status === 'queued') {
    stat.textContent = 'Waiting…';
  } else if (item.status === 'error') {
    stat.textContent = 'Download failed';
  } else {
    stat.textContent = '';
  }

  if (cancelBtn) {
    if (item.status === 'downloading') {
      cancelBtn.style.display = '';
      cancelBtn.title = 'Cancel download';
      cancelBtn.onclick = () => cancelSpecific(item.id);
    } else if (item.status === 'queued') {
      cancelBtn.style.display = '';
      cancelBtn.title = 'Remove from queue';
      cancelBtn.onclick = () => removeFromQueue(item.id);
    } else {
      cancelBtn.style.display = 'none';
      cancelBtn.onclick = null;
    }
  }

  if (playBtn) {
    if (item.status === 'done' && item.outputFile) {
      playBtn.style.display = '';
      playBtn.onclick = async () => {
        const err = await window.api.openFile(item.outputFile, item.outputFileHash);
        if (err) {
          const stat = el.querySelector('.qi-status');
          if (stat) {
            stat.textContent = 'File not found — it may have been moved or deleted.';
            stat.style.color = 'var(--danger)';
            setTimeout(() => {
              stat.style.color = '';
              stat.textContent = item.completedAt ? formatTs(item.completedAt) : '';
            }, 4000);
          }
          console.warn(`[play] openFile failed: ${err}`);
        }
      };
    } else {
      playBtn.style.display = 'none';
      playBtn.onclick = null;
    }
  }

  if (item.status === 'done' && item.outputDir) {
    act.style.display = '';
    act.textContent = 'Open';
    act.onclick = () => window.api.openFolder(item.outputDir);
  } else if (item.status === 'done' || item.status === 'cancelled' || item.status === 'error') {
    act.style.display = '';
    act.textContent = 'Remove';
    act.onclick = () => removeFromQueue(item.id);
  } else {
    act.style.display = 'none';
  }

  if (retryBtn) {
    if ((item.status === 'error' || item.status === 'cancelled') && item.opts) {
      retryBtn.style.display = '';
      retryBtn.onclick = () => {
        const oldId = item.id;
        const newId = Date.now().toString(36) + Math.random().toString(36).slice(2);
        S.cancelledIds.delete(oldId);
        item.id = newId;
        item.opts = { ...item.opts, downloadId: newId };
        item.status = 'queued';
        item.percent = 0;
        item.speed = null;
        item.eta = null;
        const el = document.getElementById(`qi-${oldId}`);
        if (el) el.id = `qi-${newId}`;
        updateQueueEl(el, item);
        persistQueue();
        processNextInQueue();
      };
    } else {
      retryBtn.style.display = 'none';
      retryBtn.onclick = null;
    }
  }
}

export function patchQueue(id, patch) {
  const item = S.queue.find((q) => q.id === id);
  if (item) Object.assign(item, patch);
  updateQueueEl(document.getElementById(`qi-${id}`), item);
  if (item?.parentId) updateGroupFromChildren(item.parentId);
}

function updateGroupFromChildren(groupId) {
  const group = S.queue.find((q) => q.id === groupId);
  if (!group) return;
  const children = S.queue.filter((q) => q.parentId === groupId);

  if (!children.length) {
    S.queue = S.queue.filter((q) => q.id !== groupId);
    const el = document.getElementById(`qi-${groupId}`);
    if (el) el.remove();
    updateEmptyState();
    updateBadge();
    persistQueue();
    return;
  }

  const total = children.length;
  const doneCount = children.filter((c) => c.status === 'done').length;
  const downloading = children.some((c) => c.status === 'downloading');
  const queued = children.some((c) => c.status === 'queued');
  group.doneCount = doneCount;
  group.totalCount = total;
  group.percent = children.reduce((s, c) => s + (c.percent || 0), 0) / total;
  if (doneCount === total) {
    group.status = 'done';
    const timestamps = children.map((c) => c.completedAt).filter(Boolean);
    group.completedAt = timestamps.length ? timestamps.sort().at(-1) : new Date().toISOString();
    const types = [...new Set(children.map((c) => c.fileType).filter(Boolean))];
    group.fileType = types.join('/');
    const sizes = children.map((c) => c.outputFileSize).filter((v) => v != null);
    group.outputFileSize = sizes.length ? sizes.reduce((a, b) => a + b, 0) : null;
  } else if (downloading) group.status = 'downloading';
  else if (queued) group.status = 'queued';
  else if (children.some((c) => c.status === 'error')) group.status = 'error';
  else group.status = 'cancelled';
  const el = document.getElementById(`qi-${groupId}`);
  updateGroupEl(el, group);
  updateBadge();
}

function buildGroupEl(group, children) {
  const outer = document.createElement('div');
  outer.className = 'qi-group';
  outer.id = `qi-${group.id}`;

  const header = document.createElement('div');
  header.className = 'qi-group-header';
  header.innerHTML = `
    <img class="qi-thumb" src="${escHtml(group.thumb || '')}" alt=""/>
    <div class="qi-body">
      <div class="qi-title">${escHtml(group.title)}</div>
      <div class="qi-row">
        <div class="qi-pw"><div class="qi-p" style="width:0%"></div></div>
        <span class="qi-badge queued">Queued</span>
        <div class="qi-btns">
          <button class="qi-cancel" title="Cancel all downloads">
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/>
            </svg>
          </button>
          <button class="qi-retry" style="display:none" title="Retry all">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M2 8a6 6 0 1 0 1-3.3"/>
              <polyline points="2,2 2,5 5,5"/>
            </svg>
          </button>
          <button class="qi-action" style="display:none"></button>
          <button class="qi-expand" title="Show items" ${children.length === 0 ? 'style="display:none"' : ''}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="qi-status">0 / ${children.length} done</div>
    </div>
  `;
  outer.appendChild(header);

  const childrenDiv = document.createElement('div');
  childrenDiv.className = 'qi-children';
  children.forEach((child) => childrenDiv.appendChild(buildQueueEl(child, true)));
  outer.appendChild(childrenDiv);

  const cancelBtn = header.querySelector('.qi-cancel');
  cancelBtn.addEventListener('click', () => cancelSpecific(group.id));

  header.querySelector('.qi-retry').addEventListener('click', () => retryGroup(group.id));

  header.querySelector('.qi-expand').addEventListener('click', () => {
    outer.classList.toggle('open');
    childrenDiv.classList.toggle('expanded');
  });

  return outer;
}

function updateGroupEl(el, group) {
  if (!el) return;
  const p = el.querySelector(':scope > .qi-group-header .qi-p');
  const badge = el.querySelector(':scope > .qi-group-header .qi-badge');
  const stat = el.querySelector(':scope > .qi-group-header .qi-status');
  const act = el.querySelector(':scope > .qi-group-header .qi-action');
  if (!p || !badge || !stat) return;
  const s = STATUS_MAP[group.status] || STATUS_MAP.queued;
  p.style.width = `${group.percent || 0}%`;
  p.style.background = s.color;
  badge.textContent = s.label;
  badge.className = `qi-badge ${s.cls}`;
  const done = group.doneCount ?? 0;
  const total = group.totalCount ?? 0;
  if (group.status === 'done') {
    const parts = [];
    if (group.completedAt) parts.push(formatTs(group.completedAt));
    if (group.fileType) parts.push(group.fileType.toUpperCase());
    if (group.outputFileSize != null) parts.push(formatBytes(group.outputFileSize));
    parts.push(`${total}/${total}`);
    stat.textContent = parts.join(' · ');
  } else {
    stat.textContent = `${done}/${total}`;
  }
  const expandBtn = el.querySelector(':scope > .qi-group-header .qi-expand');
  if (expandBtn) {
    const childCount = S.queue.filter((q) => q.parentId === group.id).length;
    expandBtn.style.display = childCount > 0 ? '' : 'none';
  }
  const retryBtn = el.querySelector(':scope > .qi-group-header .qi-retry');
  if (retryBtn) {
    if (group.status === 'cancelled' || group.status === 'error') {
      retryBtn.style.display = '';
      retryBtn.onclick = () => retryGroup(group.id);
    } else {
      retryBtn.style.display = 'none';
      retryBtn.onclick = null;
    }
  }
  const cancelBtn = el.querySelector(':scope > .qi-group-header .qi-cancel');
  if (cancelBtn) {
    if (group.status === 'queued' || group.status === 'downloading') {
      cancelBtn.style.display = '';
      cancelBtn.onclick = () => cancelSpecific(group.id);
    } else {
      cancelBtn.style.display = 'none';
      cancelBtn.onclick = null;
    }
  }
  if (act) {
    if (['done', 'cancelled', 'error'].includes(group.status)) {
      act.style.display = '';
      act.textContent = 'Remove';
      act.onclick = () => removePlaylistGroup(group.id);
    } else {
      act.style.display = 'none';
      act.onclick = null;
    }
  }
}

function retryGroup(groupId) {
  const children = S.queue.filter((q) => q.parentId === groupId);
  const retryable = children.filter(
    (c) => (c.status === 'cancelled' || c.status === 'error') && c.opts
  );
  if (!retryable.length) return;

  retryable.forEach((child) => {
    const oldId = child.id;
    const newId = `${oldId}_r${Date.now().toString(36)}`;
    S.cancelledIds.delete(oldId);
    child.id = newId;
    child.opts = { ...child.opts, downloadId: newId };
    child.status = 'queued';
    child.percent = 0;
    child.speed = null;
    child.eta = null;
    const el = document.getElementById(`qi-${oldId}`);
    if (el) {
      el.id = `qi-${newId}`;
      updateQueueEl(el, child);
    }
  });

  updateGroupFromChildren(groupId);
  persistQueue();
  processNextInQueue();
}

export function enqueuePlaylistGroup(group, children) {
  S.queue.unshift(group);
  children.forEach((c, i) => S.queue.splice(1 + i, 0, c));
  const list = document.getElementById('queueList');
  const el = buildGroupEl(group, children);
  list.insertBefore(el, list.firstChild);
  updateEmptyState();
  persistQueue();
  updateBadge();
  processNextInQueue();
}
