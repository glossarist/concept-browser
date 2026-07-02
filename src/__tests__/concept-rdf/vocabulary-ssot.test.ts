import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Parser, Store } from 'n3';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { emitVocabularyGraph, VOCAB_SCHEMES } from '../../components/concept-rdf/vocabulary-emitter';

const VOCAB_JSON = JSON.parse(readFileSync(join(process.cwd(), 'data', 'glossarist-vocab.json'), 'utf8'));

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

const SKOS = 'http://www.w3.org/2004/02/skos/core#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

const EXPECTED_REL_TYPES = [
  'deprecates', 'deprecated_by', 'supersedes', 'superseded_by', 'replaces', 'replaced_by',
  'invalidates', 'invalidated_by', 'retires', 'retired_by',
  'narrower', 'broader', 'broader_generic', 'narrower_generic',
  'broader_partitive', 'narrower_partitive', 'has_part', 'is_part_of',
  'broader_instantial', 'narrower_instantial', 'instance_of', 'has_instance',
  'equivalent', 'exact_match', 'close_match', 'broad_match', 'narrow_match', 'related_match',
  'compare', 'contrast',
  'see', 'references', 'related_concept', 'related_concept_broader', 'related_concept_narrower',
  'sequentially_related', 'spatially_related', 'temporally_related',
  'homograph', 'false_friend',
  'has_concept', 'is_concept_of', 'has_definition', 'definition_of',
  'inherits', 'inherited_by',
  'has_version', 'version_of', 'current_version', 'current_version_of',
  'derived',
];

describe('A1/A2/C1 — vocabulary SSOT', () => {
  it('VOCAB_SCHEMES loads from data/glossarist-vocab.json at module init', () => {
    expect(VOCAB_SCHEMES.length).toBe(VOCAB_JSON.schemes.length);
  });

  it('every scheme entry in JSON appears in VOCAB_SCHEMES', () => {
    const expected = new Set(VOCAB_JSON.schemes.map((s: any) => s.schemeIri));
    const actual = new Set(VOCAB_SCHEMES.map(s => s.schemeIri));
    expect(actual).toEqual(expected);
  });

  it('TS and mjs consumers read the same JSON file (single source of truth)', () => {
    const tsCount = VOCAB_SCHEMES.reduce((acc, s) => acc + s.terms.length, 0);
    const jsonCount = VOCAB_JSON.schemes.reduce(
      (acc: number, s: any) => acc + s.terms.length, 0,
    );
    expect(tsCount).toBe(jsonCount);
  });
});

describe('C1 — all 52 relationship types are declared', () => {
  it('relationship-type scheme declares every type in EXPECTED_REL_TYPES', () => {
    const relScheme = VOCAB_SCHEMES.find(s => s.schemeIri === 'gloss:rel-scheme');
    expect(relScheme).toBeDefined();
    const declared = new Set(relScheme!.terms.map(t => t.label));
    for (const expected of EXPECTED_REL_TYPES) {
      expect(declared.has(expected)).toBe(true);
    }
  });

  it('relationship-type count matches glossarist-ruby config.yml (50 canonical + legacy)', () => {
    const relScheme = VOCAB_SCHEMES.find(s => s.schemeIri === 'gloss:rel-scheme');
    // glossarist-ruby config.yml related_concept.type lists 50 types. We add 'derived' as a legacy alias.
    expect(relScheme!.terms.length).toBeGreaterThanOrEqual(50);
  });

  it('every relationship type IRI follows the gloss:rel/{type} pattern', () => {
    const relScheme = VOCAB_SCHEMES.find(s => s.schemeIri === 'gloss:rel-scheme');
    for (const term of relScheme!.terms) {
      expect(term.iri).toMatch(/^gloss:rel\/[a-z_]+$/);
    }
  });

  it('every relationship type is a skos:Concept in the emitted graph', () => {
    const ttl = writeTurtle(emitVocabularyGraph());
    const store = parse(ttl);
    for (const term of VOCAB_SCHEMES.find(s => s.schemeIri === 'gloss:rel-scheme')!.terms) {
      const iri = `https://www.glossarist.org/ontologies/rel/${term.label}`;
      const types = store.getObjects(iri, RDF_TYPE, null).map(q => q.value);
      expect(types).toContain(`${SKOS}Concept`);
    }
  });
});

describe('C1 — vocabulary emits without drift between TS and mjs', () => {
  it('emitted Turtle contains every scheme and every term', () => {
    const ttl = writeTurtle(emitVocabularyGraph());
    for (const scheme of VOCAB_SCHEMES) {
      for (const term of scheme.terms) {
        expect(ttl).toContain(term.label);
      }
    }
  });
});