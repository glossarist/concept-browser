import { describe, it, expect } from 'vitest';
import { normalizeBibliography } from '../lib/bibliography.mjs';

describe('normalizeBibliography', () => {
  it('wraps a bare array into { bibliography: [...] }', () => {
    const entries = [{ id: 'OIML B003:2003', reference: 'OIML B 3:2003' }];
    expect(normalizeBibliography(entries)).toEqual({ bibliography: entries });
  });

  it('passes through an already-wrapped object', () => {
    const wrapped = { bibliography: [{ id: 'x' }] };
    expect(normalizeBibliography(wrapped)).toBe(wrapped);
  });

  it('returns empty wrapper for null/undefined', () => {
    expect(normalizeBibliography(null)).toEqual({ bibliography: [] });
    expect(normalizeBibliography(undefined)).toEqual({ bibliography: [] });
  });

  it('returns empty wrapper for non-array, non-bibliography shapes', () => {
    expect(normalizeBibliography({})).toEqual({ bibliography: [] });
    expect(normalizeBibliography('not an array')).toEqual({ bibliography: [] });
  });

  it('preserves entry shape and order', () => {
    const entries = [
      { id: 'a', reference: 'A', title: 'First', link: 'https://a' },
      { id: 'b', reference: 'B' },
    ];
    const result = normalizeBibliography(entries);
    expect(result.bibliography).toHaveLength(2);
    expect(result.bibliography[0].id).toBe('a');
    expect(result.bibliography[1].id).toBe('b');
  });
});
