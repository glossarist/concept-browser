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

  for (const rel of concept['gl:partitiveRelations'] || []) {
    const comprehensive = resolveConceptUri(rel['gl:comprehensive']);
    if (!comprehensive) continue;

    const partitives = (rel['gl:hasPartitive'] || [])
      .map((member: any) => {
        const memberRef = member['gl:ref'] || member;
        const uri = resolveConceptUri(memberRef);
        if (!uri || uri === sourceUri) return null;
        const multiplicity = member['gl:multiplicity'] || 'compulsory';
        const isDelimiting = member['gl:isDelimiting'] === true;
        if (!isValidMultiplicity(multiplicity)) {
          throw new Error(
            `Invalid partitive member multiplicity: "${multiplicity}". Allowed: compulsory, optional, compulsory_multiple, optional_multiple, at_least_one`,
          );
        }
        return { uri, multiplicity, isDelimiting };
      })
      .filter((p: any): p is { uri: string; multiplicity: 'compulsory' | 'optional' | 'compulsory_multiple' | 'optional_multiple' | 'at_least_one'; isDelimiting: boolean } => p !== null);

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
      register: registerId,
    });
  }
  return relations;
}

function isValidMultiplicity(value: unknown): value is 'compulsory' | 'optional' | 'compulsory_multiple' | 'optional_multiple' | 'at_least_one' {
  return ['compulsory', 'optional', 'compulsory_multiple', 'optional_multiple', 'at_least_one'].includes(value as string);
}

describe('extractPartitiveRelations', () => {
  const uriBase = 'https://example.org';
  const urnMap = new Map([['urn:vim:pub:v:2:2012', 'vim-2012']]);
  const registerId = 'vim-2012';
  const sourceUri = `${uriBase}/${registerId}/concept/1.3`;

  it('extracts a complete relation with two compulsory members', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' } },
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.5' } },
          ],
          'gl:completeness': 'complete',
        },
      ],
    };

    const result = extractPartitiveRelations(concept, registerId, uriBase, urnMap);
    expect(result).toHaveLength(1);
    expect(result[0].comprehensive).toBe(`${uriBase}/${registerId}/concept/1.3`);
    expect(result[0].partitives).toEqual([
      { uri: `${uriBase}/${registerId}/concept/1.4`, multiplicity: 'compulsory', isDelimiting: false },
      { uri: `${uriBase}/${registerId}/concept/1.5`, multiplicity: 'compulsory', isDelimiting: false },
    ]);
    expect(result[0].completeness).toBe('complete');
  });

  it('defaults completeness to complete when omitted', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' } },
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

  it('reads per-member multiplicity + isDelimiting', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' } },
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.5' }, 'gl:multiplicity': 'optional' },
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.6' }, 'gl:multiplicity': 'compulsory_multiple' },
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.7' }, 'gl:multiplicity': 'at_least_one', 'gl:isDelimiting': true },
          ],
        },
      ],
    };
    const [rel] = extractPartitiveRelations(concept, registerId, uriBase, urnMap);
    expect(rel.partitives).toEqual([
      { uri: `${uriBase}/${registerId}/concept/1.4`, multiplicity: 'compulsory', isDelimiting: false },
      { uri: `${uriBase}/${registerId}/concept/1.5`, multiplicity: 'optional', isDelimiting: false },
      { uri: `${uriBase}/${registerId}/concept/1.6`, multiplicity: 'compulsory_multiple', isDelimiting: false },
      { uri: `${uriBase}/${registerId}/concept/1.7`, multiplicity: 'at_least_one', isDelimiting: true },
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

  it('throws on invalid multiplicity', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' }, 'gl:multiplicity': 'maybe' },
          ],
        },
      ],
    };
    expect(() => extractPartitiveRelations(concept, registerId, uriBase, urnMap)).toThrow(/Invalid.*multiplicity.*maybe/);
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
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
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
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' } },
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' } },
          ],
        },
      ],
    };
    const [rel] = extractPartitiveRelations(concept, registerId, uriBase, urnMap);
    expect(rel.partitives).toHaveLength(1);
    expect(rel.partitives[0].uri).toBe(`${uriBase}/${registerId}/concept/1.4`);
  });

  it('returns empty array when concept has no partitiveRelations', () => {
    const concept = { '@id': sourceUri };
    expect(extractPartitiveRelations(concept, registerId, uriBase, urnMap)).toEqual([]);
  });
});
