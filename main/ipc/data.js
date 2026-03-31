'use strict';
const { ipcMain } = require('electron');
const { readJSON, writeJSON } = require('../utils/storage');

function register(settingsPath, queuePath) {
  ipcMain.handle('load-settings', () => readJSON(settingsPath, {}));
  ipcMain.handle('save-settings', (_e, data) => {
    const cur = readJSON(settingsPath, {});
    writeJSON(settingsPath, { ...cur, ...data });
    return true;
  });

  ipcMain.handle('load-queue', () => readJSON(queuePath, []));
  ipcMain.handle('save-queue', (_e, data) => {
    writeJSON(queuePath, data);
    return true;
  });
}

module.exports = { register };
