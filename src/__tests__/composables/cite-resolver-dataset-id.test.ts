import { describe, it, expect } from 'vitest';

/**
 * Tests for citeResolver DATASET:ID matching logic.
 *
 * The citeResolver must parse {{cite:IEV:702-02-07}} and match it
 * against sources that have:
 *   - id: "702-02-07" (the ID part)
 *   - origin.ref: { source: "IEV", id: "702-02-07" }
 *
 * Previously, it only matched s.id === key, so "IEV:702-02-07"
 * never matched source.id "702-02-07".
 */

interface SourceLike {
  id: string | null;
  origin?: {
    ref?: { source?: string; id?: string } | null;
    link?: string | null;
  } | null;
}

function findSource(key: string, sources: SourceLike[]): SourceLike | undefined {
  const lastColon = key.lastIndexOf(':');
  const idPart = lastColon > 0 ? key.slice(lastColon + 1) : key;
  const datasetPart = lastColon > 0 ? key.slice(0, lastColon) : '';

  return sources.find(s => {
    if (s.id === key || s.id === idPart) return true;
    const ref = s.origin?.ref;
    if (ref) {
      if (datasetPart && ref.source === datasetPart && ref.id === idPart) return true;
      if (ref.id === key || ref.id === idPart) return true;
    }
    return false;
  });
}

describe('citeResolver DATASET:ID matching', () => {
  const sources: SourceLike[] = [
    { id: null, origin: { ref: { source: 'IEV', id: '845-01-01' }, link: 'https://electropedia.org/...' } },
    { id: '845-01-01', origin: { ref: { source: 'IEV', id: '845-01-01' }, link: 'https://electropedia.org/...' } },
    { id: '702-02-07', origin: { ref: { source: 'IEV', id: '702-02-07' }, link: 'https://electropedia.org/...' } },
    { id: null, origin: { ref: { source: 'CIE S 017:2011', id: '17-370' } } },
  ];

  it('matches cite:IEV:845-01-01 via origin.ref', () => {
    const s = findSource('IEV:845-01-01', sources);
    expect(s).toBeDefined();
    expect(s!.origin!.ref!.id).toBe('845-01-01');
  });

  it('matches cite:IEV:702-02-07 via source id', () => {
    const s = findSource('IEV:702-02-07', sources);
    expect(s).toBeDefined();
    expect(s!.id).toBe('702-02-07');
  });

  it('matches cite:845-01-01 (bare ID without dataset prefix)', () => {
    const s = findSource('845-01-01', sources);
    expect(s).toBeDefined();
  });

  it('matches cite with CIE dataset prefix', () => {
    const s = findSource('CIE S 017:2011:17-370', sources);
    expect(s).toBeDefined();
    expect(s!.origin!.ref!.id).toBe('17-370');
  });

  it('returns undefined for unknown source', () => {
    const s = findSource('UNKNOWN:999', sources);
    expect(s).toBeUndefined();
  });
});
