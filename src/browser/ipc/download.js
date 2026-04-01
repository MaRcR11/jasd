'use strict';
const { ipcMain, dialog, shell } = require('electron');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PARTIAL_HASH_BYTES = 1024 * 1024; // first 1 MB

function partialHash(filePath) {
  try {
    const fd = fs.openSync(filePath, 'r');
    const stat = fs.fstatSync(fd);
    const size = Math.min(stat.size, PARTIAL_HASH_BYTES);
    const buf = Buffer.alloc(size);
    if (size > 0) fs.readSync(fd, buf, 0, size, 0);
    fs.closeSync(fd);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}
const { getYtDlpPath } = require('../utils/ytdlp');
const { writeLog } = require('../utils/logger');

const activeDownloads = new Map();
const cancelledIds = new Set();

function register(mainWindow, cookiePath) {
  ipcMain.handle('fetch-info', async (_e, url) => {
    const ytdlp = getYtDlpPath();
    if (!ytdlp) return { error: 'yt-dlp not found. Install it and place it in the bin/ folder.' };
    writeLog(`Fetching info: ${url}`);

    return new Promise((resolve) => {
      const args = ['--dump-json', '--no-playlist'];
      if (fs.existsSync(cookiePath)) args.push('--cookies', cookiePath);
      args.push(url);

      const proc = spawn(ytdlp, args, { windowsHide: true });
      let stdout = '',
        stderr = '';
      proc.stdout.on('data', (d) => (stdout += d));
      proc.stderr.on('data', (d) => (stderr += d));
      proc.on('close', (code) => {
        if (code !== 0) {
          writeLog(`fetch-info error (code ${code}): ${stderr.slice(0, 500)}`);
          const short = 'Failed to fetch media info — check the log for details.';
          resolve({ error: short });
          return;
        }
        try {
          const info = JSON.parse(stdout);
          const formats = (info.formats || [])
            .filter((f) => f.ext && (f.vcodec !== 'none' || f.acodec !== 'none'))
            .map((f) => ({
              format_id: f.format_id,
              ext: f.ext,
              resolution: f.resolution || (f.width ? `${f.width}x${f.height}` : null),
              fps: f.fps || null,
              filesize: f.filesize || f.filesize_approx || null,
              vcodec: f.vcodec,
              acodec: f.acodec,
              abr: f.abr || null,
              tbr: f.tbr || null,
              format_note: f.format_note || '',
              quality: f.quality,
            }))
            .sort((a, b) => (b.tbr || 0) - (a.tbr || 0));
          resolve({
            title: info.title,
            thumbnail: info.thumbnail,
            duration: info.duration,
            uploader: info.uploader || info.channel || null,
            view_count: info.view_count || null,
            upload_date: info.upload_date || null,
            webpage_url: info.webpage_url,
            formats,
          });
        } catch (e) {
          writeLog(`fetch-info parse error: ${e.message}`);
          resolve({ error: 'Failed to parse media metadata — check the log.' });
        }
      });
    });
  });

  ipcMain.handle('pick-folder', async () => {
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] });
    return r.canceled ? null : r.filePaths[0];
  });

  ipcMain.handle('start-download', async (_e, opts) => {
    const ytdlp = getYtDlpPath();
    if (!ytdlp) return { error: 'yt-dlp not found — place it in the bin/ folder.' };

    const {
      url,
      outputDir,
      formatId,
      audioOnly,
      audioFormat,
      audioQuality,
      videoAudioQuality,
      preferOpus,
      embedThumbnail,
      addMetadata,
      playlistItems,
      rateLimit,
      customFilename,
      downloadId,
      container,
      forceOverwrite,
    } = opts;

    const outDir = outputDir || path.join(os.homedir(), 'Downloads');
    if (!fs.existsSync(outDir)) {
      try {
        fs.mkdirSync(outDir, { recursive: true });
      } catch {}
    }

    // temp subfolder — same drive so rename on complete is instant
    const tmpDir = path.join(outDir, `.jasd-tmp-${downloadId}`);
    try {
      fs.mkdirSync(tmpDir, { recursive: true });
    } catch {}

    const template = customFilename
      ? path.join(tmpDir, customFilename + '.%(ext)s')
      : path.join(tmpDir, '%(title)s.%(ext)s');

    const args = ['--newline', '--progress', '-o', template];

    if (forceOverwrite) {
      args.push('--force-overwrites');
    }

    if (audioOnly) {
      args.push(
        '-x',
        '--audio-format',
        audioFormat || 'mp3',
        '--audio-quality',
        String(audioQuality ?? 0)
      );
    } else {
      let fmtStr;
      const aud = buildAudioFormatPart(videoAudioQuality, !!preferOpus);
      if (formatId && formatId !== 'bestvideo+bestaudio/best') {
        fmtStr = `${formatId}+${aud.m4a}/${formatId}+${aud.any}/${formatId}/best`;
      } else {
        fmtStr = `bestvideo+${aud.m4a}/bestvideo+${aud.any}/bestvideo+bestaudio/best`;
      }
      args.push('-f', fmtStr);
      args.push('--merge-output-format', container || 'mp4');
      // when Opus is preferred (or used as fallback), re-encode to AAC for Windows compatibility.
      // -c:a aac is a no-op when the stream is already AAC (stream copy applies automatically).
      // copy video, convert audio to aac — opus-in-mp4 not supported by windows media apps
      args.push('--postprocessor-args', 'Merger+ffmpeg:-c:v copy -c:a aac -b:a 192k');
    }

    if (embedThumbnail) args.push('--embed-thumbnail');
    if (addMetadata) args.push('--add-metadata', '--embed-metadata');
    if (rateLimit) args.push('-r', rateLimit);
    if (playlistItems) args.push('--playlist-items', playlistItems);
    if (fs.existsSync(cookiePath)) args.push('--cookies', cookiePath);

    args.push(url);
    writeLog(
      `Download start: id=${downloadId}, audioOnly=${audioOnly}, args: ${JSON.stringify(args)}`
    );

    const proc = spawn(ytdlp, args, { windowsHide: true });
    activeDownloads.set(downloadId, { proc, outDir, tmpDir });
    cancelledIds.delete(downloadId);

    proc.stdout.on('data', (data) => {
      const line = data.toString();
      writeLog(`[dl:${downloadId}] ${line.trim()}`);
      const pctMatch = line.match(/(\d+\.?\d*)%/);
      const speedMatch = line.match(/at\s+([\d.]+\s*\w+\/s)/);
      const etaMatch = line.match(/ETA\s+([\d:]+)/);
      if (pctMatch) {
        mainWindow.webContents.send('download-progress', {
          downloadId,
          percent: parseFloat(pctMatch[1]),
          speed: speedMatch?.[1]?.trim() || '',
          eta: etaMatch?.[1] || '',
        });
      }
    });

    proc.stderr.on('data', (d) => {
      writeLog(`[dl:${downloadId}][err] ${d.toString().trim()}`);
    });

    return new Promise((resolve) => {
      proc.on('close', (code) => {
        activeDownloads.delete(downloadId);
        writeLog(`Download finished: id=${downloadId}, code=${code}`);

        if (cancelledIds.has(downloadId)) {
          cancelledIds.delete(downloadId);
          resolve({ cancelled: true });
          return;
        }

        if (code === 0 || code === null) {
          const movedFiles = moveFromTmp(tmpDir, outDir, downloadId);
          const outputFile = movedFiles[0]?.path || null;
          const outputFileHash = movedFiles[0]?.hash || null;
          mainWindow.webContents.send('download-complete', {
            downloadId,
            outputDir: outDir,
            outputFile,
            outputFileHash,
          });
          resolve({ success: true, outputDir: outDir, outputFile, outputFileHash });
        } else {
          try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
          } catch {}
          mainWindow.webContents.send('download-error', { downloadId, code });
          resolve({ error: `yt-dlp exited with code ${code}` });
        }
      });
    });
  });

  ipcMain.on('cancel-download', (_e, downloadId) => {
    const entry = activeDownloads.get(downloadId);
    cancelledIds.add(downloadId);
    if (entry) {
      const { proc, tmpDir } = entry;
      // on win, kill entire process tree so yt-dlp AND its ffmpeg child both die.
      if (process.platform === 'win32') {
        try {
          require('child_process').execSync(`taskkill /F /T /PID ${proc.pid}`, {
            stdio: 'ignore',
            timeout: 5000,
          });
        } catch {}
        activeDownloads.delete(downloadId);
        deleteTmpWithRetry(tmpDir, downloadId, 0);
      } else {
        try {
          proc.kill('SIGTERM');
        } catch {}
        setTimeout(() => {
          if (activeDownloads.has(downloadId)) {
            try {
              proc.kill('SIGKILL');
            } catch {}
            activeDownloads.delete(downloadId);
          }
          deleteTmpWithRetry(tmpDir, downloadId, 0);
        }, 1000);
      }
      writeLog(`Download cancelled: ${downloadId}`);
    }
    mainWindow.webContents.send('download-cancelled', { downloadId });
  });

  ipcMain.on('open-folder', (_e, folderPath) => {
    shell.openPath(folderPath);
  });

  ipcMain.handle('open-file', async (_e, { filePath, hash }) => {
    if (!fs.existsSync(filePath)) {
      return 'File not found — it may have been moved or deleted.';
    }
    if (hash) {
      const current = partialHash(filePath);
      if (current !== hash) {
        return 'File has changed since download — it may have been replaced.';
      }
    }
    return shell.openPath(filePath);
  });
}

