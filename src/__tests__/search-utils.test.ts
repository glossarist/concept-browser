import { describe, it, expect } from 'vitest';
import { deduplicateSearchHits } from '../utils/search';
import type { SearchHit } from '../adapters/types';

function makeHit(overrides: Partial<SearchHit> = {}): SearchHit {
  return {
    conceptId: '1',
    registerId: 'test',
    designation: 'test',
    language: 'eng',
    matchField: 'designation',
    ...overrides,
  };
}

describe('deduplicateSearchHits', () => {
  it('returns empty array for empty input', () => {
    expect(deduplicateSearchHits([])).toEqual([]);
  });

  it('returns single hit unchanged', () => {
    const hit = makeHit();
    expect(deduplicateSearchHits([hit])).toEqual([hit]);
  });

  it('deduplicates by registerId:conceptId', () => {
    const hit1 = makeHit({ registerId: 'viml', conceptId: '1', designation: 'accuracy' });
    const hit2 = makeHit({ registerId: 'viml', conceptId: '1', designation: 'accuracy', language: 'fra' });

    const result = deduplicateSearchHits([hit1, hit2]);
    expect(result.length).toBe(1);
  });

  it('keeps designation match over id match for same concept', () => {
    const idHit = makeHit({ registerId: 'viml', conceptId: '1', matchField: 'id' });
    const desHit = makeHit({ registerId: 'viml', conceptId: '1', matchField: 'designation' });

    const result = deduplicateSearchHits([idHit, desHit]);
    expect(result.length).toBe(1);
    expect(result[0].matchField).toBe('designation');
  });

  it('keeps first designation match when both are designation', () => {
    const hit1 = makeHit({ registerId: 'viml', conceptId: '1', matchField: 'designation', language: 'eng' });
    const hit2 = makeHit({ registerId: 'viml', conceptId: '1', matchField: 'designation', language: 'fra' });

    const result = deduplicateSearchHits([hit1, hit2]);
    expect(result.length).toBe(1);
    expect(result[0].language).toBe('eng');
  });

  it('keeps hits from different datasets separate', () => {
    const hit1 = makeHit({ registerId: 'viml-2022', conceptId: '1' });
    const hit2 = makeHit({ registerId: 'viml-2013', conceptId: '1' });

    const result = deduplicateSearchHits([hit1, hit2]);
    expect(result.length).toBe(2);
  });
});
