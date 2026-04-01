'use strict';
const { app, BrowserWindow, ipcMain, Menu, screen, shell } = require('electron');
const path = require('path');

const userDataPath = app.getPath('userData');
const settingsPath = path.join(userDataPath, 'settings.json');
const queuePath = path.join(userDataPath, 'queue.json');
const cookiePath = path.join(userDataPath, 'cookies.txt');
const logPath = path.join(userDataPath, 'app.log');

const logger = require('./utils/logger');
logger.init(logPath);
const { writeLog } = logger;

const dataIpc = require('./ipc/data');
const toolsIpc = require('./ipc/tools');
const downloadIpc = require('./ipc/download');

Menu.setApplicationMenu(null);

const { readJSON, writeJSON } = require('./utils/storage');

function getTitlebarOverlay(theme) {
  const isLight = theme === 'light';
  const isMidnight = theme === 'midnight';
  const isOcean = theme === 'ocean';
  return {
    color: isLight ? '#ffffff' : isMidnight ? '#0a0a0a' : isOcean ? '#0f2040' : '#17171b',
    symbolColor: isLight ? '#5a5a7a' : '#9494a8',
    height: 32,
  };
}

let mainWindow;

function createWindow() {
  const saved = readJSON(settingsPath, {});

  let winX = saved.windowX;
  let winY = saved.windowY;
  if (winX != null && winY != null) {
    const display = screen.getDisplayNearestPoint({ x: winX, y: winY });
    const { x, y, width, height } = display.workArea;
    const onScreen = winX >= x - 8 && winX < x + width && winY >= y - 8 && winY < y + height;
    if (!onScreen) {
      winX = undefined;
      winY = undefined;
    }
  }

  mainWindow = new BrowserWindow({
    width: saved.windowWidth || 980,
    height: saved.windowHeight || 700,
    x: winX,
    y: winY,
    minWidth: 740,
    minHeight: 540,
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: getTitlebarOverlay(saved.theme),
    backgroundColor: saved.theme === 'light' ? '#f0f0f5' : '#0f0f11',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, '../../assets/icon.png'),
    show: true,
  });

  mainWindow.loadFile(path.join(__dirname, '../index.html'));

  mainWindow.on('maximize', () => mainWindow.webContents.send('window-state', 'max'));
  mainWindow.on('unmaximize', () => mainWindow.webContents.send('window-state', 'win'));

  mainWindow.on('close', () => {
    const b = mainWindow.getBounds();
    const cur = readJSON(settingsPath, {});
    writeJSON(settingsPath, {
      ...cur,
      windowWidth: b.width,
      windowHeight: b.height,
      windowX: b.x,
      windowY: b.y,
    });
  });

  writeLog('JASD started');
  return mainWindow;
}

app.whenReady().then(() => {
  const win = createWindow();

  win.webContents.on('context-menu', (_e, params) => {
    if (!params.isEditable) return;
    const menu = Menu.buildFromTemplate([
      { role: 'cut', enabled: params.editFlags.canCut },
      { role: 'copy', enabled: params.editFlags.canCopy },
      { role: 'paste', enabled: params.editFlags.canPaste },
      { type: 'separator' },
      { role: 'selectAll', enabled: params.editFlags.canSelectAll },
    ]);
    menu.popup({ window: win });
  });

  dataIpc.register(settingsPath, queuePath);
  toolsIpc.register(cookiePath, logPath);
  downloadIpc.register(win, cookiePath);

  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('is-maximized', () => mainWindow?.isMaximized() ?? false);

  ipcMain.on('window-minimize', () => mainWindow?.minimize());
  ipcMain.on('window-maximize', () => {
    mainWindow?.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
  });
  ipcMain.on('window-close', () => mainWindow?.close());
  ipcMain.on('open-external', (_e, url) => {
    const allowed = /^https:\/\/github\.com\//;
    if (allowed.test(url)) shell.openExternal(url);
  });

  ipcMain.on('update-titlebar-overlay', (_e, theme) => {
    if (!mainWindow) return;
    mainWindow.setTitleBarOverlay(getTitlebarOverlay(theme));
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
