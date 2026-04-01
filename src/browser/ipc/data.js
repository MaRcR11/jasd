'use strict';
const { ipcMain } = require('electron');
const { readJSON, readJSONAsync, writeJSON, writeJSONAsync } = require('../utils/storage');
const path = require('path');
const os = require('os');

function register(settingsPath, queuePath) {
  ipcMain.handle('load-settings', () => readJSON(settingsPath, {}));
  ipcMain.handle('save-settings', async (_e, data) => {
    const cur = await readJSONAsync(settingsPath, {});
    await writeJSONAsync(settingsPath, { ...cur, ...data });
    return true;
  });

  ipcMain.handle('get-downloads-dir', () => path.join(os.homedir(), 'Downloads'));

  ipcMain.handle('load-queue', () => readJSON(queuePath, []));
  ipcMain.handle('save-queue', async (_e, data) => {
    await writeJSONAsync(queuePath, data);
    return true;
  });
}

module.exports = { register };
