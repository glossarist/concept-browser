import { describe, it, expect } from 'vitest';
import { conceptFromJson } from '../../adapters/model-bridge';

function makeJsonLdWithRelated(target: string | null) {
  const related = target
    ? {
        'gl:relationshipType': 'superseded_by',
        'gl:target': target,
        'gl:ref': { 'gl:source': 'CIE S 017:2020', 'gl:id': '17-21-097' },
      }
    : {
        'gl:relationshipType': 'superseded_by',
        'gl:ref': { 'gl:source': 'CIE S 017:2020', 'gl:id': '17-21-097' },
      };
  return {
    '@type': 'skos:Concept',
    '@id': 'https://example.com/cie-2011/concept/17-50',
    'gl:identifier': '17-50',
    'gl:localizedConcept': {
      eng: {
        'gl:languageCode': 'eng',
        'gl:designation': [{ '@type': 'gl:Expression', 'gl:term': 'test term', 'gl:normativeStatus': 'preferred' }],
        'gl:definition': [{ 'gl:content': 'test definition' }],
      },
    },
    'gl:related': [related],
  };
}

describe('cross-dataset related concept resolution — gl:target flows through model-bridge natively', () => {
  it('concept.relatedConcepts entries with gl:target have native target field', () => {
    const json = makeJsonLdWithRelated('https://example.com/cie-2020/concept/17-21-097');
    const concept = conceptFromJson(json as any);
    expect(concept.relatedConcepts).toHaveLength(1);
    expect(concept.relatedConcepts[0].type).toBe('superseded_by');
    expect(concept.relatedConcepts[0].target).toBe('https://example.com/cie-2020/concept/17-21-097');
  });

  it('concept.relatedConcepts entries without gl:target have null target', () => {
    const json = makeJsonLdWithRelated(null);
    const concept = conceptFromJson(json as any);
    expect(concept.relatedConcepts).toHaveLength(1);
    expect(concept.relatedConcepts[0].target).toBeNull();
  });
});
