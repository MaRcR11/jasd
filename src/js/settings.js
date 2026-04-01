import { S } from './state.js';
import { formatBytes } from './formatters.js';
import { showToast } from './ui.js';
import { applyTheme, THEMES } from './themes.js';
import { t } from './i18n.js';

export function applySettings() {
  const downloadsDir = S._downloadsDir || '';
  document.getElementById('settOutputDir').value = S.settings.outputDir || downloadsDir;
  const chkOw = document.getElementById('chkAlwaysOverwrite');
  if (chkOw) chkOw.checked = !!S.settings.alwaysOverwrite;
  const chkUpdEl = document.getElementById('chkCheckUpdates');
  if (chkUpdEl) chkUpdEl.checked = S.settings.checkForUpdates !== false;
  const chkOpus = document.getElementById('chkPreferOpus');
  if (chkOpus) chkOpus.checked = !!S.settings.preferOpus;
  const themeEl = document.getElementById('settTheme');
  if (themeEl && S.settings.theme) themeEl.value = S.settings.theme;
  const mcEl = document.getElementById('settMaxConcurrent');
  if (mcEl) mcEl.value = String(S.settings.maxConcurrent || 1);
  const ctRow = document.getElementById('customThemeRow');
  if (ctRow) ctRow.style.display = S.settings.theme === 'custom' ? '' : 'none';
}

export async function saveSetting(key, val) {
  S.settings[key] = val;
  await window.api.saveSettings({ [key]: val });
}

export async function checkTools() {
  const res = await window.api.checkTools();

  const ytEl = document.getElementById('settYtdlpVer');
  const ffEl = document.getElementById('settFfmpegVer');

  if (res.ytdlpVersion) {
    ytEl.textContent = res.ytdlpVersion;
    ytEl.className = 'tool-badge ok';
  } else {
    ytEl.textContent = 'Not found';
    ytEl.className = 'tool-badge err';
  }
  if (res.ffmpegVersion) {
    ffEl.textContent = res.ffmpegVersion;
    ffEl.className = 'tool-badge ok';
  } else {
    ffEl.textContent = 'Not found';
    ffEl.className = 'tool-badge err';
  }

  updateCookieStatus(res.hasCookies, res.cookieSize);
}

export function updateCookieStatus(has, size) {
  const ok = has && size > 100;
  document.getElementById('cookieDot').className = ok ? 'cookie-dot ok' : 'cookie-dot';
  document.getElementById('cookieStatusText').textContent = ok
    ? `Cookie file active (${formatBytes(size)})`
    : 'No cookie file — restricted content may fail';
  const delBtn = document.getElementById('btnDeleteCookie');
  if (delBtn) delBtn.style.display = ok ? '' : 'none';
}

export async function importCookieFile() {
  const r = await window.api.pickCookieFile();
  if (!r) return;
  if (r.success) {
    updateCookieStatus(true, r.size);
    showToast('Cookie file imported.', 'success');
  } else {
    showToast('Import failed — check the log for details.', 'error');
  }
}

export async function deleteCookies() {
  await window.api.deleteCookies();
  updateCookieStatus(false, 0);
  showToast('Cookie file removed.', 'info');
}

let _updateChecking = false;

function _lockBtnWidth(btn) {
  if (!btn || btn.style.minWidth) return;
  const w = btn.getBoundingClientRect().width;
  if (w > 0) btn.style.minWidth = w + 'px';
}

function _resetDownloadUI() {
  const progressEl = document.getElementById('updateDlProgress');
  const barEl = document.getElementById('updateDlBar');
  const cancelBtn = document.getElementById('btnCancelUpdate');
  const installBtn = document.getElementById('btnInstallUpdate');
  if (barEl) barEl.style.width = '0%';
  if (progressEl) progressEl.style.display = 'none';
  if (cancelBtn) {
    cancelBtn.style.display = 'none';
    cancelBtn.disabled = false;
    cancelBtn.style.pointerEvents = '';
  }
  if (installBtn) {
    installBtn.disabled = false;
    installBtn.style.pointerEvents = '';
  }
}

