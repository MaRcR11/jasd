import { describe, it, expect, afterEach } from 'vitest';
import { createRequire } from 'module';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const require = createRequire(import.meta.url);
const { readJSON, writeJSON } = require('../src/browser/utils/storage.js');

let tmpDir;

afterEach(() => {
  if (tmpDir && existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  tmpDir = null;
});

describe('readJSON', () => {
  it('returns fallback for non-existent path', () => {
    expect(readJSON('/no/such/file.json', 'fallback')).toBe('fallback');
  });

  it('returns fallback for corrupt JSON', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'jasd-test-'));
    const p = join(tmpDir, 'bad.json');
    require('fs').writeFileSync(p, 'not json');
    expect(readJSON(p, null)).toBeNull();
  });

  it('parses valid JSON', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'jasd-test-'));
    const p = join(tmpDir, 'data.json');
    require('fs').writeFileSync(p, JSON.stringify({ key: 'value' }));
    expect(readJSON(p, null)).toEqual({ key: 'value' });
  });
});

describe('writeJSON + readJSON round-trip', () => {
  it('persists and restores data', () => {
    tmpDir = mkdtempSync(join(tmpdir(), 'jasd-test-'));
    const p = join(tmpDir, 'settings.json');
    const data = { lang: 'de', theme: 'dark', maxConcurrent: 3 };
    writeJSON(p, data);
    expect(readJSON(p, null)).toEqual(data);
  });
});
