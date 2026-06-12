import { describe, it, expect } from 'vitest';
import { conceptFromJson, getRelatedSourceId, getRelatedCitation } from '../adapters/model-bridge';

describe('model-bridge — mapRefFromJsonLd', () => {
  it('maps string ref to { source }', () => {
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
            'gl:sourceType': 'authoritative',
            'gl:origin': {
              '@type': 'gl:Citation',
              'gl:ref': 'ISO 9000:2015',
            },
          }],
        },
      },
    };

    const concept = conceptFromJson(doc);
    const sources = concept.localization('eng')!.sources;
    expect(sources[0].origin!.ref!.source).toBe('ISO 9000:2015');
  });

  it('prefers gl:-prefixed keys over unprefixed keys', () => {
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
            'gl:origin': {
              '@type': 'gl:Citation',
              'gl:ref': {
                'gl:source': 'gl-source',
                'source': 'plain-source',
                'gl:id': 'gl-id',
                'id': 'plain-id',
              },
            },
          }],
        },
      },
    };

    const concept = conceptFromJson(doc);
    const sources = concept.localization('eng')!.sources;
    expect(sources[0].origin!.ref!.source).toBe('gl-source');
    expect(sources[0].origin!.ref!.id).toBe('gl-id');
  });
});

describe('model-bridge — locality mapping round-trip', () => {
  it('maps gl:referenceFrom to Locality instance with correct getters', () => {
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
            'gl:origin': {
              '@type': 'gl:Citation',
              'gl:ref': { 'gl:source': 'ISO 9000' },
              'gl:locality': {
                'gl:localityType': 'clause',
                'gl:referenceFrom': '3.1',
                'gl:referenceTo': '3.5',
              },
            },
          }],
        },
      },
    };

    const concept = conceptFromJson(doc);
    const origin = concept.localization('eng')!.sources[0].origin!;
    const loc = origin.locality!;
    // Locality model uses camelCase getters, toJSON() produces snake_case
    expect(loc.type).toBe('clause');
    expect(loc.referenceFrom).toBe('3.1');
    expect(loc.referenceTo).toBe('3.5');
    // Verify serialization is snake_case
    const json = loc.toJSON();
    expect(json.reference_from).toBe('3.1');
    expect(json.reference_to).toBe('3.5');
  });
});

describe('model-bridge — citation bridge round-trip', () => {
  it('preserves sourceId and citation through JSON-LD round-trip', () => {
    const doc = {
      '@type': 'gl:Concept',
      '@id': 'https://example.com/reg/concept/1',
      'gl:identifier': '1',
      'gl:localizedConcept': {
        eng: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'eng',
          'gl:references': [{
            '@id': 'cite:vim-2.2',
            'gl:term': 'entity',
            'gl:sourceId': 'vim-2.2',
            'gl:citation': {
              'gl:ref': {
                '@type': 'gl:Ref',
                'gl:source': 'OIML V2-200:2012',
                'gl:id': '2.2',
              },
              'gl:locality': {
                'gl:localityType': 'definition',
                'gl:referenceFrom': '2.2',
              },
              'gl:link': 'https://example.com/vim',
            },
          }],
        },
      },
    };

    const concept = conceptFromJson(doc);
    const lc = concept.localization('eng')!;
    const rc = lc.related[0];

    // All fields preserved through the bridge
    expect(rc.content).toBe('entity');
    expect(getRelatedSourceId(rc)).toBe('vim-2.2');

    const citation = getRelatedCitation(rc)!;
    expect((citation.ref as any).source).toBe('OIML V2-200:2012');
    expect((citation.ref as any).id).toBe('2.2');
    // Citation locality is stored as raw dict (snake_case from mapLocalityFromJsonLd)
    expect((citation.locality as any).type).toBe('definition');
    expect((citation.locality as any).reference_from).toBe('2.2');
    expect(citation.link).toBe('https://example.com/vim');
  });
});
