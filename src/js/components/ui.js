import { S } from '../state.js';

export function showToast(msg, type = 'info', openDir = null) {
  const prev = document.getElementById('_toast');
  if (prev) prev.remove();

  const colors = { info: 'var(--accent)', success: 'var(--success)', error: 'var(--danger)' };
  const el = document.createElement('div');
  el.id = '_toast';
  el.style.cssText = `
    position:fixed;bottom:22px;left:0;right:0;margin:0 auto;
    width:fit-content;max-width:460px;
    background:var(--bg2);border:1px solid var(--border);
    border-left:3px solid ${colors[type] || colors.info};
    color:var(--text);padding:10px 16px;border-radius:8px;font-size:13px;
    box-shadow:0 8px 28px rgba(0,0,0,.55);z-index:500;
    display:flex;align-items:center;gap:12px;
    animation:toastIn .22s ease;
    white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
  `;
  el.textContent = msg;

  if (openDir) {
    const btn = document.createElement('button');
    btn.textContent = 'Open Folder';
    btn.style.cssText = 'color:var(--accent);font-size:12px;font-weight:600;flex-shrink:0';
    btn.onclick = () => window.api.openFolder(openDir);
    el.appendChild(btn);
  }

  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 320);
  }, 5000);
}

export function refreshOverlay() {
  const overlay = document.getElementById('dlOverlay');
  const hasActive = S.activeDownloadIds.size > 0;
  const visible = hasActive && S.currentView !== 'queue';
  overlay.style.display = visible ? '' : 'none';

  if (visible) {
    const item = [...S.activeDownloadIds]
      .map((id) => S.queue.find((q) => q.id === id))
      .filter(Boolean)
      .sort((a, b) => (b.percent || 0) - (a.percent || 0))[0];
    if (item) {
      document.getElementById('dlOvTitle').textContent = item.title || 'Downloading…';
      document.getElementById('dlProgBar').style.width = `${item.percent || 0}%`;
      document.getElementById('dlOvPct').textContent = `${Math.round(item.percent || 0)}%`;
      document.getElementById('dlOvSpeed').textContent = item.speed || '';
      document.getElementById('dlOvEta').textContent = item.eta ? `ETA ${item.eta}` : '';
    }
  }
}

export function syncOverlayToView() {
  refreshOverlay();
}

export function setView(name) {
  S.currentView = name;
  document
    .querySelectorAll('.nav-item')
    .forEach((b) => b.classList.toggle('active', b.dataset.view === name));
  document
    .querySelectorAll('.view')
    .forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  syncOverlayToView();
}

export function showOverwriteModal(filename, i18nT) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('overwriteModal');
    document.getElementById('overwriteFilename').textContent = filename;
    overlay.style.display = 'flex';

    const cleanup = (choice) => {
      overlay.style.display = 'none';
      resolve(choice);
    };

    document.getElementById('btnOwCancel').onclick = () => cleanup('cancel');
    document.getElementById('btnOwSkip').onclick = () => cleanup('skip');
    document.getElementById('btnOwReplace').onclick = () => cleanup('overwrite');
  });
}
