import { describe, it, expect } from 'vitest';
import { Concept } from 'glossarist';
import { emitConceptGraph } from '../../components/concept-rdf/concept-emitter';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { writeJsonLd } from '../../components/concept-rdf/jsonld-writer';
import type { ConceptFixture } from '../__fixtures__/concepts';
import { CONCEPT_FIXTURES } from '../__fixtures__/concepts';

const BASE = 'https://glossarist.org/fixtures/perf';
const TARGET_CONCEPT_COUNT = 500;
const TIME_BUDGET_MS = 2000;

function makeConcepts(n: number): { uri: string; concept: Concept }[] {
  const fixtures = CONCEPT_FIXTURES;
  const out: { uri: string; concept: Concept }[] = [];
  for (let i = 0; i < n; i++) {
    const tpl: ConceptFixture = fixtures[i % fixtures.length];
    const id = `${i + 1}`;
    const concept = Concept.fromJSON({
      id,
      uri: `${BASE}/${id}`,
      status: 'valid',
      localizations: {
        eng: {
          language_code: 'eng',
          entry_status: 'valid',
          terms: [{ type: 'expression', designation: `${tpl.name} concept ${id}`, normative_status: 'preferred' }],
          definition: [{ content: `Definition for ${tpl.name} #${id}.` }],
        },
      },
    });
    out.push({ uri: `${BASE}/${id}`, concept });
  }
  return out;
}

describe('Layer 7 — serialization performance regression', () => {
  it(`emits Turtle for ${TARGET_CONCEPT_COUNT} concepts under ${TIME_BUDGET_MS}ms`, () => {
    const concepts = makeConcepts(TARGET_CONCEPT_COUNT);

    const start = performance.now();
    for (const { concept, uri } of concepts) {
      const { graph } = emitConceptGraph(concept, uri);
      writeTurtle(graph);
    }
    const elapsed = performance.now() - start;

    // eslint-disable-next-line no-console
    console.log(`Layer 7 perf: emitted ${TARGET_CONCEPT_COUNT} concepts to Turtle in ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(TIME_BUDGET_MS);
  });

  it(`emits JSON-LD for ${TARGET_CONCEPT_COUNT} concepts under ${TIME_BUDGET_MS}ms`, () => {
    const concepts = makeConcepts(TARGET_CONCEPT_COUNT);

    const start = performance.now();
    for (const { concept, uri } of concepts) {
      const { graph } = emitConceptGraph(concept, uri);
      writeJsonLd(graph);
    }
    const elapsed = performance.now() - start;

    // eslint-disable-next-line no-console
    console.log(`Layer 7 perf: emitted ${TARGET_CONCEPT_COUNT} concepts to JSON-LD in ${elapsed.toFixed(0)}ms`);
    expect(elapsed).toBeLessThan(TIME_BUDGET_MS);
  });

  it('per-concept emit cost stays below 5ms on average', () => {
    const concepts = makeConcepts(100);
    const start = performance.now();
    for (const { concept, uri } of concepts) {
      const { graph } = emitConceptGraph(concept, uri);
      writeTurtle(graph);
    }
    const elapsed = performance.now() - start;
    const perConcept = elapsed / 100;
    expect(perConcept).toBeLessThan(5);
  });
});
