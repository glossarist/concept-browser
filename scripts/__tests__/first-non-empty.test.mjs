import { describe, it, expect } from 'vitest';
import { firstNonEmpty } from '../lib/first-non-empty.mjs';

describe('firstNonEmpty — register-wins resolution', () => {
  it('returns the first value when both are present (register wins)', () => {
    expect(firstNonEmpty('reg-value', 'ds-value')).toBe('reg-value');
  });

  it('falls through to site-config when register value is null', () => {
    expect(firstNonEmpty(null, 'ds-value')).toBe('ds-value');
  });

  it('falls through to site-config when register value is undefined', () => {
    expect(firstNonEmpty(undefined, 'ds-value')).toBe('ds-value');
  });

  it('falls through to site-config when register value is empty string', () => {
    expect(firstNonEmpty('', 'ds-value')).toBe('ds-value');
  });

  it('falls through to site-config when register value is empty array', () => {
    expect(firstNonEmpty([], ['ds-tag'])).toEqual(['ds-tag']);
  });

  it('returns the first value when site-config is empty', () => {
    expect(firstNonEmpty('reg-value', '')).toBe('reg-value');
    expect(firstNonEmpty('reg-value', null)).toBe('reg-value');
    expect(firstNonEmpty('reg-value', undefined)).toBe('reg-value');
  });

  it('returns the first value when register is array and site-config is empty', () => {
    expect(firstNonEmpty(['reg'], [])).toEqual(['reg']);
  });

  it('returns the default when both are absent', () => {
    expect(firstNonEmpty(null, undefined, 'default')).toBe('default');
  });

  it('returns undefined when no arguments are non-empty', () => {
    expect(firstNonEmpty(null, undefined, '', [])).toBeUndefined();
  });

  it('returns undefined when called with no arguments', () => {
    expect(firstNonEmpty()).toBeUndefined();
  });

  it('does not skip falsy but meaningful values (e.g. 0, false)', () => {
    expect(firstNonEmpty(0, 1)).toBe(0);
    expect(firstNonEmpty(false, true)).toBe(false);
  });
});
