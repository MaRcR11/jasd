'use strict';
const { ipcMain, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { writeLog } = require('../utils/logger');
const { getYtDlpPath, getYtDlpVersion, getFfmpegVersion } = require('../utils/ytdlp');

function register(cookiePath, logPath) {
  ipcMain.handle('get-log-path', () => logPath);
  ipcMain.on('open-log', () => shell.openPath(logPath));
  ipcMain.handle('get-log-content', () => {
    try {
      return fs.readFileSync(logPath, 'utf8');
    } catch {
      return '(no log yet)';
    }
  });
  ipcMain.on('clear-log', () => {
    try {
      fs.writeFileSync(logPath, '');
    } catch {}
  });

  ipcMain.handle('check-tools', async () => {
    const ytdlpPath = getYtDlpPath();
    const ytdlpVersion = ytdlpPath ? getYtDlpVersion(ytdlpPath) : null;
    const ffmpegVersion = getFfmpegVersion();
    const hasCookies = fs.existsSync(cookiePath);
    let cookieSize = null;
    if (hasCookies) {
      try {
        cookieSize = fs.statSync(cookiePath).size;
      } catch {}
    }
    writeLog(
      `Tools check: yt-dlp=${ytdlpVersion || 'not found'}, ffmpeg=${ffmpegVersion || 'not found'}, cookies=${hasCookies}`
    );
    return { ytdlpVersion, ffmpegVersion, hasCookies, cookieSize, cookiePath };
  });

  ipcMain.handle('pick-cookie-file', async (_e) => {
    const { dialog, BrowserWindow } = require('electron');
    const win = BrowserWindow.getFocusedWindow();
    const r = await dialog.showOpenDialog(win, {
      title: 'Select cookies.txt',
      filters: [
        { name: 'Cookies', extensions: ['txt'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (r.canceled) return null;
    try {
      fs.copyFileSync(r.filePaths[0], cookiePath);
      const size = fs.statSync(cookiePath).size;
      writeLog(`Cookie file imported, size=${size}`);
      return { success: true, size };
    } catch (e) {
      writeLog(`Cookie import error: ${e.message}`);
      return { error: e.message };
    }
  });

  ipcMain.handle('delete-cookies', () => {
    try {
      if (fs.existsSync(cookiePath)) {
        fs.unlinkSync(cookiePath);
        writeLog('Cookies deleted');
      }
      return true;
    } catch (e) {
      writeLog('Cookie delete error: ' + e.message);
      return false;
    }
  });

  ipcMain.handle('check-output-exists', (_e, { outputDir, title, ext }) => {
    try {
      if (!outputDir || !fs.existsSync(outputDir)) return null;
      const files = fs.readdirSync(outputDir);
      const needle = title.toLowerCase().slice(0, 40);
      const extLower = ext.toLowerCase();
      const found = files.find(
        (f) =>
          f.toLowerCase().startsWith(needle.slice(0, 20)) &&
          f.toLowerCase().endsWith('.' + extLower)
      );
      return found ? path.join(outputDir, found) : null;
    } catch {
      return null;
    }
  });
}

module.exports = { register };
