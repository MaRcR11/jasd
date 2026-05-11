import { describe, it, expect } from 'vitest';
import {
  formatDuration,
  formatCount,
  formatDate,
  formatBytes,
  escHtml,
  formatTs,
} from '../src/js/lib/formatters.js';

describe('formatDuration', () => {
  it('formats mm:ss', () => expect(formatDuration(65)).toBe('1:05'));
  it('formats h:mm:ss', () => expect(formatDuration(3661)).toBe('1:01:01'));
  it('pads single-digit seconds', () => expect(formatDuration(9)).toBe('0:09'));
  it('handles zero', () => expect(formatDuration(0)).toBe('0:00'));
  it('handles exact hour', () => expect(formatDuration(3600)).toBe('1:00:00'));
});

describe('formatCount', () => {
  it('formats billions', () => expect(formatCount(1_500_000_000)).toBe('1.5B'));
  it('formats millions', () => expect(formatCount(2_500_000)).toBe('2.5M'));
  it('formats thousands', () => expect(formatCount(1_500)).toBe('1.5K'));
  it('formats small numbers as-is', () => expect(formatCount(999)).toBe('999'));
});

describe('formatDate', () => {
  it('formats YYYYMMDD string', () => expect(formatDate('20260511')).toBe('2026-05-11'));
  it('returns empty string for short input', () => expect(formatDate('123')).toBe(''));
  it('returns empty string for empty input', () => expect(formatDate('')).toBe(''));
  it('returns empty string for null', () => expect(formatDate(null)).toBe(''));
});

describe('formatBytes', () => {
  it('formats GB', () => expect(formatBytes(2 * 1024 ** 3)).toBe('2.0 GB'));
  it('formats MB', () => expect(formatBytes(2 * 1024 ** 2)).toBe('2.0 MB'));
  it('formats KB', () => expect(formatBytes(2 * 1024)).toBe('2.0 KB'));
  it('formats bytes', () => expect(formatBytes(512)).toBe('512 B'));
  it('returns empty string for falsy', () => expect(formatBytes(0)).toBe(''));
});

describe('escHtml', () => {
  it('escapes < and >', () => expect(escHtml('<div>')).toBe('&lt;div&gt;'));
  it('escapes &', () => expect(escHtml('a&b')).toBe('a&amp;b'));
  it('escapes "', () => expect(escHtml('"hi"')).toBe('&quot;hi&quot;'));
  it('leaves safe strings unchanged', () => expect(escHtml('hello world')).toBe('hello world'));
  it('coerces non-string input', () => expect(escHtml(42)).toBe('42'));
});

describe('formatTs', () => {
  it('returns non-empty string for valid ISO date', () =>
    expect(formatTs('2026-05-11T12:00:00Z').length).toBeGreaterThan(0));
  it('returns empty string for null', () => expect(formatTs(null)).toBe(''));
  it('returns empty string for empty string', () => expect(formatTs('')).toBe(''));
});
