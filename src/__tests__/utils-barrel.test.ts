import { describe, it, expect } from 'vitest';
import { DEFAULT_LANG } from '../utils/lang';
import { deduplicateSearchHits } from '../utils/search';

describe('DEFAULT_LANG single source', () => {
  it('exports "eng"', () => {
    expect(DEFAULT_LANG).toBe('eng');
  });
});

describe('deduplicateSearchHits export', () => {
  it('is a function', () => {
    expect(typeof deduplicateSearchHits).toBe('function');
  });
});