// retries rmSync up to 5x at 300ms — windows releases handles async after taskkill
function deleteTmpWithRetry(tmpDir, downloadId, attempt) {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    writeLog(`Tmp deleted after cancel: ${tmpDir}`);
  } catch (e) {
    if (attempt < 5) {
      setTimeout(() => deleteTmpWithRetry(tmpDir, downloadId, attempt + 1), 300);
    } else {
      writeLog(`Tmp delete gave up [${downloadId}]: ${e.message}`);
    }
  }
}

function moveFromTmp(tmpDir, outDir, downloadId) {
  const moved = [];
  try {
    const files = fs.readdirSync(tmpDir);
    for (const f of files) {
      const src = path.join(tmpDir, f);
      const dest = path.join(outDir, f);
      try {
        fs.renameSync(src, dest);
        const hash = partialHash(dest);
        writeLog(`Moved to output [${downloadId}]: ${f} (hash: ${hash?.slice(0, 8)}…)`);
        moved.push({ path: dest, hash });
      } catch (e) {
        writeLog(`Move failed [${downloadId}]: ${f} — ${e.message}`);
      }
    }
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (e) {
    writeLog(`moveFromTmp error [${downloadId}]: ${e.message}`);
  }
  return moved;
}

function buildAudioFormatPart(quality, preferOpus = false) {
  if (preferOpus) {
    if (!quality || quality === 'best' || quality === '0')
      return { m4a: 'bestaudio', any: 'bestaudio' };
    if (quality === '2') return { m4a: 'bestaudio[abr<=320]', any: 'bestaudio[abr<=320]' };
    if (quality === '5') return { m4a: 'bestaudio[abr<=192]', any: 'bestaudio[abr<=192]' };
    const kbps = parseInt(quality);
    if (!isNaN(kbps)) return { m4a: `bestaudio[abr<=${kbps}]`, any: `bestaudio[abr<=${kbps}]` };
    return { m4a: 'bestaudio', any: 'bestaudio' };
  }
  // default: native m4a (aac), fallback to opus re-encoded to aac
  if (!quality || quality === 'best' || quality === '0')
    return { m4a: 'bestaudio[ext=m4a]', any: 'bestaudio' };
  if (quality === '2') return { m4a: 'bestaudio[ext=m4a][abr<=320]', any: 'bestaudio[abr<=320]' };
  if (quality === '5') return { m4a: 'bestaudio[ext=m4a][abr<=192]', any: 'bestaudio[abr<=192]' };
  const kbps = parseInt(quality);
  if (!isNaN(kbps))
    return { m4a: `bestaudio[ext=m4a][abr<=${kbps}]`, any: `bestaudio[abr<=${kbps}]` };
  return { m4a: 'bestaudio[ext=m4a]', any: 'bestaudio' };
}

module.exports = { register };
