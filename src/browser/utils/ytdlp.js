'use strict';
const { execSync } = require('child_process');
const path = require('path');

function _bundledBinDir() {
  try {
    const { app } = require('electron');
    const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', '..', '..');
    return path.join(base, 'bin');
  } catch {
    return null;
  }
}

function _tryExec(bin) {
  try {
    execSync(`"${bin}" --version`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function _parseVer(ver) {
  return (ver || '').split('.').map(Number);
}

function _isNewer(verA, verB) {
  const a = _parseVer(verA);
  const b = _parseVer(verB);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (a[i] || 0) - (b[i] || 0);
    if (diff > 0) return true;
    if (diff < 0) return false;
  }
  return false;
}

function getYtDlpPath() {
  const binDir = _bundledBinDir();
  const bundledBin = binDir
    ? path.join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
    : null;
  const systemCandidates = process.platform === 'win32' ? ['yt-dlp', 'yt-dlp.exe'] : ['yt-dlp'];

  const bundled = bundledBin && _tryExec(bundledBin) ? bundledBin : null;
  const system = systemCandidates.find(_tryExec) || null;

  if (!bundled && !system) return null;
  if (!bundled) return system;
  if (!system) return bundled;

  const bundledVer = getYtDlpVersion(bundled);
  const systemVer = getYtDlpVersion(system);
  return _isNewer(systemVer, bundledVer) ? system : bundled;
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
