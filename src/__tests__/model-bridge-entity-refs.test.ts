import { describe, it, expect } from 'vitest';
import { conceptFromJson } from '../adapters/model-bridge';
import type { Concept } from 'glossarist';

interface ConceptWithEntityRefs {
  readonly figures: ReadonlyArray<{ entityId: string | null; display: string | null }>;
  readonly tables: ReadonlyArray<{ entityId: string | null; display: string | null }>;
  readonly formulas: ReadonlyArray<{ entityId: string | null; display: string | null }>;
}

function refsOf(c: Concept): ConceptWithEntityRefs {
  return c as unknown as ConceptWithEntityRefs;
}

function conceptWithRefs(): Concept {
  return conceptFromJson({
    '@context': 'https://glossarist.org/ns/context.jsonld',
    '@id': 'https://www.geolexica.org/isotc204/concept/3.1.1.1',
    '@type': 'gl:Concept',
    'gl:identifier': '3.1.1.1',
    'gl:localizedConcept': {
      eng: {
        '@id': 'https://www.geolexica.org/isotc204/concept/3.1.1.1/eng',
        '@type': 'gl:LocalizedConcept',
        'gl:languageCode': 'eng',
        'gl:entryStatus': 'valid',
        'gl:designation': [{ '@type': 'gl:Expression', 'gl:term': 'entity' }],
      },
    },
    'gl:figureRef': [
      'mixed-reflection',
      { '@id': '../figure/dispersion-prism' },
      { '@id': '../figure/standard-wavelengths', 'gl:display': 'Figure 3' },
    ],
    'gl:tableRef': [{ '@id': '../table/wavelength-table' }],
    'gl:formulaRef': ['e-mc2'],
  });
}

describe('conceptFromJson — structural entity refs', () => {
  it('extracts bare-string figure refs', () => {
    const c = refsOf(conceptWithRefs());
    const ids = c.figures.map(f => f.entityId);
    expect(ids).toContain('mixed-reflection');
  });

  it('extracts @id-only figure refs by last path segment', () => {
    const c = refsOf(conceptWithRefs());
    const ids = c.figures.map(f => f.entityId);
    expect(ids).toContain('dispersion-prism');
  });

  it('preserves gl:display as the reference display override', () => {
    const c = refsOf(conceptWithRefs());
    const withDisplay = c.figures.find(f => f.entityId === 'standard-wavelengths');
    expect(withDisplay?.display).toBe('Figure 3');
  });

  it('extracts table refs from gl:tableRef', () => {
    const c = refsOf(conceptWithRefs());
    expect(c.tables.map(t => t.entityId)).toContain('wavelength-table');
  });

  it('extracts formula refs from gl:formulaRef', () => {
    const c = refsOf(conceptWithRefs());
    expect(c.formulas.map(f => f.entityId)).toContain('e-mc2');
  });

  it('returns empty arrays when no ref fields are present', () => {
    const c = refsOf(conceptFromJson({
      '@context': 'https://glossarist.org/ns/context.jsonld',
      '@id': 'https://example.org/x/concept/1',
      '@type': 'gl:Concept',
      'gl:identifier': '1',
      'gl:localizedConcept': {
        eng: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'eng',
          'gl:entryStatus': 'valid',
          'gl:designation': [{ '@type': 'gl:Expression', 'gl:term': 'x' }],
        },
      },
    }));
    expect(c.figures).toEqual([]);
    expect(c.tables).toEqual([]);
    expect(c.formulas).toEqual([]);
  });

  it('skips malformed entries (empty string, null, missing @id)', () => {
    const c = refsOf(conceptFromJson({
      '@context': 'https://glossarist.org/ns/context.jsonld',
      '@id': 'https://example.org/x/concept/1',
      '@type': 'gl:Concept',
      'gl:identifier': '1',
      'gl:localizedConcept': {
        eng: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'eng',
          'gl:entryStatus': 'valid',
          'gl:designation': [{ '@type': 'gl:Expression', 'gl:term': 'x' }],
        },
      },
      'gl:figureRef': [
        '',
        null,
        {},
        { '@id': '' },
        { ref: '' },
        '   ',
      ],
    }));
    expect(c.figures).toEqual([]);
  });
});
