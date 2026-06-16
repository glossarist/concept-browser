import { describe, it, expect } from 'vitest';
import { getGroups } from '../lib/concept-groups.mjs';

describe('getGroups', () => {
  it('returns explicit eng.groups when present', () => {
    expect(getGroups({ eng: { groups: ['g1', 'g2'] }, termid: 1 })).toEqual(['g1', 'g2']);
  });

  it('derives groups from _domains with ref_type=section', () => {
    expect(getGroups({
      termid: 1,
      _domains: [
        { ref_type: 'section', concept_id: 'section-102-01' },
        { ref_type: 'section', concept_id: 'section-102-02' },
      ],
    })).toEqual(['102-01', '102-02']);
  });

  it('ignores _domains entries without ref_type=section', () => {
    expect(getGroups({
      termid: 1,
      _domains: [
        { ref_type: 'other', concept_id: 'x' },
        { ref_type: 'section', concept_id: 'section-103' },
      ],
    })).toEqual(['103']);
  });

  it('falls through when _domains has no section entries', () => {
    expect(getGroups({
      termid: '103-01-02',
      _domains: [{ ref_type: 'other', concept_id: 'x' }],
    })).toEqual(['103']);
  });

  it('derives group from termid with NNN- prefix (e.g. IEV)', () => {
    expect(getGroups({ termid: '103-01-02' })).toEqual(['103']);
  });

  it('derives group from dotted termid (e.g. VIM)', () => {
    expect(getGroups({ termid: '1.2.3.4' })).toEqual(['1.2.3']);
  });

  it('returns empty array when no derivation matches', () => {
    expect(getGroups({ termid: 'abc' })).toEqual([]);
  });

  it('returns empty array when termid is missing', () => {
    expect(getGroups({})).toEqual([]);
  });
});
