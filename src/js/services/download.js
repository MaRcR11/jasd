import { S } from '../state.js';
import { t } from '../lib/i18n.js';
import { formatDuration, formatCount, formatDate, escHtml } from '../lib/formatters.js';
import { showToast, showOverwriteModal, showPlaylistOverwriteModal } from '../components/ui.js';
import {
  enqueueDownload,
  enqueuePlaylistGroup,
  cancelActive,
  onProgress,
  onComplete,
  onDlError,
  onCancelled,
} from './queue.js';

export async function fetchInfo() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;

  document.getElementById('infoCard').style.display = 'none';
  document.getElementById('playlistPanel').style.display = 'none';
  document.getElementById('optionsPanel').style.display = 'none';
  document.getElementById('loadingState').style.display = 'flex';
  document.getElementById('btnFetch').disabled = true;
  document.getElementById('btnDownload').disabled = true;

  const info = await window.api.fetchInfo(url);

  document.getElementById('loadingState').style.display = 'none';
  document.getElementById('btnFetch').disabled = false;

  if (info.error) {
    showToast(info.error, 'error');
    return;
  }

  S.videoInfo = info;

  if (info.isPlaylist) {
    populatePlaylist(info);
    document.getElementById('playlistPanel').style.display = '';
    document.getElementById('infoCard').style.display = 'none';
    document.getElementById('playlistItemsRow').style.display = '';
    document.getElementById('customFilenameRow').style.display = 'none';
    document.getElementById('customFilename').value = '';
  } else {
    populateInfo(info);
    populateFormats(info.formats || []);
    document.getElementById('infoCard').style.display = '';
    document.getElementById('playlistPanel').style.display = 'none';
    document.getElementById('playlistItemsRow').style.display = 'none';
    document.getElementById('playlistItems').value = '';
    document.getElementById('customFilenameRow').style.display = '';
  }

  document.getElementById('optionsPanel').style.display = '';
  document.getElementById('btnDownload').disabled = false;
}

function populateInfo(info) {
  document.getElementById('infoThumb').src = info.thumbnail || '';
  document.getElementById('infoTitle').textContent = info.title || 'Unknown';
  document.getElementById('infoDuration').textContent = info.duration
    ? formatDuration(info.duration)
    : '';

  const subEl = document.getElementById('infoSub');
  const parts = [];
  if (info.uploader) parts.push(escHtml(info.uploader));
  if (info.view_count) parts.push(escHtml(formatCount(info.view_count) + ' views'));
  if (info.upload_date) parts.push(escHtml(formatDate(info.upload_date)));
  subEl.innerHTML = parts.join('<span class="sep"> · </span>');
}

function populatePlaylist(info) {
  document.getElementById('plThumb').src = info.thumbnail || '';
  document.getElementById('plTitle').textContent = info.title || 'Playlist';

  const parts = [];
  if (info.entryCount) parts.push(`${info.entryCount} videos`);
  if (info.uploader) parts.push(escHtml(info.uploader));
  document.getElementById('plSub').textContent = parts.join(' · ');

  const list = document.getElementById('plList');
  list.innerHTML = '';
  (info.entries || []).forEach((entry) => {
    const wrap = document.createElement('div');
    wrap.className = 'pl-entry';
    const dur = entry.duration ? formatDuration(entry.duration) : '';
    wrap.innerHTML = `
      <span class="pl-entry-num">${entry.index}</span>
      <div class="pl-entry-thumb-wrap">
        <img class="pl-entry-thumb" src="${escHtml(entry.thumbnail || '')}" alt="" />
        ${dur ? `<span class="pl-entry-dur">${escHtml(dur)}</span>` : ''}
      </div>
      <span class="pl-entry-title">${escHtml(entry.title)}</span>
    `;
    list.appendChild(wrap);
  });
}

function populateFormats(formats) {
  const sel = document.getElementById('fmtSelect');
  sel.innerHTML = `<option value="bestvideo+bestaudio/best">${t('quality_best')}</option>`;

  const videoFmts = formats.filter(
    (f) => f.vcodec && f.vcodec !== 'none' && f.resolution && f.resolution !== 'audio only'
  );
  const seen = new Map();
  videoFmts.forEach((f) => {
    if (!seen.has(f.resolution)) seen.set(f.resolution, f);
  });

  if (seen.size) {
    [...seen.entries()]
      .sort((a, b) => (parseInt(b[0]) || 0) - (parseInt(a[0]) || 0))
      .forEach(([res, f]) => {
        const opt = document.createElement('option');
        opt.value = f.format_id;
        const fps = f.fps ? ` ${f.fps}fps` : '';
        const size = f.filesize ? ` · ${(f.filesize / 1e6).toFixed(0)}MB` : '';
        opt.textContent = `${res}${fps}${size}`;
        sel.appendChild(opt);
      });
  }
}