export async function checkForUpdate(showIfNone = false) {
  if (_updateChecking) return;
  _updateChecking = true;

  const statusEl = document.getElementById('updateStatusText');
  const badge = document.getElementById('updateBadge');
  const checkBtn = document.getElementById('btnCheckUpdate');
  const installBtn = document.getElementById('btnInstallUpdate');

  if (checkBtn) {
    _lockBtnWidth(checkBtn);
    checkBtn.classList.add('checking');
  }
  if (statusEl) {
    statusEl.textContent = '';
    statusEl.className = 'update-status-text';
  }

  const result = await window.api.checkForUpdate().catch(() => ({ error: 'Network error' }));

  if (checkBtn) checkBtn.classList.remove('checking');
  _updateChecking = false;

  if (!statusEl) return;

  if (result.error) {
    if (showIfNone) {
      statusEl.textContent = t('update_check_failed') + ': ' + result.error;
      statusEl.className = 'update-status-text error';
    }
    return;
  }

  if (result.hasUpdate) {
    statusEl.textContent = t('update_available').replace('{v}', result.latest);
    statusEl.className = 'update-status-text has-update';
    S._updateUrl = result.url;
    S._updateDownloadUrl = result.downloadUrl || null;
    S._updateLatest = result.latest;
    if (badge) badge.style.display = '';
    if (installBtn) {
      installBtn.style.minWidth = '';
      installBtn.textContent = result.downloadUrl
        ? t('btn_install_update') + ' v' + result.latest
        : t('btn_view_update') + ' v' + result.latest;
      installBtn.style.display = '';
      requestAnimationFrame(() => _lockBtnWidth(installBtn));
    }
  } else {
    if (showIfNone) {
      statusEl.textContent = t('update_up_to_date');
      statusEl.className = 'update-status-text up-to-date';
    } else {
      statusEl.textContent = '';
      statusEl.className = 'update-status-text';
    }
    if (badge) badge.style.display = 'none';
    if (installBtn) installBtn.style.display = 'none';
  }
}

export async function installUpdate() {
  const btn = document.getElementById('btnInstallUpdate');
  const statusEl = document.getElementById('updateStatusText');
  if (!btn || btn.disabled) return;

  if (!S._updateDownloadUrl) {
    if (S._updateUrl) window.api.openExternal(S._updateUrl);
    return;
  }

  _lockBtnWidth(btn);
  btn.disabled = true;
  btn.style.pointerEvents = 'none';
  if (statusEl) {
    statusEl.textContent = t('update_downloading');
    statusEl.className = 'update-status-text downloading';
  }

  const progressEl = document.getElementById('updateDlProgress');
  const barEl = document.getElementById('updateDlBar');
  const cancelBtn = document.getElementById('btnCancelUpdate');
  if (barEl) barEl.style.width = '0%';
  if (progressEl) progressEl.style.display = '';
  if (cancelBtn) cancelBtn.style.display = '';

  const result = await window.api.downloadAndInstallUpdate(S._updateDownloadUrl);

  _resetDownloadUI();

  if (result.cancelled) return;

  if (result.error) {
    if (statusEl) {
      statusEl.textContent = t('update_dl_failed') + ': ' + result.error;
      statusEl.className = 'update-status-text error';
    }
  } else {
    if (statusEl) {
      statusEl.textContent = t('update_installing');
      statusEl.className = 'update-status-text downloading';
    }
    if (btn) btn.style.display = 'none';
  }
}

export async function viewLog() {
  const modal = document.getElementById('logModal');
  const pre = document.getElementById('logContent');
  const loading = document.getElementById('logLoading');
  pre.textContent = '';
  pre.style.display = 'none';
  loading.style.display = 'flex';
  modal.style.display = 'flex';
  const content = await window.api.getLogContent();
  loading.style.display = 'none';
  pre.style.display = '';
  pre.textContent = content;
  pre.scrollTop = pre.scrollHeight;
}

