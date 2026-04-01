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

async function readJSONAsync(p, fallback) {
  try {
    const raw = await fs.promises.readFile(p, 'utf8');
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

async function writeJSONAsync(p, data) {
  try {
    // No pretty-print — compact output is faster to stringify and smaller on disk
    await fs.promises.writeFile(p, JSON.stringify(data));
  } catch (e) {
    writeLog('ERROR writeJSONAsync: ' + e.message);
  }
}

function writeJSON(p, data) {
  try {
    fs.writeFileSync(p, JSON.stringify(data));
  } catch (e) {
    writeLog('ERROR writeJSON: ' + e.message);
  }
}

module.exports = { readJSON, readJSONAsync, writeJSON, writeJSONAsync };
