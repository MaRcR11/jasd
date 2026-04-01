'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  openExternal: (url) => ipcRenderer.send('open-external', url),

  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  checkTools: () => ipcRenderer.invoke('check-tools'),
  checkForUpdate: () => ipcRenderer.invoke('check-for-update'),
  fetchInfo: (url) => ipcRenderer.invoke('fetch-info', url),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  startDownload: (opts) => ipcRenderer.invoke('start-download', opts),
  cancelDownload: (id) => ipcRenderer.send('cancel-download', id),
  openFolder: (p) => ipcRenderer.send('open-folder', p),
  openFile: (filePath, hash) => ipcRenderer.invoke('open-file', { filePath, hash }),

  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (d) => ipcRenderer.invoke('save-settings', d),
  getDownloadsDir: () => ipcRenderer.invoke('get-downloads-dir'),
  loadQueue: () => ipcRenderer.invoke('load-queue'),
  saveQueue: (d) => ipcRenderer.invoke('save-queue', d),

  pickCookieFile: () => ipcRenderer.invoke('pick-cookie-file'),
  extractCookiesFromBrowser: (b) => ipcRenderer.invoke('extract-cookies-from-browser', b),
  deleteCookies: () => ipcRenderer.invoke('delete-cookies'),

  checkOutputExists: (p) => ipcRenderer.invoke('check-output-exists', p),

  getLogPath: () => ipcRenderer.invoke('get-log-path'),
  openLog: () => ipcRenderer.send('open-log'),
  getLogContent: () => ipcRenderer.invoke('get-log-content'),
  clearLog: () => ipcRenderer.send('clear-log'),

  updateTitlebarOverlay: (theme) => ipcRenderer.send('update-titlebar-overlay', theme),

  isMaximized: () => ipcRenderer.invoke('is-maximized'),
  onWindowState: (cb) => ipcRenderer.on('window-state', (_e, s) => cb(s)),

  downloadAndInstallUpdate: (downloadUrl) =>
    ipcRenderer.invoke('download-and-install-update', { downloadUrl }),
  cancelUpdateDownload: () => ipcRenderer.invoke('cancel-update-download'),
  onInstallProgress: (cb) => {
    const handler = (_e, pct) => cb(pct);
    ipcRenderer.on('install-progress', handler);
    return () => ipcRenderer.removeListener('install-progress', handler);
  },

  onProgress: (cb) => ipcRenderer.on('download-progress', (_e, d) => cb(d)),
  onComplete: (cb) => ipcRenderer.on('download-complete', (_e, d) => cb(d)),
  onError: (cb) => ipcRenderer.on('download-error', (_e, d) => cb(d)),
  onCancelled: (cb) => ipcRenderer.on('download-cancelled', (_e, d) => cb(d)),
  onLog: (cb) => ipcRenderer.on('download-log', (_e, d) => cb(d)),
  removeAll: (ch) => ipcRenderer.removeAllListeners(ch),
});