export function setupSettingsListeners() {
  document.getElementById('btnSettFolder').onclick = async () => {
    const d = await window.api.pickFolder();
    if (d) {
      document.getElementById('settOutputDir').value = d;
      await saveSetting('outputDir', d);
    }
  };

  document.getElementById('settLang').addEventListener('change', async (e) => {
    S.lang = e.target.value;
    await saveSetting('lang', S.lang);
    const { applyLang } = await import('./i18n.js');
    applyLang();
  });

  document.getElementById('settTheme').addEventListener('change', async (e) => {
    S.theme = e.target.value;
    applyTheme(S.theme);
    await saveSetting('theme', S.theme);
    const ctRow = document.getElementById('customThemeRow');
    if (ctRow) ctRow.style.display = S.theme === 'custom' ? '' : 'none';
  });

  const chkOw = document.getElementById('chkAlwaysOverwrite');
  if (chkOw) {
    chkOw.addEventListener('change', async (e) => {
      await saveSetting('alwaysOverwrite', e.target.checked);
    });
  }

  const chkOpus = document.getElementById('chkPreferOpus');
  if (chkOpus) {
    chkOpus.addEventListener('change', async (e) => {
      await saveSetting('preferOpus', e.target.checked);
    });
  }

  const mcEl = document.getElementById('settMaxConcurrent');
  if (mcEl) {
    mcEl.addEventListener('change', async (e) => {
      const val = Number(e.target.value) || 1;
      S.settings.maxConcurrent = val;
      await saveSetting('maxConcurrent', val);
    });
  }

  document.getElementById('btnEditCustomTheme')?.addEventListener('click', () => {
    openCustomThemeModal();
  });
  document.getElementById('btnCustomThemeCancel')?.addEventListener('click', () => {
    document.getElementById('customThemeModal').style.display = 'none';
  });
  document.getElementById('btnCustomThemeSave')?.addEventListener('click', async () => {
    saveCustomTheme();
    document.getElementById('customThemeModal').style.display = 'none';
    applyTheme('custom');
    await saveSetting('customTheme', S.settings.customTheme);
  });
  document.getElementById('btnCustomThemeReset')?.addEventListener('click', () => {
    buildCustomThemeGrid(null);
  });

  document.getElementById('btnImportCookie').onclick = importCookieFile;
  document.getElementById('btnDeleteCookie').onclick = deleteCookies;

  document.getElementById('btnOpenLog').onclick = () => window.api.openLog();
  document.getElementById('btnViewLog').onclick = viewLog;
  document.getElementById('btnClearLog').onclick = () => {
    window.api.clearLog();
    showToast('Log cleared.', 'info');
  };
  document.getElementById('btnCloseLog').onclick = () => {
    document.getElementById('logModal').style.display = 'none';
  };

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const logModal = document.getElementById('logModal');
      if (logModal.style.display !== 'none') logModal.style.display = 'none';
    }
  });

  const chkUpd = document.getElementById('chkCheckUpdates');
  if (chkUpd) {
    chkUpd.addEventListener('change', async (e) => {
      await saveSetting('checkForUpdates', e.target.checked);
    });
  }

  document.getElementById('btnCheckUpdate').onclick = () => checkForUpdate(true);
  document.getElementById('btnInstallUpdate').onclick = installUpdate;
  document.getElementById('btnCancelUpdate').onclick = async () => {
    const cancelBtn = document.getElementById('btnCancelUpdate');
    cancelBtn.disabled = true;
    cancelBtn.style.pointerEvents = 'none';
    await window.api.cancelUpdateDownload();
  };

  window.api.onInstallProgress((pct) => {
    const bar = document.getElementById('updateDlBar');
    if (bar) bar.style.width = pct + '%';
  });

  document.getElementById('btnRestoreDefaults').onclick = async () => {
    const DEFAULTS = {
      outputDir: S._downloadsDir || '',
      alwaysOverwrite: false,
      preferOpus: false,
      maxConcurrent: 1,
      theme: 'dark',
      lang: 'auto',
      checkForUpdates: true,
    };
    S.settings = { ...S.settings, ...DEFAULTS };
    await window.api.saveSettings(DEFAULTS);
    applySettings();
    const { applyTheme } = await import('./themes.js');
    applyTheme('dark');
    const { applyLang, detectSystemLang } = await import('./i18n.js');
    S.lang = detectSystemLang();
    applyLang();
    showToast('Settings restored to defaults.', 'info');
  };
}

const CUSTOM_THEME_LABELS = {
  bg: 'Background',
  bg2: 'Surface',
  bg3: 'Surface Alt',
  bg4: 'Surface High',
  border: 'Border',
  text: 'Text',
  text2: 'Text Muted',
  text3: 'Text Faint',
  accent: 'Accent',
  success: 'Success',
  danger: 'Danger',
  warn: 'Warning',
};

function openCustomThemeModal() {
  buildCustomThemeGrid(S.settings.customTheme || null);
  document.getElementById('customThemeModal').style.display = 'flex';
}

function buildCustomThemeGrid(colors) {
  const defaults = THEMES.dark || {};
  const current = colors || defaults;
  const grid = document.getElementById('customThemeGrid');
  grid.innerHTML = '';
  Object.entries(CUSTOM_THEME_LABELS).forEach(([key, label]) => {
    const val = current[key] || defaults[key] || '#888888';
    const row = document.createElement('div');
    row.className = 'field-row';
    row.style.cssText = 'padding:6px 0;border-bottom:1px solid var(--border)';
    row.innerHTML = `
      <span class="field-label" style="font-size:12.5px">${label}</span>
      <div style="display:flex;align-items:center;gap:8px;margin-left:auto">
        <span class="ct-hex" style="font-size:11px;font-family:var(--mono);color:var(--text2)">${val}</span>
        <input type="color" class="ct-pick" data-key="${key}" value="${val}"
          style="width:32px;height:28px;border-radius:4px;border:1px solid var(--border);
                 background:none;cursor:pointer;padding:2px"/>
      </div>`;
    const pick = row.querySelector('.ct-pick');
    const hex = row.querySelector('.ct-hex');
    pick.addEventListener('input', () => {
      hex.textContent = pick.value;
    });
    grid.appendChild(row);
  });
}

function saveCustomTheme() {
  const picks = document.querySelectorAll('#customThemeGrid .ct-pick');
  const result = {};
  picks.forEach((p) => {
    result[p.dataset.key] = p.value;
  });
  S.settings.customTheme = result;
}
