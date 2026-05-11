'use strict';
const { exec } = require('child_process');
const path = require('path');

const VERSION_TIMEOUT = 2000;

let _cachedPath = undefined;

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

async function _resolvePath() {
  const binDir = _bundledBinDir();
  const bundledBin = binDir
    ? path.join(binDir, process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp')
    : null;
  const systemCandidates = process.platform === 'win32' ? ['yt-dlp', 'yt-dlp.exe'] : ['yt-dlp'];
  const allCandidates = [...(bundledBin ? [bundledBin] : []), ...systemCandidates];

  const versions = await Promise.all(allCandidates.map(_probeVersion));

  const bundledVer = bundledBin ? versions[0] : null;
  const systemEntries = systemCandidates
    .map((c, i) => ({ bin: c, ver: versions[(bundledBin ? 1 : 0) + i] }))
    .filter((e) => e.ver !== null);
  const systemEntry = systemEntries[0] || null;

  if (!bundledVer && !systemEntry) return null;
  if (!bundledVer) return systemEntry.bin;
  if (!systemEntry) return bundledBin;

  return _isNewer(systemEntry.ver, bundledVer) ? systemEntry.bin : bundledBin;
}

async function getYtDlpPath() {
  if (_cachedPath !== undefined) return _cachedPath;
  _cachedPath = await _resolvePath();
  return _cachedPath;
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

module.exports = { getYtDlpPath, getYtDlpVersion, getFfmpegVersion, _parseVer, _isNewer };