export async function startDownload() {
  if (!S.videoInfo) return;

  const audioOnly = S.audioOnly;
  const outputDir = S.settings.outputDir || '';
  const audioFormat = document.getElementById('audioFmtSelect').value;
  const container = document.getElementById('containerSelect').value;
  const ext = audioOnly ? audioFormat : container;

  if (S.videoInfo.isPlaylist) {
    let entries = S.videoInfo.entries || [];
    if (!entries.length) return;

    const groupId = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const sharedOpts = {
      outputDir,
      formatId: audioOnly ? null : document.getElementById('fmtSelect').value,
      audioOnly,
      audioFormat,
      audioQuality: document.getElementById('audioQualSelect').value,
      videoAudioQuality: document.getElementById('videoAudioQualSelect')?.value || '0',
      preferOpus: !!S.settings.preferOpus,
      embedThumbnail: document.getElementById('chkThumb').checked,
      addMetadata: document.getElementById('chkMeta').checked,
      rateLimit: document.getElementById('rateLimit').value.trim() || null,
      container,
      forceOverwrite: !!S.settings.alwaysOverwrite,
      customFilename: null,
    };

    const playlistItemsVal = document.getElementById('playlistItems').value.trim();
    if (playlistItemsVal) {
      const allowed = new Set();
      for (const part of playlistItemsVal.split(',')) {
        const range = part.trim().split('-');
        if (range.length === 2) {
          const a = parseInt(range[0], 10);
          const b = parseInt(range[1], 10);
          if (!isNaN(a) && !isNaN(b)) for (let n = a; n <= b; n++) allowed.add(n);
        } else {
          const n = parseInt(range[0], 10);
          if (!isNaN(n)) allowed.add(n);
        }
      }
      entries = entries.filter((e) => allowed.has(e.index));
    }
    if (!entries.length) return;

    if (!S.settings.alwaysOverwrite && outputDir) {
      const existChecks = await Promise.all(
        entries.map((entry) =>
          window.api
            .checkOutputExists({ outputDir, title: entry.title, ext })
            .then((p) => (p ? entry : null))
        )
      );
      const conflicting = existChecks.filter(Boolean);
      if (conflicting.length) {
        const choice = await showPlaylistOverwriteModal(conflicting.length, entries.length);
        if (choice === 'cancel') return;
        if (choice === 'skip') {
          const conflictSet = new Set(conflicting.map((e) => e.index));
          entries = entries.filter((e) => !conflictSet.has(e.index));
          if (!entries.length) return;
        }
        if (choice === 'overwrite') sharedOpts.forceOverwrite = true;
      }
    }

    const group = {
      id: groupId,
      title: S.videoInfo.title || 'Playlist',
      thumb: S.videoInfo.thumbnail || '',
      isPlaylistGroup: true,
      status: 'queued',
      percent: 0,
      doneCount: 0,
      totalCount: entries.length,
      outputDir,
    };

    const children = entries.map((entry, i) => {
      const childId = `${groupId}_${i}`;
      return {
        id: childId,
        parentId: groupId,
        title: entry.title || `Video ${entry.index}`,
        thumb: entry.thumbnail || S.videoInfo.thumbnail || '',
        fileType: ext,
        status: 'queued',
        percent: 0,
        speed: '',
        eta: '',
        outputDir,
        opts: {
          ...sharedOpts,
          url: entry.url,
          downloadId: childId,
          playlistItems: null,
        },
      };
    });

    enqueuePlaylistGroup(group, children);
    return;
  }

  const title =
    document.getElementById('customFilename')?.value.trim() || S.videoInfo.title || 'download';

  let forceOverwrite = !!S.settings.alwaysOverwrite;

  if (!forceOverwrite && outputDir) {
    const existingPath = await window.api.checkOutputExists({ outputDir, title, ext });
    if (existingPath) {
      const choice = await showOverwriteModal(existingPath.split(/[\\/]/).pop(), t);
      if (choice === 'cancel') return;
      if (choice === 'skip') return;
      if (choice === 'overwrite') forceOverwrite = true;
    }
  }

  const downloadId = `dl_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const fmtSelectValue = audioOnly ? null : document.getElementById('fmtSelect').value;
  const selectedFmt =
    fmtSelectValue && fmtSelectValue !== 'bestvideo+bestaudio/best'
      ? (S.videoInfo?.formats || []).find((f) => f.format_id === fmtSelectValue)
      : null;
  const formatHeight = selectedFmt?.resolution
    ? parseInt((selectedFmt.resolution.match(/\d+x(\d+)/) || [])[1]) ||
      parseInt((selectedFmt.resolution.match(/^(\d+)p/) || [])[1]) ||
      null
    : null;

  const opts = {
    url: S.videoInfo.webpage_url || document.getElementById('urlInput').value.trim(),
    outputDir,
    formatId: fmtSelectValue,
    formatHeight,
    audioOnly,
    audioFormat,
    audioQuality: document.getElementById('audioQualSelect').value,
    videoAudioQuality: document.getElementById('videoAudioQualSelect')?.value || '0',
    preferOpus: !!S.settings.preferOpus,
    embedThumbnail: document.getElementById('chkThumb').checked,
    addMetadata: document.getElementById('chkMeta').checked,
    playlistItems: document.getElementById('playlistItems').value.trim() || null,
    rateLimit: document.getElementById('rateLimit').value.trim() || null,
    customFilename: document.getElementById('customFilename').value.trim() || null,
    container,
    downloadId,
    forceOverwrite,
  };

  const qItem = {
    id: downloadId,
    title: S.videoInfo.title || 'Downloading…',
    thumb: S.videoInfo.thumbnail || '',
    fileType: ext,
    status: 'queued',
    percent: 0,
    speed: '',
    eta: '',
    outputDir,
    opts,
  };

  enqueueDownload(qItem);
}

export function handleCancelActive() {
  cancelActive();
}

export function setMode(mode) {
  S.audioOnly = mode === 'audio';
  document.getElementById('modeVideo').classList.toggle('active', !S.audioOnly);
  document.getElementById('modeAudio').classList.toggle('active', S.audioOnly);
  document.getElementById('videoSection').style.display = S.audioOnly ? 'none' : '';
  document.getElementById('audioSection').style.display = S.audioOnly ? '' : 'none';
  const vaqRow = document.getElementById('videoAudioQualRow');
  if (vaqRow) vaqRow.style.display = S.audioOnly ? 'none' : '';
}

export function wireDownloadEvents() {
  window.api.onProgress(onProgress);
  window.api.onComplete((data) => {
    if (S.cancelledIds.has(data.downloadId)) return;
    const outDir = S.queue.find((q) => q.id === data.downloadId)?.outputDir;
    onComplete(data);
    showToast('Download complete!', 'success', outDir);
  });
  window.api.onError((data) => {
    if (S.cancelledIds.has(data.downloadId)) return;
    onDlError(data);
    showToast('Download failed — check Settings → Logs for details.', 'error');
  });
  window.api.onCancelled(onCancelled);

  document.getElementById('playlistItems').addEventListener('input', (e) => {
    const max = S.videoInfo?.entryCount;
    if (!max || max < 1) return;
    sanitizePlaylistItems(e.target, max);
  });
}

function sanitizePlaylistItems(input, max) {
  const orig = input.value;
  const cursor = input.selectionStart;
  const endsWithComma = orig.endsWith(',');

  const parts = orig.replace(/[^\d\-,]/g, '').split(',');

  const sanitized = parts.map((part) => {
    if (!part) return '';
    const dashIdx = part.indexOf('-');

    if (dashIdx === -1) {
      const n = parseInt(part, 10);
      if (isNaN(n) || n < 1) return '';
      return String(Math.min(n, max));
    }

    if (dashIdx === 0) return '';

    const aStr = part.slice(0, dashIdx);
    const bStr = part.slice(dashIdx + 1);
    const a = parseInt(aStr, 10);
    if (isNaN(a)) return '';
    const aVal = Math.min(Math.max(a, 1), max);

    if (!bStr) return `${aVal}-`;

    const b = parseInt(bStr, 10);
    if (isNaN(b)) return `${aVal}-`;
    const bVal = Math.min(Math.max(b, aVal), max);
    return `${aVal}-${bVal}`;
  });

  let result = sanitized.filter((p) => p !== '').join(',');
  if (endsWithComma) result += ',';

  if (result !== orig) {
    const diff = result.length - orig.length;
    input.value = result;
    const pos = Math.max(0, Math.min(cursor + diff, result.length));
    input.setSelectionRange(pos, pos);
  }
}
