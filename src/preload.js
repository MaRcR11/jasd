'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),

  fetchInfo: (url) => ipcRenderer.invoke('fetch-info', url),
  pickFolder: () => ipcRenderer.invoke('pick-folder'),
  openFolder: (p) => ipcRenderer.send('open-folder', p),

  startDownload: (opts) => ipcRenderer.invoke('start-download', opts),
  cancelDownload: (id) => ipcRenderer.send('cancel-download', id),

  onProgress:  (cb) => ipcRenderer.on('download-progress',  (_e, d) => cb(d)),
  onComplete:  (cb) => ipcRenderer.on('download-complete',  (_e, d) => cb(d)),
  onError:     (cb) => ipcRenderer.on('download-error',     (_e, d) => cb(d)),
  onCancelled: (cb) => ipcRenderer.on('download-cancelled', (_e, d) => cb(d)),
  onLog:       (cb) => ipcRenderer.on('download-log',       (_e, d) => cb(d)),
  removeAll:   (ch) => ipcRenderer.removeAllListeners(ch),

  loadSettings: () => ipcRenderer.invoke('load-settings'),
  saveSettings: (data) => ipcRenderer.invoke('save-settings', data),
  loadQueue: () => ipcRenderer.invoke('load-queue'),
  saveQueue: (data) => ipcRenderer.invoke('save-queue', data),

  pickCookieFile:            () => ipcRenderer.invoke('pick-cookie-file'),
  extractCookiesFromBrowser: (b) => ipcRenderer.invoke('extract-cookies-from-browser', b),
  deleteCookies:             () => ipcRenderer.invoke('delete-cookies'),

  checkTools: () => ipcRenderer.invoke('check-tools'),
  checkOutputExists: (p) => ipcRenderer.invoke('check-output-exists', p),

  getLogPath: () => ipcRenderer.invoke('get-log-path'),
  openLog: () => ipcRenderer.send('open-log'),
  getLogContent: () => ipcRenderer.invoke('get-log-content'),
  clearLog: () => ipcRenderer.send('clear-log'),

  openExternal: (url) => ipcRenderer.send('open-external', url),

  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  updateTitlebarOverlay: (theme) => ipcRenderer.send('update-titlebar-overlay', theme),

  isMaximized: () => ipcRenderer.invoke('is-maximized'),
  onWindowState: (cb) => ipcRenderer.on('window-state', (_e, s) => cb(s)),
});
