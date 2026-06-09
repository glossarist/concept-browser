// @ts-nocheck — ESM .js import without type declarations
import { describe, it, expect } from 'vitest';
import { extractSourceRefs } from '../../scripts/extract-source-refs.js';

function makeConcept(sources: any[], localizedSources?: any) {
  return {
    '@id': 'https://glossarist.org/ds1/concept/1.1',
    'gl:source': sources || [],
    'gl:localizedConcept': localizedSources || {},
  };
}

function makeSource(source: string, refFrom: string, type = 'authoritative') {
  return {
    'gl:origin': {
      'gl:ref': { 'gl:source': source },
      'gl:locality': { 'gl:type': type, 'gl:referenceFrom': refFrom },
    },
  };
}

describe('extractSourceRefs', () => {
  it('extracts source from managed concept-level gl:source', () => {
    const concept = makeConcept([makeSource('OIML V2-200:2012', '2.2')]);
    const result = extractSourceRefs(concept, 'viml-2022');
    expect(result).toEqual([{ source: 'OIML V2-200:2012', registerId: 'viml-2022' }]);
  });

  it('extracts source from localized concept gl:source', () => {
    const concept = makeConcept([], {
      eng: { 'gl:source': [makeSource('ISO/IEC 17000:2020', '3.1')] },
    });
    const result = extractSourceRefs(concept, 'viml-2022');
    expect(result).toEqual([{ source: 'ISO/IEC 17000:2020', registerId: 'viml-2022' }]);
  });

  it('extracts from both managed and localized sources', () => {
    const concept = makeConcept(
      [makeSource('OIML V2-200:2012', '2.2')],
      {
        eng: { 'gl:source': [makeSource('ISO/IEC 17000:2020', '3.1')] },
        fra: { 'gl:source': [makeSource('ISO/CEI 17000:2020', '3.1')] },
      },
    );
    const result = extractSourceRefs(concept, 'viml-2022');
    expect(result).toEqual([
      { source: 'OIML V2-200:2012', registerId: 'viml-2022' },
      { source: 'ISO/IEC 17000:2020', registerId: 'viml-2022' },
      { source: 'ISO/CEI 17000:2020', registerId: 'viml-2022' },
    ]);
  });

  it('deduplicates identical source strings', () => {
    const concept = makeConcept(
      [makeSource('VIM', '2.2')],
      { eng: { 'gl:source': [makeSource('VIM', '2.3')] } },
    );
    const result = extractSourceRefs(concept, 'viml-2022');
    expect(result).toEqual([{ source: 'VIM', registerId: 'viml-2022' }]);
  });

  it('returns empty array when no sources present', () => {
    const concept = makeConcept();
    const result = extractSourceRefs(concept, 'viml-2022');
    expect(result).toEqual([]);
  });

  it('returns empty array for concept with no gl:source field', () => {
    const concept = { '@id': 'https://glossarist.org/ds1/concept/1.1' };
    const result = extractSourceRefs(concept, 'viml-2022');
    expect(result).toEqual([]);
  });

  it('skips sources without gl:origin', () => {
    const concept = makeConcept([{ 'gl:ref': { 'gl:source': 'VIM' } }]);
    const result = extractSourceRefs(concept, 'ds1');
    expect(result).toEqual([]);
  });

  it('skips origins without gl:ref', () => {
    const concept = makeConcept([{ 'gl:origin': { 'gl:locality': {} } }]);
    const result = extractSourceRefs(concept, 'ds1');
    expect(result).toEqual([]);
  });

  it('skips refs without gl:source', () => {
    const concept = makeConcept([{ 'gl:origin': { 'gl:ref': { 'gl:id': '2.2' } } }]);
    const result = extractSourceRefs(concept, 'ds1');
    expect(result).toEqual([]);
  });

  it('handles concept with multiple localized languages', () => {
    const concept = makeConcept([], {
      eng: { 'gl:source': [makeSource('OIML V 1:2022', '0.01')] },
      fra: { 'gl:source': [makeSource('OIML V 1:2022', '0.01')] },
    });
    const result = extractSourceRefs(concept, 'viml-2022');
    expect(result).toEqual([{ source: 'OIML V 1:2022', registerId: 'viml-2022' }]);
  });

  it('preserves registerId from the caller, not the concept data', () => {
    const concept = makeConcept([makeSource('VIM', '2.2')]);
    const result = extractSourceRefs(concept, 'my-dataset');
    expect(result[0].registerId).toBe('my-dataset');
  });

  it('handles source strings with special characters', () => {
    const concept = makeConcept([makeSource('OIML V 2:1993', '3.6')]);
    const result = extractSourceRefs(concept, 'vim-1993');
    expect(result).toEqual([{ source: 'OIML V 2:1993', registerId: 'vim-1993' }]);
  });

  it('handles source strings with whitespace variations', () => {
    const concept = makeConcept([makeSource('ISO/ CEI 17000:2004', '3.1')]);
    const result = extractSourceRefs(concept, 'viml-2013');
    expect(result).toEqual([{ source: 'ISO/ CEI 17000:2004', registerId: 'viml-2013' }]);
  });

  it('extracts from multiple sources in a single concept', () => {
    const concept = makeConcept([
      makeSource('OIML V2-200:2012', '2.2'),
      makeSource('ISO/IEC 17000:2020', '3.1'),
    ]);
    const result = extractSourceRefs(concept, 'viml-2022');
    expect(result).toEqual([
      { source: 'OIML V2-200:2012', registerId: 'viml-2022' },
      { source: 'ISO/IEC 17000:2020', registerId: 'viml-2022' },
    ]);
  });

  it('extracts URN-based source strings', () => {
    const concept = makeConcept([makeSource('urn:oiml:pub:v:2:2012', '2.2')]);
    const result = extractSourceRefs(concept, 'viml-2022');
    expect(result).toEqual([{ source: 'urn:oiml:pub:v:2:2012', registerId: 'viml-2022' }]);
  });
});
