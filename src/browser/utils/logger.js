'use strict';
const fs = require('fs');

let _logPath = null;
function init(logPath) {
  _logPath = logPath;
}

// Use async append so the main-process event loop is never blocked by log I/O.
// Fire-and-forget: errors are silently ignored to avoid cascading issues.
function writeLog(msg) {
  if (!_logPath) return;
  const ts = new Date().toISOString();
  fs.appendFile(_logPath, `[${ts}] ${msg}\n`, () => {});
}

module.exports = { init, writeLog };
