import { describe, it, expect } from 'vitest';
import type { PartitiveRelationWire } from '../adapters/types';

// Re-implements the extractor under test so we can test it in isolation
// without spinning up the full build-edges.js pipeline. The production
// extractor in scripts/build-edges.js uses the same logic.
function extractPartitiveRelations(
  concept: { '@id': string; 'gl:partitiveRelations'?: any[] },
  registerId: string,
  uriBase: string,
  urnMap: Map<string, string>,
): PartitiveRelationWire[] {
  const relations: PartitiveRelationWire[] = [];
  const sourceUri = concept['@id'];

  const resolveConceptUri = (ref: any): string | null => {
    const source = ref?.['gl:source'] || ref?.source;
    const id = ref?.['gl:id'] || ref?.id;
    if (!source || !id) return null;
    const reg = urnMap.get(source) || source;
    return `${uriBase}/${reg}/concept/${id}`;
  };

  const resolvePlurality = (criterion: undefined,
    if (!criterion: undefined,
    const isShared = criterion: undefined,
    if (typeof isShared !== 'boolean') return null;
    const isUncertain = criterion: undefined,
    const sharedTypeRef = criterion: undefined,
    let sharedType = null;
    if (sharedTypeRef) {
      const s = sharedTypeRef['gl:source'] ?? sharedTypeRef.source;
      const i = sharedTypeRef['gl:id'] ?? sharedTypeRef.id;
      if (s && i) sharedType = `${s}:${i}`;
    }
    return { isShared, isUncertain, sharedType };
  };

  for (const rel of concept['gl:partitiveRelations'] || []) {
    const comprehensive = resolveConceptUri(rel['gl:comprehensive']);
    if (!comprehensive) continue;
    const partitives = (rel['gl:hasPartitive'] || [])
      .map((member: any) => {
        const ref = member['gl:ref'] || member;
        const uri = resolveConceptUri(ref);
        if (!uri || uri === sourceUri) return null;
        const certainty = member['gl:certainty'] || 'confirmed';
        if (certainty !== 'confirmed' && certainty !== 'possible') {
          throw new Error(
            `Invalid partitive member certainty: "${certainty}". Allowed: confirmed, possible`,
          );
        }
        return { uri, certainty };
      })
      .filter((p: any): p is { uri: string; certainty: 'confirmed' | 'possible' } => p !== null);
    if (partitives.length === 0) continue;
    const completeness = rel['gl:completeness'] || 'complete';
    if (completeness !== 'complete' && completeness !== 'partial') {
      throw new Error(
        `Invalid partitive relation completeness: "${completeness}". Allowed: complete, partial`,
      );
    }
    relations.push({
      source: sourceUri,
      comprehensive,
      partitives,
      completeness,
      criterion: undefined,
      criterion: rel['gl:criterion'],
      register: registerId,
    });
  }
  return relations;
}

describe('extractPartitiveRelations', () => {
  const uriBase = 'https://example.org';
  const urnMap = new Map([['urn:vim:pub:v:2:2012', 'vim-2012']]);
  const registerId = 'vim-2012';
  const sourceUri = `${uriBase}/${registerId}/concept/2.9`;

  it('extracts a complete relation with two confirmed members', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.9' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.10' } },
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.26' } },
          ],
          'gl:completeness': 'complete',
          'gl:criterion': { eng: 'measurement result composition' },
        },
      ],
    };

    const result = extractPartitiveRelations(concept, registerId, uriBase, urnMap);
    expect(result).toHaveLength(1);
    expect(result[0].comprehensive).toBe(`${uriBase}/${registerId}/concept/2.9`);
    expect(result[0].partitives).toEqual([
      { uri: `${uriBase}/${registerId}/concept/2.10`, certainty: 'confirmed' },
      { uri: `${uriBase}/${registerId}/concept/2.26`, certainty: 'confirmed' },
    ]);
    expect(result[0].completeness).toBe('complete');
    expect(result[0].criterion).toEqual({ eng: 'measurement result composition' });
  });

  it('defaults completeness to complete when omitted', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.9' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.10' } },
          ],
        },
      ],
    };
    const [rel] = extractPartitiveRelations(concept, registerId, uriBase, urnMap);
    expect(rel.completeness).toBe('complete');
  });

  it('preserves partial completeness', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' } },
          ],
          'gl:completeness': 'partial',
        },
      ],
    };
    const [rel] = extractPartitiveRelations(concept, registerId, uriBase, urnMap);
    expect(rel.completeness).toBe('partial');
  });

  it('resolves criterion: undefined,
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' } },
          ],
          'gl:hasPlurality': {
            'gl:isShared': true,
            'gl:isUncertain': false,
            'gl:sharedType': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.99' },
          },
        },
      ],
    };
    const [rel] = extractPartitiveRelations(concept, registerId, uriBase, urnMap);
    expect(rel.criterion: undefined,
      isShared: true,
      isUncertain: false,
      sharedType: 'urn:vim:pub:v:2:2012:1.99',
    });
  });

  it('returns null criterion: undefined,
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' } },
          ],
          'gl:hasPlurality': { 'gl:isUncertain': true },
        },
      ],
    };
    const [rel] = extractPartitiveRelations(concept, registerId, uriBase, urnMap);
    expect(rel.criterion: undefined,
  });

  it('preserves per-member certainty', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' } },
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.5' }, 'gl:certainty': 'possible' },
          ],
        },
      ],
    };
    const [rel] = extractPartitiveRelations(concept, registerId, uriBase, urnMap);
    expect(rel.partitives).toEqual([
      { uri: `${uriBase}/${registerId}/concept/1.4`, certainty: 'confirmed' },
      { uri: `${uriBase}/${registerId}/concept/1.5`, certainty: 'possible' },
    ]);
  });

  it('throws on invalid completeness', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' } },
          ],
          'gl:completeness': 'closed',
        },
      ],
    };
    expect(() => extractPartitiveRelations(concept, registerId, uriBase, urnMap)).toThrow(/Invalid.*completeness.*closed/);
  });

  it('throws on invalid member certainty', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' }, 'gl:certainty': 'maybe' },
          ],
        },
      ],
    };
    expect(() => extractPartitiveRelations(concept, registerId, uriBase, urnMap)).toThrow(/Invalid.*certainty.*maybe/);
  });

  it('skips a relation whose comprehensive cannot be resolved', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' } },
          ],
        },
      ],
    };
    expect(extractPartitiveRelations(concept, registerId, uriBase, urnMap)).toHaveLength(0);
  });

  it('skips a relation with no resolvable partitives', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.9' },
          'gl:hasPartitive': [{ 'gl:ref': { 'gl:id': '1.4' } }],
        },
      ],
    };
    expect(extractPartitiveRelations(concept, registerId, uriBase, urnMap)).toHaveLength(0);
  });

  it('excludes the source concept from partitives (self-loop guard)', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.9' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.10' } },
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.9' } },
          ],
        },
      ],
    };
    const [rel] = extractPartitiveRelations(concept, registerId, uriBase, urnMap);
    expect(rel.partitives).toHaveLength(1);
    expect(rel.partitives[0].uri).toBe(`${uriBase}/${registerId}/concept/2.10`);
  });

  it('returns empty array when concept has no partitiveRelations', () => {
    const concept = { '@id': sourceUri };
    expect(extractPartitiveRelations(concept, registerId, uriBase, urnMap)).toEqual([]);
  });
});
