'use strict';
const { execSync } = require('child_process');
const path = require('path');

function _bundledBinDir() {
  try {
    const { app } = require('electron');
    const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', '..');
    return path.join(base, 'bin');
  } catch {
    return null;
  }
}

function getYtDlpPath() {
  const binDir = _bundledBinDir();
  const bundled = binDir
    ? [path.join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')]
    : [];
  const system = process.platform === 'win32' ? ['yt-dlp', 'yt-dlp.exe'] : ['yt-dlp'];
  for (const c of [...bundled, ...system]) {
    try {
      execSync(`"${c}" --version`, { stdio: 'ignore' });
      return c;
    } catch {}
  }
  return null;
}

function getYtDlpVersion(ytdlpPath) {
  try {
    return execSync(`"${ytdlpPath}" --version`, { timeout: 5000 }).toString().trim();
  } catch {
    return null;
  }
}

function getFfmpegVersion() {
  try {
    const out = execSync('ffmpeg -version', {
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 5000,
    }).toString();
    const m = out.match(/ffmpeg version ([^\s]+)/);
    return m ? m[1] : 'found';
  } catch {
    return null;
  }
}

module.exports = { getYtDlpPath, getYtDlpVersion, getFfmpegVersion };
