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

  const LEGACY_MULTIPLICITY_MAP: Record<string, { presence: string; count: string }> = {
    compulsory:               { presence: 'required', count: 'exactly_one' },
    optional:                 { presence: 'optional', count: 'exactly_one' },
    compulsory_multiple:      { presence: 'required', count: 'multiple' },
    optional_multiple:        { presence: 'optional', count: 'multiple' },
    compulsory_at_least_one:  { presence: 'required', count: 'at_least_one' },
  };

  const resolveConceptUri = (ref: any): string | null => {
    const source = ref?.['gl:source'] || ref?.source;
    const id = ref?.['gl:id'] || ref?.id;
    if (!source || !id) return null;
    const reg = urnMap.get(source) || source;
    return `${uriBase}/${reg}/concept/${id}`;
  };

  const resolvePresence = (member: any): 'required' | 'optional' => {
    const p = member['gl:presence'] ?? member.presence;
    if (p === 'required' || p === 'optional') return p as 'required' | 'optional';
    const multiplicity = member['gl:multiplicity'] ?? member.multiplicity;
    if (typeof multiplicity === 'string' && LEGACY_MULTIPLICITY_MAP[multiplicity]) {
      return LEGACY_MULTIPLICITY_MAP[multiplicity].presence as 'required' | 'optional';
    }
    const certainty = member['gl:certainty'] ?? member.certainty;
    return certainty === 'possible' ? 'optional' : 'required';
  };

  const resolveCount = (member: any): 'exactly_one' | 'at_least_one' | 'multiple' => {
    const c = member['gl:count'] ?? member.count;
    if (c === 'exactly_one' || c === 'at_least_one' || c === 'multiple') {
      return c as 'exactly_one' | 'at_least_one' | 'multiple';
    }
    const multiplicity = member['gl:multiplicity'] ?? member.multiplicity;
    if (typeof multiplicity === 'string' && LEGACY_MULTIPLICITY_MAP[multiplicity]) {
      return LEGACY_MULTIPLICITY_MAP[multiplicity].count as 'exactly_one' | 'at_least_one' | 'multiple';
    }
    return 'exactly_one';
  };

  for (const rel of concept['gl:partitiveRelations'] || []) {
    const comprehensive = resolveConceptUri(rel['gl:comprehensive']);
    if (!comprehensive) continue;

    const partitives = (rel['gl:hasPartitive'] || [])
      .map((member: any) => {
        const memberRef = member['gl:ref'] || member;
        const uri = resolveConceptUri(memberRef);
        if (!uri || uri === sourceUri) return null;
        return {
          uri,
          presence: resolvePresence(member),
          count: resolveCount(member),
          isDelimiting: member['gl:isDelimiting'] === true || member.isDelimiting === true,
        };
      })
      .filter((p: any): p is { uri: string; presence: 'required' | 'optional'; count: 'exactly_one' | 'at_least_one' | 'multiple'; isDelimiting: boolean } => p !== null);

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

describe('extractPartitiveRelations (MECE presence × count)', () => {
  const uriBase = 'https://example.org';
  const urnMap = new Map([['urn:vim:pub:v:2:2012', 'vim-2012']]);
  const registerId = 'vim-2012';
  const sourceUri = `${uriBase}/${registerId}/concept/1.3`;

  it('extracts a complete relation with two required/exactly_one members', () => {
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
      { uri: `${uriBase}/${registerId}/concept/1.4`, presence: 'required', count: 'exactly_one', isDelimiting: false },
      { uri: `${uriBase}/${registerId}/concept/1.5`, presence: 'required', count: 'exactly_one', isDelimiting: false },
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

  it('reads per-member presence + count + isDelimiting (v3 native)', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' } },
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.5' }, 'gl:presence': 'optional' },
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.6' }, 'gl:count': 'multiple' },
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.7' }, 'gl:count': 'at_least_one', 'gl:isDelimiting': true },
          ],
        },
      ],
    };
    const [rel] = extractPartitiveRelations(concept, registerId, uriBase, urnMap);
    expect(rel.partitives).toEqual([
      { uri: `${uriBase}/${registerId}/concept/1.4`, presence: 'required', count: 'exactly_one', isDelimiting: false },
      { uri: `${uriBase}/${registerId}/concept/1.5`, presence: 'optional', count: 'exactly_one', isDelimiting: false },
      { uri: `${uriBase}/${registerId}/concept/1.6`, presence: 'required', count: 'multiple', isDelimiting: false },
      { uri: `${uriBase}/${registerId}/concept/1.7`, presence: 'required', count: 'at_least_one', isDelimiting: true },
    ]);
  });

  it('migrates legacy gl:multiplicity into presence + count (one-release compat)', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveRelations': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPartitive': [
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' }, 'gl:multiplicity': 'optional_multiple' },
            { 'gl:ref': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.5' }, 'gl:multiplicity': 'compulsory_at_least_one' },
          ],
        },
      ],
    };
    const [rel] = extractPartitiveRelations(concept, registerId, uriBase, urnMap);
    expect(rel.partitives).toEqual([
      { uri: `${uriBase}/${registerId}/concept/1.4`, presence: 'optional', count: 'multiple', isDelimiting: false },
      { uri: `${uriBase}/${registerId}/concept/1.5`, presence: 'required', count: 'at_least_one', isDelimiting: false },
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
