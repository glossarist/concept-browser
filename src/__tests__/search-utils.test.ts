import { describe, it, expect } from 'vitest';
import { deduplicateSearchHits, orderSearchHits } from '../utils/search';
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

  it('keeps the designation in the earlier priority language', () => {
    const fraHit = makeHit({ registerId: 'viml', conceptId: '1', language: 'fra' });
    const engHit = makeHit({ registerId: 'viml', conceptId: '1', language: 'eng' });

    const result = deduplicateSearchHits([fraHit, engHit], ['eng']);

    expect(result).toEqual([engHit]);
    expect(deduplicateSearchHits([engHit, fraHit], ['eng'])).toEqual([engHit]);
    expect(deduplicateSearchHits([fraHit, engHit])).toEqual([fraHit]);
    expect(deduplicateSearchHits([fraHit, engHit], ['eng', 'fra'])).toEqual([engHit]);
  });

  it('keeps the first designation when language tiers are equal', () => {
    const spaHit = makeHit({ registerId: 'viml', conceptId: '1', language: 'spa' });
    const deuHit = makeHit({ registerId: 'viml', conceptId: '1', language: 'deu' });

    const result = deduplicateSearchHits([spaHit, deuHit], ['eng', 'fra']);

    expect(result).toEqual([spaHit]);
  });

  it('keeps designation matches ahead of ID matches with language priorities', () => {
    const idHit = makeHit({ registerId: 'viml', conceptId: '1', matchField: 'id', language: 'eng' });
    const desHit = makeHit({ registerId: 'viml', conceptId: '1', matchField: 'designation', language: '' });

    expect(deduplicateSearchHits([idHit, desHit], ['eng'])).toEqual([desHit]);
  });
});

describe('orderSearchHits', () => {
  it('orders ID hits first, then configured languages, then one stable unlisted tier', () => {
    const hits = [
      makeHit({ conceptId: 'unlisted-a', language: 'ita' }),
      makeHit({ conceptId: 'fra', language: 'fra' }),
      makeHit({ conceptId: 'id', language: '', matchField: 'id' }),
      makeHit({ conceptId: 'spa', language: 'spa' }),
      makeHit({ conceptId: 'eng', language: 'eng' }),
      makeHit({ conceptId: 'unlisted-b', language: 'deu' }),
    ];

    const result = orderSearchHits(hits, ['eng', 'fra', 'spa']);

    expect(result.map(({ conceptId }) => conceptId)).toEqual([
      'id', 'eng', 'fra', 'spa', 'unlisted-a', 'unlisted-b',
    ]);
  });

  it('preserves incoming score and alphabetical order within each language tier without mutating input', () => {
    const fra = { ...makeHit({ conceptId: 'fra', language: 'fra' }), _score: 9 };
    const engHigh = { ...makeHit({ conceptId: 'eng-high', designation: 'zebra' }), _score: 8 };
    const spa = { ...makeHit({ conceptId: 'spa', language: 'spa' }), _score: 7 };
    const engAlpha = { ...makeHit({ conceptId: 'eng-alpha', designation: 'alpha' }), _score: 2 };
    const engBeta = { ...makeHit({ conceptId: 'eng-beta', designation: 'beta' }), _score: 2 };
    const hits = [fra, engHigh, spa, engAlpha, engBeta];
    const original = [...hits];

    const result = orderSearchHits(hits, ['eng']);

    expect(result).toEqual([engHigh, engAlpha, engBeta, fra, spa]);
    expect(hits).toEqual(original);
    expect(result).not.toBe(hits);
  });
});
