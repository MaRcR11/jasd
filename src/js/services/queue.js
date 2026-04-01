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
  const n = S.queue.filter((q) => q.status === 'downloading' || q.status === 'queued').length;
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
    const next = S.queue.find((q) => q.status === 'queued');
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
  S.queue.unshift(qItem); // newest at top
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
  if (!S.activeDownloadIds.has(id)) return;
  window.api.cancelDownload(id);
}

export function removeFromQueue(id) {
  if (S.activeDownloadIds.has(id)) {
    window.api.cancelDownload(id);
  }
  S.queue = S.queue.filter((q) => q.id !== id);
  S.activeDownloadIds.delete(id);
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
  if (id) cancelSpecific(id);
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
    if (!document.getElementById(`qi-${item.id}`)) {
      list.appendChild(buildQueueEl(item));
    }
    updateQueueEl(document.getElementById(`qi-${item.id}`), item);
  });
  updateEmptyState();
  updateBadge();
}

export function buildQueueEl(item) {
  const el = document.createElement('div');
  el.className = 'queue-item';
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
}
