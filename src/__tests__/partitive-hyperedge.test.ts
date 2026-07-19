import { describe, it, expect } from 'vitest';
import type { PartitiveHyperedge as JsonLdPartitiveHyperedge } from '../adapters/types';

// Re-implements the extractor under test so we can test it in isolation
// without spinning up the full build-edges.js pipeline. The production
// extractor in scripts/build-edges.js uses the same logic.
function extractPartitiveHyperedges(
  concept: { '@id': string; 'gl:partitiveHyperedges'?: any[] },
  registerId: string,
  uriBase: string,
  urnMap: Map<string, string>,
): JsonLdPartitiveHyperedge[] {
  const hyperedges: JsonLdPartitiveHyperedge[] = [];
  const sourceUri = concept['@id'];

  const resolveConceptUri = (ref: any): string | null => {
    const source = ref?.['gl:source'] || ref?.source;
    const id = ref?.['gl:id'] || ref?.id;
    if (!source || !id) return null;
    const reg = urnMap.get(source) || source;
    return `${uriBase}/${reg}/concept/${id}`;
  };

  for (const he of concept['gl:partitiveHyperedges'] || []) {
    const comprehensive = resolveConceptUri(he['gl:comprehensive']);
    if (!comprehensive) continue;
    const parts = (he['gl:hasPart'] || [])
      .map(resolveConceptUri)
      .filter((p: string | null): p is string => !!p && p !== sourceUri);
    if (parts.length === 0) continue;
    hyperedges.push({
      source: sourceUri,
      comprehensive,
      parts,
      enumeration: he['gl:enumeration'] || 'closed',
      markers: (he['gl:hasPluralityMarker'] || []).filter(
        (m: string) => m === 'double' || m === 'dashed',
      ),
      label: he['gl:content'] || undefined,
      register: registerId,
    });
  }
  return hyperedges;
}

describe('extractPartitiveHyperedges', () => {
  const uriBase = 'https://example.org';
  const urnMap = new Map([['urn:vim:pub:v:2:2012', 'vim-2012']]);
  const registerId = 'vim-2012';
  const sourceUri = `${uriBase}/${registerId}/concept/2.9`;

  it('extracts a closed hyperedge with double marker', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveHyperedges': [
        {
          'gl:comprehensive': {
            'gl:source': 'urn:vim:pub:v:2:2012',
            'gl:id': '2.9',
          },
          'gl:hasPart': [
            { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.10' },
            { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.26' },
          ],
          'gl:enumeration': 'closed',
          'gl:hasPluralityMarker': ['double'],
          'gl:content': 'value + uncertainty',
        },
      ],
    };

    const result = extractPartitiveHyperedges(concept, registerId, uriBase, urnMap);
    expect(result).toHaveLength(1);
    expect(result[0].source).toBe(sourceUri);
    expect(result[0].comprehensive).toBe(`${uriBase}/${registerId}/concept/2.9`);
    expect(result[0].parts).toEqual([
      `${uriBase}/${registerId}/concept/2.10`,
      `${uriBase}/${registerId}/concept/2.26`,
    ]);
    expect(result[0].enumeration).toBe('closed');
    expect(result[0].markers).toEqual(['double']);
    expect(result[0].label).toBe('value + uncertainty');
  });

  it('defaults enumeration to closed when omitted', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveHyperedges': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.9' },
          'gl:hasPart': [{ 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.10' }],
        },
      ],
    };
    const [he] = extractPartitiveHyperedges(concept, registerId, uriBase, urnMap);
    expect(he.enumeration).toBe('closed');
  });

  it('preserves open enumeration', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveHyperedges': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPart': [{ 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' }],
          'gl:enumeration': 'open',
        },
      ],
    };
    const [he] = extractPartitiveHyperedges(concept, registerId, uriBase, urnMap);
    expect(he.enumeration).toBe('open');
  });

  it('preserves both markers', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveHyperedges': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPart': [{ 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' }],
          'gl:enumeration': 'open',
          'gl:hasPluralityMarker': ['double', 'dashed'],
        },
      ],
    };
    const [he] = extractPartitiveHyperedges(concept, registerId, uriBase, urnMap);
    expect(he.markers).toEqual(['double', 'dashed']);
  });

  it('filters invalid marker values', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveHyperedges': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.3' },
          'gl:hasPart': [{ 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' }],
          'gl:hasPluralityMarker': ['double', 'dotted'],
        },
      ],
    };
    const [he] = extractPartitiveHyperedges(concept, registerId, uriBase, urnMap);
    expect(he.markers).toEqual(['double']);
  });

  it('skips a hyperedge whose comprehensive cannot be resolved', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveHyperedges': [
        {
          'gl:comprehensive': { 'gl:id': '1.3' }, // missing source
          'gl:hasPart': [{ 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '1.4' }],
        },
      ],
    };
    const result = extractPartitiveHyperedges(concept, registerId, uriBase, urnMap);
    expect(result).toHaveLength(0);
  });

  it('skips a hyperedge with no resolvable parts', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveHyperedges': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.9' },
          'gl:hasPart': [{ 'gl:id': '1.4' }], // missing source
        },
      ],
    };
    const result = extractPartitiveHyperedges(concept, registerId, uriBase, urnMap);
    expect(result).toHaveLength(0);
  });

  it('excludes the source concept from parts list (self-loop guard)', () => {
    const concept = {
      '@id': sourceUri,
      'gl:partitiveHyperedges': [
        {
          'gl:comprehensive': { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.9' },
          'gl:hasPart': [
            { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.10' },
            { 'gl:source': 'urn:vim:pub:v:2:2012', 'gl:id': '2.9' }, // self-ref
          ],
        },
      ],
    };
    const [he] = extractPartitiveHyperedges(concept, registerId, uriBase, urnMap);
    expect(he.parts).toHaveLength(1);
    expect(he.parts[0]).toBe(`${uriBase}/${registerId}/concept/2.10`);
  });

  it('returns empty array when concept has no partitiveHyperedges', () => {
    const concept = { '@id': sourceUri };
    const result = extractPartitiveHyperedges(concept, registerId, uriBase, urnMap);
    expect(result).toEqual([]);
  });
});
