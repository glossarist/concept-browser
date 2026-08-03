import { describe, it, expect } from 'vitest';
import { RelatedConcept } from 'glossarist';
import { resolveRefTarget } from '../../adapters/GraphDataSource';

describe('GraphDataSource.resolveRefTarget — prefers native target field', () => {
  it('returns rc.target when set (cross-dataset resolved URI)', () => {
    const rc = new RelatedConcept({
      type: 'superseded_by',
      target: 'https://example.com/cie-2020/concept/17-21-097',
      ref: { source: 'CIE S 017:2020', id: '17-21-097' },
    });
    const target = resolveRefTarget(rc, 'https://example.com/cie-eilv', 'cie-2011', undefined);
    expect(target).toBe('https://example.com/cie-2020/concept/17-21-097');
  });

  it('falls back to ref resolution when target is null', () => {
    const rc = new RelatedConcept({
      type: 'supersedes',
      ref: { source: 'cie-2020', id: '42' },
    });
    const urnMap = new Map([['cie-2020', 'cie-2020']]);
    const target = resolveRefTarget(rc, 'https://example.com', 'cie-2011', urnMap);
    expect(target).toBe('https://example.com/cie-2020/concept/42');
  });

  it('returns empty string when neither target nor ref is set', () => {
    const rc = new RelatedConcept({ type: 'see' });
    const target = resolveRefTarget(rc, 'https://example.com', 'cie-2011', undefined);
    expect(target).toBe('');
  });
});