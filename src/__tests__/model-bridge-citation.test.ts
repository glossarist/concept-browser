import { describe, it, expect } from 'vitest';
import { conceptFromJson, getRelatedSourceId, getRelatedCitation } from '../adapters/model-bridge';

describe('model-bridge — source id mapping', () => {
  it('maps gl:id from JSON-LD ConceptSource', () => {
    const doc = {
      '@type': 'gl:Concept',
      '@id': 'https://example.com/reg/concept/1',
      'gl:identifier': '1',
      'gl:localizedConcept': {
        eng: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'eng',
          'gl:source': [{
            '@type': 'gl:ConceptSource',
            'gl:id': 'iso-10303-2-def',
            'gl:sourceType': 'authoritative',
            'gl:origin': {
              '@type': 'gl:Citation',
              'gl:ref': {
                '@type': 'gl:Ref',
                'gl:source': 'ISO 10303-2',
                'gl:id': '3.1.1',
              },
            },
          }],
        },
      },
    };

    const concept = conceptFromJson(doc);
    const sources = concept.localization('eng')!.sources;
    expect(sources).toHaveLength(1);
    expect((sources[0] as any).id).toBe('iso-10303-2-def');
    expect(sources[0].origin!.ref!.source).toBe('ISO 10303-2');
    expect(sources[0].origin!.ref!.id).toBe('3.1.1');
  });
});

describe('model-bridge — reference citation mapping via WeakMap bridges', () => {
  it('maps gl:sourceId from JSON-LD reference', () => {
    const doc = {
      '@type': 'gl:Concept',
      '@id': 'https://example.com/reg/concept/1',
      'gl:identifier': '1',
      'gl:localizedConcept': {
        eng: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'eng',
          'gl:references': [{
            '@id': 'cite:iso-10303-2-def',
            'gl:term': 'entity data type',
            'gl:sourceId': 'iso-10303-2-def',
          }],
        },
      },
    };

    const concept = conceptFromJson(doc);
    const lc = concept.localization('eng')!;
    const related = lc.related;
    expect(related).toHaveLength(1);
    expect(related[0].content).toEqual({ default: 'entity data type' });
    expect(getRelatedSourceId(related[0])).toBe('iso-10303-2-def');
  });

  it('maps gl:citation from JSON-LD reference', () => {
    const doc = {
      '@type': 'gl:Concept',
      '@id': 'https://example.com/reg/concept/1',
      'gl:identifier': '1',
      'gl:localizedConcept': {
        eng: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'eng',
          'gl:references': [{
            '@id': 'cite:vim-def',
            'gl:term': 'entity',
            'gl:sourceId': 'vim-def',
            'gl:citation': {
              'gl:ref': {
                '@type': 'gl:Ref',
                'gl:source': 'OIML V2-200:2012',
                'gl:id': '2.2',
              },
              'gl:locality': {
                'gl:localityType': 'clause',
                'gl:referenceFrom': '2.2',
              },
            },
          }],
        },
      },
    };

    const concept = conceptFromJson(doc);
    const lc = concept.localization('eng')!;
    const related = lc.related;
    expect(related).toHaveLength(1);

    const citation = getRelatedCitation(related[0]);
    expect(citation).toBeDefined();
    expect((citation!.ref as any).source).toBe('OIML V2-200:2012');
    expect((citation!.ref as any).id).toBe('2.2');
    expect((citation!.locality as any).type).toBe('clause');
    expect((citation!.locality as any).reference_from).toBe('2.2');
  });

  it('maps gl:citation with link', () => {
    const doc = {
      '@type': 'gl:Concept',
      '@id': 'https://example.com/reg/concept/1',
      'gl:identifier': '1',
      'gl:localizedConcept': {
        eng: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'eng',
          'gl:references': [{
            '@id': 'cite:iso-9000',
            'gl:term': 'ISO 9000',
            'gl:sourceId': 'iso-9000',
            'gl:citation': {
              'gl:ref': {
                '@type': 'gl:Ref',
                'gl:source': 'ISO 9000:2015',
              },
              'gl:link': 'https://iso.org/standard/62085.html',
            },
          }],
        },
      },
    };

    const concept = conceptFromJson(doc);
    const lc = concept.localization('eng')!;
    const related = lc.related;
    const citation = getRelatedCitation(related[0]);
    expect(citation!.link).toBe('https://iso.org/standard/62085.html');
  });

  it('returns null for RelatedConcept without bridged fields', () => {
    const doc = {
      '@type': 'gl:Concept',
      '@id': 'https://example.com/reg/concept/1',
      'gl:identifier': '1',
      'gl:localizedConcept': {
        eng: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'eng',
          'gl:references': [{
            '@id': 'https://example.com/reg/concept/2',
            'gl:term': 'other concept',
          }],
        },
      },
    };

    const concept = conceptFromJson(doc);
    const lc = concept.localization('eng')!;
    expect(getRelatedSourceId(lc.related[0])).toBeNull();
    expect(getRelatedCitation(lc.related[0])).toBeNull();
  });
});
