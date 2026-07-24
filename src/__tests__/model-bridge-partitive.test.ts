import { describe, it, expect } from 'vitest';
import { conceptFromJson } from '../adapters/model-bridge';

describe('conceptFromJson — gl:partitiveRelations (v2)', () => {
  function makeJson(overrides: Record<string, unknown> = {}) {
    return {
      '@type': 'gl:Concept',
      '@id': 'https://example.org/test/concept/1.3',
      'gl:identifier': '1.3',
      'gl:localizedConcept': {},
      ...overrides,
    };
  }

  it('returns empty array when no partitiveRelations', () => {
    const c = conceptFromJson(makeJson());
    expect(c.partitiveRelations).toEqual([]);
  });

  it('parses comprehensive + 2 partitives', () => {
    const c = conceptFromJson(makeJson({
      'gl:partitiveRelations': [{
        'gl:comprehensive': { 'gl:source': 'urn:test', 'gl:id': '1.3' },
        'gl:hasPartitive': [
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.4' } },
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.5' } },
        ],
      }],
    }));
    expect(c.partitiveRelations).toHaveLength(1);
    const r = c.partitiveRelations[0];
    expect(r.comprehensive.source).toBe('urn:test');
    expect(r.comprehensive.id).toBe('1.3');
    expect(r.partitives).toHaveLength(2);
    expect(r.partitives[0].ref.id).toBe('1.4');
    expect(r.partitives[1].ref.id).toBe('1.5');
  });

  it('parses completeness', () => {
    const c = conceptFromJson(makeJson({
      'gl:partitiveRelations': [{
        'gl:comprehensive': { 'gl:source': 'urn:test', 'gl:id': '1.3' },
        'gl:hasPartitive': [
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.4' } },
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.5' } },
        ],
        'gl:completeness': 'partial',
      }],
    }));
    expect(c.partitiveRelations[0].completeness).toBe('partial');
    expect(c.partitiveRelations[0].isPartial).toBe(true);
  });

  it('parses per-member certainty', () => {
    const c = conceptFromJson(makeJson({
      'gl:partitiveRelations': [{
        'gl:comprehensive': { 'gl:source': 'urn:test', 'gl:id': '1.3' },
        'gl:hasPartitive': [
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.4' } },
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.5' }, 'gl:certainty': 'possible' },
        ],
      }],
    }));
    const members = c.partitiveRelations[0].partitives;
    expect(members[0].certainty).toBe('confirmed');
    expect(members[1].certainty).toBe('possible');
    expect(members[1].isPossible).toBe(true);
  });

  it('parses plurality block', () => {
    const c = conceptFromJson(makeJson({
      'gl:partitiveRelations': [{
        'gl:comprehensive': { 'gl:source': 'urn:test', 'gl:id': '1.3' },
        'gl:hasPartitive': [
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.4' } },
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.5' } },
        ],
        'gl:hasPlurality': {
          'gl:isShared': true,
          'gl:isUncertain': true,
          'gl:sharedType': { 'gl:source': 'urn:test', 'gl:id': '1.99' },
        },
      }],
    }));
    const p = c.partitiveRelations[0].plurality;
    expect(p).not.toBeNull();
    expect(p?.isShared).toBe(true);
    expect(p?.isUncertain).toBe(true);
    expect(p?.sharedType?.id).toBe('1.99');
  });

  it('parses criterion as localized hash', () => {
    const c = conceptFromJson(makeJson({
      'gl:partitiveRelations': [{
        'gl:comprehensive': { 'gl:source': 'urn:test', 'gl:id': '1.3' },
        'gl:hasPartitive': [
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.4' } },
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.5' } },
        ],
        'gl:criterion': { eng: 'physical structure', fra: 'structure physique' },
      }],
    }));
    expect(c.partitiveRelations[0].criterion?.eng).toBe('physical structure');
    expect(c.partitiveRelations[0].criterion?.fra).toBe('structure physique');
  });

  it('parses criterion as plain string (normalized to default)', () => {
    const c = conceptFromJson(makeJson({
      'gl:partitiveRelations': [{
        'gl:comprehensive': { 'gl:source': 'urn:test', 'gl:id': '1.3' },
        'gl:hasPartitive': [
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.4' } },
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.5' } },
        ],
        'gl:criterion': 'a bare criterion string',
      }],
    }));
    expect(c.partitiveRelations[0].criterion?.default).toBe('a bare criterion string');
  });

  it('skips relation with no comprehensive', () => {
    const c = conceptFromJson(makeJson({
      'gl:partitiveRelations': [{
        'gl:hasPartitive': [
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.4' } },
        ],
      }],
    }));
    expect(c.partitiveRelations).toEqual([]);
  });

  it('skips relation with < 2 valid partitives', () => {
    const c = conceptFromJson(makeJson({
      'gl:partitiveRelations': [{
        'gl:comprehensive': { 'gl:source': 'urn:test', 'gl:id': '1.3' },
        'gl:hasPartitive': [
          { 'gl:ref': { 'gl:source': 'urn:test', 'gl:id': '1.4' } },
          // Single member — PartitiveRelation constructor throws
        ],
      }],
    }));
    // The constructor throws before we catch it, so the relation is dropped
    // via the runtime error path. conceptFromJson should not propagate.
    expect(c.partitiveRelations).toEqual([]);
  });
});
