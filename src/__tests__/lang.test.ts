import { describe, it, expect } from 'vitest';
import { langName, langLabel, DEFAULT_LANG } from '../utils/lang';

describe('langName', () => {
  it('returns name for known codes', () => {
    expect(langName('eng')).toBe('English');
    expect(langName('fra')).toBe('French');
    expect(langName('deu')).toBe('German');
    expect(langName('zho')).toBe('Chinese');
  });

  it('returns code as-is for unknown codes', () => {
    expect(langName('xyz')).toBe('xyz');
    expect(langName('abc')).toBe('abc');
  });
});

describe('langLabel', () => {
  it('uppercases the code', () => {
    expect(langLabel('eng')).toBe('ENG');
    expect(langLabel('fra')).toBe('FRA');
  });
});

describe('DEFAULT_LANG', () => {
  it('is eng', () => {
    expect(DEFAULT_LANG).toBe('eng');
  });
});
