import { describe, it, expect } from 'vitest';
import { normalizeBibliography } from '../lib/bibliography';

describe('normalizeBibliography', () => {
  it('wraps a bare array into { bibliography: [...] }', () => {
    const entries = [{ id: 'ISO1' }, { id: 'ISO2' }];
    expect(normalizeBibliography(entries)).toEqual({ bibliography: entries });
  });

  it('passes through an already-wrapped object', () => {
    const wrapped = { bibliography: [{ id: 'ISO1' }] };
    expect(normalizeBibliography(wrapped)).toBe(wrapped);
  });

  it('returns an empty wrapper for null/undefined', () => {
    expect(normalizeBibliography(null)).toEqual({ bibliography: [] });
    expect(normalizeBibliography(undefined)).toEqual({ bibliography: [] });
  });

  it('returns an empty wrapper for junk input (non-array, non-wrapped)', () => {
    expect(normalizeBibliography('string')).toEqual({ bibliography: [] });
    expect(normalizeBibliography(42)).toEqual({ bibliography: [] });
    expect(normalizeBibliography({ other: 'shape' })).toEqual({ bibliography: [] });
  });

  it('handles empty array input', () => {
    expect(normalizeBibliography([])).toEqual({ bibliography: [] });
  });
});
