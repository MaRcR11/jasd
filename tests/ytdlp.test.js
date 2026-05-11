import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { _parseVer, _isNewer } = require('../src/browser/utils/ytdlp.js');

describe('_parseVer', () => {
  it('parses a standard yt-dlp version', () =>
    expect(_parseVer('2025.12.31')).toEqual([2025, 12, 31]));
  it('parses a patched version', () =>
    expect(_parseVer('2025.12.31.1')).toEqual([2025, 12, 31, 1]));
  it('returns [0] for empty string (treated as oldest version)', () =>
    expect(_parseVer('')).toEqual([0]));
  it('returns [0] for null (treated as oldest version)', () =>
    expect(_parseVer(null)).toEqual([0]));
});

describe('_isNewer', () => {
  it('returns true when A is a newer year', () =>
    expect(_isNewer('2026.01.01', '2025.12.31')).toBe(true));
  it('returns true when A is a newer month', () =>
    expect(_isNewer('2025.06.01', '2025.05.31')).toBe(true));
  it('returns true when A is a newer day', () =>
    expect(_isNewer('2025.05.15', '2025.05.14')).toBe(true));
  it('returns true when A has a newer patch segment', () =>
    expect(_isNewer('2025.05.14.2', '2025.05.14.1')).toBe(true));
  it('returns false when A is older', () =>
    expect(_isNewer('2025.01.01', '2025.06.01')).toBe(false));
  it('returns false when versions are equal', () =>
    expect(_isNewer('2025.05.14', '2025.05.14')).toBe(false));
  it('returns false when A has no patch but B does', () =>
    expect(_isNewer('2025.05.14', '2025.05.14.1')).toBe(false));
  it('bundled wins a tie (caller selects bundled when not newer)', () =>
    expect(_isNewer('2025.05.14', '2025.05.14')).toBe(false));
});
