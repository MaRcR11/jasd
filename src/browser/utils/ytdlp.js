'use strict';
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const VERSION_TIMEOUT = 5000;

let _cacheBinPath = false;
let _cachedPath = undefined;

function setCacheBinPath(enabled) {
  _cacheBinPath = !!enabled;
  if (!enabled) _cachedPath = undefined;
}

function _bundledBinDir() {
  try {
    const { app } = require('electron');
    const base = app.isPackaged ? process.resourcesPath : path.join(__dirname, '..', '..', '..');
    return path.join(base, 'bin');
  } catch {
    return null;
  }
}

function _probeVersion(bin) {
  return new Promise((resolve) => {
    exec(`"${bin}" --version`, { timeout: VERSION_TIMEOUT }, (err, stdout) => {
      resolve(err ? null : stdout.trim());
    });
  });
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

function _findSystemBin() {
  return new Promise((resolve) => {
    const cmd = process.platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
    exec(cmd, { timeout: 3000 }, (err, stdout) => {
      if (err) return resolve(null);
      const lines = stdout.trim().split(/\r?\n/);
      const found = lines.find((l) => l.toLowerCase().endsWith('.exe')) || lines[0];
      resolve(found ? found.trim() : null);
    });
  });
}

async function _resolvePath() {
  const binDir = _bundledBinDir();
  const bundledBin = binDir
    ? path.join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
    : null;

  const bundledExists = bundledBin ? fs.existsSync(bundledBin) : false;
  const systemBin = await _findSystemBin();

  if (!bundledExists && !systemBin) return null;
  if (!bundledExists) return systemBin;
  if (!systemBin) return bundledBin;

  const [bundledVer, systemVer] = await Promise.all([
    _probeVersion(bundledBin),
    _probeVersion(systemBin),
  ]);
  return _isNewer(systemVer, bundledVer) ? systemBin : bundledBin;
}

async function getYtDlpPath() {
  if (_cacheBinPath) {
    if (_cachedPath !== undefined) return _cachedPath;
    _cachedPath = await _resolvePath();
    return _cachedPath;
  }
  return _resolvePath();
}

async function getYtDlpVersion(ytdlpPath) {
  return _probeVersion(ytdlpPath);
}

async function getFfmpegVersion() {
  return new Promise((resolve) => {
    exec('ffmpeg -version', { timeout: VERSION_TIMEOUT }, (err, stdout) => {
      if (err) return resolve(null);
      const m = stdout.match(/ffmpeg version ([^\s]+)/);
      resolve(m ? m[1] : 'found');
    });
  });
}

module.exports = {
  getYtDlpPath,
  getYtDlpVersion,
  getFfmpegVersion,
  setCacheBinPath,
  _parseVer,
  _isNewer,
};
