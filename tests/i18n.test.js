import { describe, it, expect, vi, afterEach } from 'vitest';
import { I18N, t, detectSystemLang } from '../src/js/lib/i18n.js';

describe('t()', () => {
  it('returns translation for known key', () => {
    expect(t('nav_download')).toBe('Download');
  });

  it('falls back to the key itself for unknown keys', () => {
    expect(t('__no_such_key__')).toBe('__no_such_key__');
  });
});

describe('I18N', () => {
  it('contains all expected locale codes', () => {
    const expected = ['en', 'de', 'fr', 'es', 'it', 'pt', 'ru', 'zh', 'ja', 'ko',
      'ar', 'tr', 'pl', 'nl', 'sv', 'cs', 'da', 'el', 'fi', 'hr',
      'hu', 'id', 'nb', 'ro', 'sk', 'th', 'uk', 'vi', 'pt-BR', 'zh-TW'];
    for (const code of expected) {
      expect(I18N, `missing locale: ${code}`).toHaveProperty(code);
    }
  });

  it('every locale defines nav_download', () => {
    for (const [code, locale] of Object.entries(I18N)) {
      expect(locale, `${code} missing nav_download`).toHaveProperty('nav_download');
    }
  });
});

describe('detectSystemLang()', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('returns exact match for known 2-char locale', () => {
    vi.stubGlobal('navigator', { language: 'de' });
    expect(detectSystemLang()).toBe('de');
  });

  it('matches full locale pt-BR', () => {
    vi.stubGlobal('navigator', { language: 'pt-BR' });
    expect(detectSystemLang()).toBe('pt-BR');
  });

  it('matches full locale zh-TW', () => {
    vi.stubGlobal('navigator', { language: 'zh-TW' });
    expect(detectSystemLang()).toBe('zh-TW');
  });

  it('falls back to 2-char when region is unknown (fr-CA → fr)', () => {
    vi.stubGlobal('navigator', { language: 'fr-CA' });
    expect(detectSystemLang()).toBe('fr');
  });

  it('falls back to en for unsupported locale', () => {
    vi.stubGlobal('navigator', { language: 'xx' });
    expect(detectSystemLang()).toBe('en');
  });

  it('falls back to en when navigator.language is missing', () => {
    vi.stubGlobal('navigator', {});
    expect(detectSystemLang()).toBe('en');
  });
});
