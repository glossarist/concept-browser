import { Concept } from 'glossarist';

export interface ConceptFixture {
  readonly name: string;
  readonly description: string;
  readonly uri: string;
  readonly concept: Concept;
}

const BASE = 'https://glossarist.org/fixtures/concept';

function minimal(): Concept {
  return Concept.fromJSON({
    id: '1.1',
    uri: `${BASE}/minimal`,
    status: 'valid',
    localizations: {
      eng: {
        language_code: 'eng',
        entry_status: 'valid',
        terms: [{ type: 'expression', designation: 'minimal concept', normative_status: 'preferred' }],
        definition: [{ content: 'A minimal concept used to verify the baseline emission path.' }],
      },
    },
  });
}

function multilingual(): Concept {
  return Concept.fromJSON({
    id: '2.1',
    uri: `${BASE}/multilingual`,
    status: 'valid',
    localizations: {
      eng: {
        language_code: 'eng',
        entry_status: 'valid',
        terms: [{ type: 'expression', designation: 'coordinate system', normative_status: 'preferred' }],
        definition: [{ content: 'A system for specifying positions in space.' }],
      },
      fra: {
        language_code: 'fra',
        entry_status: 'valid',
        terms: [{ type: 'expression', designation: 'système de coordonnées', normative_status: 'preferred' }],
        definition: [{ content: 'Un système pour spécifier des positions dans l’espace.' }],
      },
      jpn: {
        language_code: 'jpn',
        entry_status: 'valid',
        terms: [{ type: 'expression', designation: '座標系', normative_status: 'preferred' }],
        definition: [{ content: '空間における位置を指定するための体系。' }],
      },
    },
  });
}

function fullRelationships(): Concept {
  return Concept.fromJSON({
    id: '3.1',
    uri: `${BASE}/full-relationships`,
    status: 'valid',
    related: [
      { type: 'supersedes',     content: 'Replaces older term.', ref: { source: 'IEC', id: '60050-3.1.1' } },
      { type: 'superseded_by',  content: 'Superseded by newer.', ref: { source: 'ISO', id: '9999-1.2.3' } },
      { type: 'derived',        content: 'Derived from source.', ref: { source: 'VIM', id: '1.1'          } },
      { type: 'compare',        content: 'Compare with similar.', ref: { source: 'IEV', id: '102-01-01'  } },
      { type: 'contrast',       content: 'Contrast with this.',  ref: { source: 'IEV', id: '102-02-02'  } },
    ],
    localizations: {
      eng: {
        language_code: 'eng',
        entry_status: 'valid',
        terms: [{ type: 'expression', designation: 'related concept hub', normative_status: 'preferred' }],
        definition: [{ content: 'A concept that demonstrates every relationship type.' }],
      },
    },
  });
}

function withSources(): Concept {
  return Concept.fromJSON({
    id: '4.1',
    uri: `${BASE}/with-sources`,
    status: 'valid',
    sources: [
      {
        status: 'identical',
        type: 'authoritative',
        modification: 'revised 2024',
        origin: {
          ref: { source: 'ISO 704', id: '3.1', version: '2020' },
          locality: { type: 'clause', referenceFrom: '3.1', referenceTo: '3.5' },
          link: 'https://example.org/iso-704',
          original: 'Original wording here.',
        },
      },
      {
        status: 'modified',
        type: 'lineage',
        origin: {
          ref: { source: 'IEC 60050', id: '102-01', version: '2008' },
          locality: { type: 'clause', referenceFrom: '102-01-01' },
        },
      },
      {
        status: 'restyled',
        type: 'lineage',
        origin: {
          ref: { source: 'VIM', id: '1.2', version: '2012' },
        },
      },
    ],
    localizations: {
      eng: {
        language_code: 'eng',
        entry_status: 'valid',
        terms: [{ type: 'expression', designation: 'cited term', normative_status: 'preferred' }],
        definition: [{ content: 'A concept that carries structured citations.' }],
        sources: [
          {
            status: 'identical',
            type: 'authoritative',
            origin: {
              ref: { source: 'ISO 1087', id: '2.1', version: '2019' },
              locality: { type: 'clause', referenceFrom: '2.1' },
            },
          },
        ],
      },
    },
  });
}

function withNonVerbal(): Concept {
  return Concept.fromJSON({
    id: '5.1',
    uri: `${BASE}/with-non-verbal`,
    status: 'valid',
    localizations: {
      eng: {
        language_code: 'eng',
        entry_status: 'valid',
        terms: [{ type: 'expression', designation: 'angle of repose', normative_status: 'preferred' }],
        definition: [{ content: 'The steepest angle relative to the horizontal at which a material can be piled without sliding.' }],
        non_verbal_rep: [
          {
            type: 'figure',
            caption: 'Angle of repose diagram',
            description: 'Schematic diagram showing the angle.',
            images: [{ src: 'https://glossarist.org/figs/angle.svg' }],
          },
          {
            type: 'formula',
            caption: 'tan(θ) = μ',
          },
          {
            type: 'table',
            caption: 'Measured angles',
            description: 'Empirical values across materials.',
          },
        ],
      },
    },
  });
}

function withDates(): Concept {
  return Concept.fromJSON({
    id: '6.1',
    uri: `${BASE}/with-dates`,
    status: 'valid',
    dates: [
      { type: 'accepted', date: '2020-01-15' },
      { type: 'amended',  date: '2023-06-30' },
      { type: 'retired',  date: '2025-12-31' },
    ],
    localizations: {
      eng: {
        language_code: 'eng',
        entry_status: 'valid',
        terms: [{ type: 'expression', designation: 'lifecycle concept', normative_status: 'preferred' }],
        definition: [{ content: 'A concept that exercises the accepted/amended/retired date types.' }],
      },
    },
  });
}

export const CONCEPT_FIXTURES: readonly ConceptFixture[] = [
  { name: 'minimal',            description: 'one localization, one designation',                uri: `${BASE}/minimal`,            concept: minimal() },
  { name: 'multilingual',       description: 'three languages across Latn and CJK scripts',      uri: `${BASE}/multilingual`,       concept: multilingual() },
  { name: 'full-relationships', description: 'every supported related-concept type',             uri: `${BASE}/full-relationships`, concept: fullRelationships() },
  { name: 'with-sources',       description: 'structured citations, locality, original wording', uri: `${BASE}/with-sources`,       concept: withSources() },
  { name: 'with-non-verbal',    description: 'figure, formula, and table non-verbal reps',       uri: `${BASE}/with-non-verbal`,    concept: withNonVerbal() },
  { name: 'with-dates',         description: 'accepted/amended/retired lifecycle',               uri: `${BASE}/with-dates`,         concept: withDates() },
];

export function fixtureByName(name: string): ConceptFixture {
  const f = CONCEPT_FIXTURES.find(f => f.name === name);
  if (!f) throw new Error(`Unknown concept fixture: ${name}`);
  return f;
}
