import { describe, it, expect } from 'vitest';
import { canonicalizeQuads, diffQuadSets } from './quad-isomorphism';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { emitConceptGraph } from '../../components/concept-rdf/concept-emitter';
import { CONCEPT_FIXTURES } from '../__fixtures__/concepts';

describe('WS P1 — quad isomorphism utility', () => {
  it('canonicalizes a Turtle document into a quad signature set', () => {
    const ttl = writeTurtle(emitConceptGraph(CONCEPT_FIXTURES[0].concept, CONCEPT_FIXTURES[0].uri).graph);
    const canon = canonicalizeQuads(ttl);
    expect(canon.size).toBeGreaterThan(0);
    expect(canon.quads.size).toBe(canon.size);
  });

  it('reports isomorphic for byte-identical Turtle', () => {
    const ttl = writeTurtle(emitConceptGraph(CONCEPT_FIXTURES[0].concept, CONCEPT_FIXTURES[0].uri).graph);
    const a = canonicalizeQuads(ttl);
    const b = canonicalizeQuads(ttl);
    const diff = diffQuadSets(a, b);
    expect(diff.isomorphic).toBe(true);
    expect(diff.jsOnly.length).toBe(0);
    expect(diff.rubyOnly.length).toBe(0);
  });

  it('reports non-isomorphic when extra quads are added', () => {
    const ttlA = writeTurtle(emitConceptGraph(CONCEPT_FIXTURES[0].concept, CONCEPT_FIXTURES[0].uri).graph);
    const ttlB = ttlA + '\n<https://glossarist.org/x> a skos:Concept .\n';
    const a = canonicalizeQuads(ttlA);
    const b = canonicalizeQuads(ttlB);
    const diff = diffQuadSets(a, b);
    expect(diff.isomorphic).toBe(false);
    expect(diff.rubyOnly.length).toBeGreaterThan(0);
  });

  it('reports non-isomorphic when two fixtures have different shapes', () => {
    const ttlMinimal = writeTurtle(emitConceptGraph(CONCEPT_FIXTURES[0].concept, CONCEPT_FIXTURES[0].uri).graph);
    const ttlMulti = writeTurtle(emitConceptGraph(CONCEPT_FIXTURES[1].concept, CONCEPT_FIXTURES[1].uri).graph);
    const a = canonicalizeQuads(ttlMinimal);
    const b = canonicalizeQuads(ttlMulti);
    const diff = diffQuadSets(a, b);
    expect(diff.isomorphic).toBe(false);
  });
});