import { describe, it, expect } from 'vitest';
import { pickLocaleText, pickLocaleMap } from '../utils/locale';

describe('locale — fetchLocalizedString-backed resolution', () => {
  it('returns the requested locale when present', () => {
    const map = { eng: 'hello', fra: 'bonjour' };
    expect(pickLocaleText(map, 'fra')).toBe('bonjour');
  });

  it('falls back through the chain when the requested locale is missing', () => {
    const map = { eng: 'hello' };
    expect(pickLocaleText(map, 'fra', ['eng'])).toBe('hello');
  });

  it('falls back to the first available locale when nothing in the chain matches', () => {
    // Per the i18n-first invariant: never show nothing. If the user asks
    // for a locale that is missing AND the chain misses too, return the
    // first available locale's text rather than empty.
    expect(pickLocaleText({ deu: 'hallo' }, 'fra', ['eng'])).toBe('hallo');
  });

  it('returns "" when the map is empty', () => {
    expect(pickLocaleText({}, 'fra', ['eng'])).toBe('');
  });

  it('returns null from pickLocaleMap when the map is empty', () => {
    expect(pickLocaleMap({}, 'fra', ['eng'])).toBeNull();
  });

  it('returns the resolved locale alongside the text', () => {
    const r = pickLocaleMap({ eng: 'hi', fra: 'salut' }, 'fra', ['eng']);
    expect(r).toEqual({ locale: 'fra', text: 'salut' });
  });

  it('returns null when map is undefined', () => {
    expect(pickLocaleMap(undefined, 'eng')).toBeNull();
    expect(pickLocaleText(undefined, 'eng')).toBe('');
  });

  it('passes the fallback chain explicitly (no internal fallback inside fetchLocalizedString)', () => {
    // fetchLocalizedString is called with null fallback for each locale
    // we try. The chain is owned by THIS module, not the leaf primitive.
    const map = { eng: 'hello', fra: 'salut' };
    expect(pickLocaleText(map, 'deu', ['fra', 'eng'])).toBe('salut');
  });
});
