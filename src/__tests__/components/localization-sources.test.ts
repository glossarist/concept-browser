import { describe, it, expect } from 'vitest';
import { conceptFromJson } from '../../adapters/model-bridge';

/**
 * Regression test: sources stored at the localization level
 * (gl:localizedConcept.eng.gl:source) must be accessible via
 * concept.localization(lang).sources so the citeResolver can find them.
 *
 * Without this, {{cite:sourceId}} mentions render as plain text
 * instead of links — the exact bug reported on cie-eilv concept 17-21-001.
 */

function makeConceptWithLocalizationSources() {
  return {
    '@type': 'skos:Concept',
    '@id': 'https://example.com/dataset/cie-2020/concept/17-21-001',
    'gl:identifier': '17-21-001',
    'gl:localizedConcept': {
      eng: {
        'gl:languageCode': 'eng',
        'gl:designation': [{ '@type': 'gl:Expression', 'gl:term': 'quantity', 'gl:normativeStatus': 'preferred' }],
        'gl:definition': [{ 'gl:content': 'property of a phenomenon' }],
        'gl:source': [
          {
            '@type': 'gl:ConceptSource',
            'gl:id': '845-01-01',
            'gl:sourceType': 'authoritative',
            'gl:origin': {
              '@type': 'gl:Citation',
              'gl:ref': { '@type': 'gl:Ref', 'gl:source': 'IEV', 'gl:id': '845-01-01' },
              'gl:link': 'https://www.electropedia.org/iev/iev.nsf/display?openform&ievref=845-01-01',
            },
          },
          {
            '@type': 'gl:ConceptSource',
            'gl:sourceType': 'authoritative',
            'gl:origin': {
              '@type': 'gl:Citation',
              'gl:ref': { '@type': 'gl:Ref', 'gl:source': 'CIE S 017:2011', 'gl:id': '17-370' },
            },
          },
        ],
      },
    },
  };
}

describe('localization-level sources accessible for citeResolver', () => {
  it('concept.localization("eng").sources has the localization sources', () => {
    const concept = conceptFromJson(makeConceptWithLocalizationSources() as any);
    const lc = concept.localization('eng');
    expect(lc).toBeTruthy();
    expect(lc!.sources).toBeDefined();
    expect(lc!.sources!.length).toBeGreaterThanOrEqual(1);
  });

  it('source with gl:id is findable by id', () => {
    const concept = conceptFromJson(makeConceptWithLocalizationSources() as any);
    const lc = concept.localization('eng');
    const source = lc!.sources!.find(s => s.id === '845-01-01');
    expect(source).toBeDefined();
  });

  it('source origin link is preserved', () => {
    const concept = conceptFromJson(makeConceptWithLocalizationSources() as any);
    const lc = concept.localization('eng');
    const source = lc!.sources!.find(s => s.id === '845-01-01');
    expect(source).toBeDefined();
    expect(source!.origin?.link).toBeTruthy();
  });

  it('merging concept + localization sources gives complete set', () => {
    const concept = conceptFromJson(makeConceptWithLocalizationSources() as any);
    const conceptSources = concept.sources ?? [];
    const lcSources = concept.localization('eng')?.sources ?? [];
    const merged = [...conceptSources, ...lcSources];
    expect(merged.length).toBeGreaterThanOrEqual(2);
    expect(merged.find(s => s.id === '845-01-01')).toBeDefined();
  });
});
