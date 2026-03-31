'use strict';
const { execSync } = require('child_process');

function getYtDlpPath() {
  for (const c of ['yt-dlp', 'yt-dlp.exe']) {
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
