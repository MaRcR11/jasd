'use strict';
const { ipcMain, shell, app } = require('electron');
const fs = require('fs');
const path = require('path');
const https = require('https');
const { writeLog } = require('../utils/logger');
const { getYtDlpPath, getYtDlpVersion, getFfmpegVersion } = require('../utils/ytdlp');

let _activeDownloadRes = null;
let _activeDownloadFile = null;
let _downloadCancelled = false;

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

  ipcMain.handle('check-for-update', async () => {
    const cv = app.getVersion();
    return new Promise((resolve) => {
      const opts = {
        hostname: 'api.github.com',
        path: '/repos/MaRcR11/jasd/releases/latest',
        headers: { 'User-Agent': 'jasd-app' },
        timeout: 8000,
      };
      const req = https.get(opts, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            const json = JSON.parse(data);
            if (json.message) { resolve({ error: json.message }); return; }
            const latest = (json.tag_name || '').replace(/^v/, '');
            const url = json.html_url || 'https://github.com/MaRcR11/jasd/releases/latest';
            if (!latest) { resolve({ error: 'No release found' }); return; }
            const hasUpdate = compareVersions(latest, cv) > 0;
            const exeAsset = (json.assets || []).find((a) => a.name && a.name.endsWith('.exe'));
            const downloadUrl = exeAsset ? exeAsset.browser_download_url : null;
            writeLog(`Update check: current=${cv}, latest=${latest}, hasUpdate=${hasUpdate}`);
            resolve({ latest, hasUpdate, url, downloadUrl });
          } catch (e) {
            writeLog(`Update check parse error: ${e.message}`);
            resolve({ error: 'Failed to parse response' });
          }
        });
      });
      req.on('error', (e) => {
        writeLog(`Update check network error: ${e.message}`);
        resolve({ error: e.message });
      });
      req.on('timeout', () => { req.destroy(); resolve({ error: 'Request timed out' }); });
    });
  });

  ipcMain.handle('cancel-update-download', () => {
    _downloadCancelled = true;
    if (_activeDownloadRes) {
      _activeDownloadRes.destroy(new Error('Cancelled'));
      _activeDownloadRes = null;
    }
    if (_activeDownloadFile) {
      _activeDownloadFile.destroy();
      _activeDownloadFile = null;
    }
    return true;
  });

  ipcMain.handle('download-and-install-update', async (event, { downloadUrl }) => {
    const os = require('os');
    const baseName = downloadUrl.split('/').pop().split('?')[0] || 'jasd-update.exe';
    const ext = path.extname(baseName);
    const stem = path.basename(baseName, ext);
    const destPath = path.join(os.tmpdir(), `${stem}-${Date.now()}${ext}`);
    _downloadCancelled = false;
    _activeDownloadRes = null;
    _activeDownloadFile = null;
    return new Promise((resolve) => {
      let settled = false;
      const done = (val) => {
        if (!settled) {
          settled = true;
          _activeDownloadRes = null;
          _activeDownloadFile = null;
          resolve(val);
        }
      };
      const file = fs.createWriteStream(destPath);
      _activeDownloadFile = file;
      const doGet = (url, hops) => {
        if (hops > 8) { done({ error: 'Too many redirects' }); return; }
        const mod = url.startsWith('https') ? https : require('http');
        mod.get(url, { headers: { 'User-Agent': 'jasd-app' } }, (res) => {
          if ([301, 302, 303, 307, 308].includes(res.statusCode)) {
            res.resume();
            doGet(res.headers.location, hops + 1);
            return;
          }
          _activeDownloadRes = res;
          const total = parseInt(res.headers['content-length'] || '0', 10);
          let received = 0;
          let lastPct = -1;
          res.on('data', (chunk) => {
            received += chunk.length;
            if (total > 0) {
              const pct = Math.round((received / total) * 100);
              if (pct !== lastPct) {
                lastPct = pct;
                try { event.sender.send('install-progress', pct); } catch {}
              }
            }
          });
          res.pipe(file);
          file.on('finish', () => {
            file.close(() => {
              writeLog(`Update installer saved to ${destPath}`);
              shell.openPath(destPath)
                .then(() => done({ success: true }))
                .catch((e) => done({ error: e.message }));
            });
          });
          const onStreamError = () => {
            try { fs.unlinkSync(destPath); } catch {}
            done(_downloadCancelled ? { cancelled: true } : { error: 'Download failed' });
          };
          file.on('error', onStreamError);
          res.on('error', onStreamError);
        }).on('error', (e) => done({ error: e.message }));
      };
      doGet(downloadUrl, 0);
    });
  });
}

function compareVersions(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const diff = (pa[i] || 0) - (pb[i] || 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

module.exports = { register };
