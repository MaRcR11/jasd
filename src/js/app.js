import { S } from './state.js';
import { applyLang, detectSystemLang } from './lib/i18n.js';
import { applyTheme } from './lib/themes.js';
import { setView } from './components/ui.js';
import { renderQueue, updateBadge, updateEmptyState, patchQueue } from './services/queue.js';
import {
  fetchInfo,
  startDownload,
  handleCancelActive,
  setMode,
  wireDownloadEvents,
} from './services/download.js';
import { applySettings, checkTools, setupSettingsListeners } from './services/settings.js';

(async () => {
  [S.settings, S.queue] = await Promise.all([
    window.api.loadSettings().then((r) => r || {}),
    window.api.loadQueue().then((r) => r || []),
  ]);

  try {
    S._downloadsDir = await window.api.getDownloadsDir();
  } catch {}

  try {
    S.appVersion = await window.api.getAppVersion();
  } catch {}

  if (S.settings.lang && S.settings.lang !== 'auto') {
    S.lang = S.settings.lang;
  } else {
    S.lang = detectSystemLang();
    await window.api.saveSettings({ lang: S.lang });
  }

  S.theme = S.settings.theme || 'dark';
  applyTheme(S.theme);
  applyLang();
  applySettings();

  const r = document.documentElement;
  const setTby = (max) => r.style.setProperty('--tby', max ? '0px' : '1px');
  window.api
    .isMaximized()
    .then(setTby)
    .catch(() => setTby(false));
  window.api.onWindowState((s) => setTby(s === 'max'));

  renderQueue();
  updateBadge();

  checkTools();

  wireDownloadEvents();
  setupListeners();
  setupSettingsListeners();

  if (S.settings.checkForUpdates !== false) {
    setTimeout(() => checkForUpdate(true), 4000);
  }

  const verEl = document.getElementById('appVerText');
  if (verEl) verEl.textContent = `JASD v${S.appVersion}`;
  const aboutVer = document.getElementById('aboutVer');
  if (aboutVer) aboutVer.textContent = `v${S.appVersion}`;

  document.querySelectorAll('a.about-link[data-href]').forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      window.api.openExternal(a.dataset.href);
    });
  });
})();

function setupListeners() {
  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      setView(btn.dataset.view);
    });
  });

  document.querySelectorAll('.tab').forEach((tab) => {
    tab.addEventListener('pointerdown', () => {
      const tabId = tab.dataset.tab;
      document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === tab));
      document
        .querySelectorAll('.tab-body')
        .forEach((b) => b.classList.toggle('active', b.id === `tab-${tabId}`));
    });
  });

  document.getElementById('modeVideo').onclick = () => setMode('video');
  document.getElementById('modeAudio').onclick = () => setMode('audio');

  document.getElementById('btnPaste').onclick = async () => {
    try {
      const txt = await navigator.clipboard.readText();
      if (txt) document.getElementById('urlInput').value = txt.trim();
    } catch {}
  };
  document.getElementById('btnFetch').onclick = fetchInfo;
  document.getElementById('urlInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') fetchInfo();
  });

  document.getElementById('btnDownload').onclick = startDownload;

  document.getElementById('btnCancelDl').onclick = handleCancelActive;

  document.getElementById('btnClearDone').addEventListener('pointerdown', () => {
    const removable = ['done', 'cancelled', 'error'];
    S.queue = S.queue.filter((q) => !removable.includes(q.status));
    document.querySelectorAll('.queue-item').forEach((el) => {
      const id = el.id.replace('qi-', '');
      if (!S.queue.find((q) => q.id === id)) el.remove();
    });
    updateEmptyState();
    import('./queue.js').then((m) => m.persistQueue());
    updateBadge();
  });
}
