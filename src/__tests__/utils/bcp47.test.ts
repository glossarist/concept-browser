import { describe, it, expect } from 'vitest';
import {
  parseLangTag,
  formatLangTag,
  canonicalLangTag,
  isValidLangTag,
  mapIso6393To6391,
  mapIso6391To6393,
  isNfc,
  toNfc,
} from '../../utils/bcp47';
import { InvalidLangTagError } from '../../errors';

describe('parseLangTag', () => {
  it('maps ISO 639-3 codes to ISO 639-1', () => {
    expect(parseLangTag('eng').primary).toBe('en');
    expect(parseLangTag('fra').primary).toBe('fr');
    expect(parseLangTag('deu').primary).toBe('de');
  });

  it('passes through unknown 3-letter codes unchanged', () => {
    expect(parseLangTag('xxx').primary).toBe('xxx');
  });

  it('preserves ISO 639-1 codes', () => {
    expect(parseLangTag('en').primary).toBe('en');
    expect(parseLangTag('fr').primary).toBe('fr');
  });

  it('captures the script subtag', () => {
    const tag = parseLangTag('zh-Hant');
    expect(tag.script).toBe('Hant');
  });

  it('captures the region subtag (alpha-2)', () => {
    const tag = parseLangTag('en-US');
    expect(tag.region).toBe('US');
  });

  it('captures the region subtag (UN M.49 numeric)', () => {
    const tag = parseLangTag('zh-156');
    expect(tag.region).toBe('156');
  });

  it('captures variants', () => {
    const tag = parseLangTag('ca-ES-valencia');
    expect(tag.variants).toEqual(['valencia']);
  });

  it('captures private-use', () => {
    const tag = parseLangTag('en-x-foo-bar');
    expect(tag.privateUse).toEqual(['foo', 'bar']);
  });

  it('defaults multi-script languages to their primary script', () => {
    expect(parseLangTag('zho').script).toBe('Hans');
    expect(parseLangTag('srp').script).toBe('Cyrl');
    expect(parseLangTag('uzb').script).toBe('Latn');
  });

  it('keeps an explicitly-provided script over the default', () => {
    expect(parseLangTag('zho-Hant').script).toBe('Hant');
  });

  it('throws on invalid primary subtags', () => {
    expect(() => parseLangTag('')).toThrow(InvalidLangTagError);
    expect(() => parseLangTag('!@#')).toThrow(InvalidLangTagError);
  });

  it('throws on unrecognized subtag shapes', () => {
    expect(() => parseLangTag('en-***')).toThrow(InvalidLangTagError);
  });

  it('preserves the original input on the tag', () => {
    const tag = parseLangTag('eng-US');
    expect(tag.raw).toBe('eng-US');
  });
});

describe('formatLangTag', () => {
  it('joins subtags with hyphens', () => {
    const tag = parseLangTag('eng-Hant-US');
    expect(formatLangTag(tag)).toBe('en-Hant-US');
  });

  it('omits undefined subtags', () => {
    expect(formatLangTag(parseLangTag('eng'))).toBe('en');
  });

  it('emits private-use prefix', () => {
    expect(formatLangTag(parseLangTag('en-x-foo'))).toBe('en-x-foo');
  });

  it('emits variants inline', () => {
    expect(formatLangTag(parseLangTag('ca-valencia'))).toBe('ca-valencia');
  });
});

describe('canonicalLangTag', () => {
  it('canonicalizes ISO 639-3 codes to ISO 639-1', () => {
    expect(canonicalLangTag('eng')).toBe('en');
    expect(canonicalLangTag('fra')).toBe('fr');
    expect(canonicalLangTag('zho')).toBe('zh-Hans');
  });

  it('preserves script+region on canonical form', () => {
    expect(canonicalLangTag('zho-Hant-HK')).toBe('zh-Hant-HK');
  });

  it('is idempotent', () => {
    const once = canonicalLangTag('eng-Hant-US');
    expect(canonicalLangTag(once)).toBe(once);
  });
});

describe('isValidLangTag', () => {
  it('accepts well-formed tags', () => {
    expect(isValidLangTag('en')).toBe(true);
    expect(isValidLangTag('eng')).toBe(true);
    expect(isValidLangTag('zh-Hans-CN')).toBe(true);
    expect(isValidLangTag('en-x-foo')).toBe(true);
  });

  it('rejects malformed tags', () => {
    expect(isValidLangTag('')).toBe(false);
    expect(isValidLangTag('!!!')).toBe(false);
  });
});

describe('ISO 639 mapping', () => {
  it('maps 639-3 → 639-1', () => {
    expect(mapIso6393To6391('eng')).toBe('en');
    expect(mapIso6393To6391('fra')).toBe('fr');
    expect(mapIso6393To6391('xxx')).toBeNull();
  });

  it('maps 639-1 → 639-3', () => {
    expect(mapIso6391To6393('en')).toBe('eng');
    expect(mapIso6391To6393('fr')).toBe('fra');
    expect(mapIso6391To6393('xx')).toBeNull();
  });

  it('round-trips through both maps', () => {
    for (const code of ['en', 'fr', 'de', 'ja', 'ar', 'ru']) {
      const three = mapIso6391To6393(code)!;
      expect(mapIso6393To6391(three)).toBe(code);
    }
  });
});

describe('NFC utilities', () => {
  it('detects already-NFC strings', () => {
    expect(isNfc('hello')).toBe(true);
    expect(isNfc('atomic data unit')).toBe(true);
  });

  it('detects non-NFC strings', () => {
    const nfd = 'café'.normalize('NFD');
    expect(isNfc(nfd)).toBe(false);
  });

  it('normalizes non-NFC strings', () => {
    const nfd = 'café'.normalize('NFD');
    expect(toNfc(nfd)).toBe('café'.normalize('NFC'));
  });
});
