'use strict';
const fs = require('fs');
const { writeLog } = require('./logger');

function readJSON(p, fallback) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJSON(p, data) {
  try {
    fs.writeFileSync(p, JSON.stringify(data, null, 2));
  } catch (e) {
    writeLog('ERROR writeJSON: ' + e.message);
  }
}

module.exports = { readJSON, writeJSON };
