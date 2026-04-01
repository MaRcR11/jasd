import { S } from './state.js';
import { t } from './i18n.js';
import { formatDuration, formatCount, formatDate, escHtml } from './formatters.js';
import { showToast, showOverwriteModal, refreshOverlay, syncOverlayToView } from './ui.js';
import {
  enqueueDownload,
  cancelActive,
  cancelSpecific,
  onProgress,
  onComplete,
  onDlError,
  onCancelled,
} from './queue.js';

export async function fetchInfo() {
  const url = document.getElementById('urlInput').value.trim();
  if (!url) return;

  document.getElementById('infoCard').style.display = 'none';
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
  populateInfo(info);
  populateFormats(info.formats || []);
  document.getElementById('infoCard').style.display = '';
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

  const opts = {
    url: S.videoInfo.webpage_url || document.getElementById('urlInput').value.trim(),
    outputDir,
    formatId: audioOnly ? null : document.getElementById('fmtSelect').value,
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
}
