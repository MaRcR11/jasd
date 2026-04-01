'use strict';
const fs = require('fs');

let _logPath = null;
function init(logPath) {
  _logPath = logPath;
}

function writeLog(msg) {
  if (!_logPath) return;
  const ts = new Date().toISOString();
  try {
    fs.appendFileSync(_logPath, `[${ts}] ${msg}\n`);
  } catch {}
}

module.exports = { init, writeLog };
