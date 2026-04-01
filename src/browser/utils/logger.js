'use strict';
const fs = require('fs');

let _logPath = null;
function init(logPath) {
  _logPath = logPath;
}

function writeLog(msg) {
  if (!_logPath) return;
  const ts = new Date().toISOString();
  fs.appendFile(_logPath, `[${ts}] ${msg}\n`, () => {});
}

module.exports = { init, writeLog };
