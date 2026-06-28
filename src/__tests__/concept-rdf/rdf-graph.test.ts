import { describe, it, expect } from 'vitest';
import { RdfGraph, lit, iri, blank, triple, termEquals } from '../../components/concept-rdf/rdf-graph';

describe('RdfGraph', () => {
  it('preserves insertion order of resources', () => {
    const g = new RdfGraph();
    g.declare('https://ex/a', { label: 'A' });
    g.declare('https://ex/b', { label: 'B' });
    g.declare('https://ex/c', { label: 'C' });

    const subjects = Array.from(g.resources()).map(r => r.subject);
    expect(subjects).toEqual(['https://ex/a', 'https://ex/b', 'https://ex/c']);
  });

  it('dedupes resources by subject and merges types', () => {
    const g = new RdfGraph();
    g.declare('https://ex/a', { types: ['gloss:Concept'] });
    g.declare('https://ex/a', { types: ['skos:Concept'] });

    expect(g.size).toBe(1);
    const r = g.get('https://ex/a')!;
    expect(r.types).toEqual(['gloss:Concept', 'skos:Concept']);
  });

  it('dedupes identical triples within a resource', () => {
    const g = new RdfGraph();
    const w = g.declare('https://ex/a', { types: [] });
    w.literal('gloss:identifier', 'X');
    w.literal('gloss:identifier', 'X');

    const r = g.get('https://ex/a')!;
    expect(r.triples).toHaveLength(1);
  });

  it('keeps distinct values for the same predicate', () => {
    const g = new RdfGraph();
    const w = g.declare('https://ex/a', { types: [] });
    w.literal('gloss:note', 'first');
    w.literal('gloss:note', 'second');

    const r = g.get('https://ex/a')!;
    expect(r.triples).toHaveLength(2);
    expect(r.triples.map(t => (t.object as any).value)).toEqual(['first', 'second']);
  });

  it('keeps literals with the same value but different language tags distinct', () => {
    const g = new RdfGraph();
    const w = g.declare('https://ex/a', { types: [] });
    w.literal('skos:prefLabel', 'term', { lang: 'en' });
    w.literal('skos:prefLabel', 'term', { lang: 'fr' });

    expect(g.get('https://ex/a')!.triples).toHaveLength(2);
  });

  it('treats blank nodes with the same content as duplicates', () => {
    const g = new RdfGraph();
    const w = g.declare('https://ex/a', { types: [] });
    w.blank('gloss:hasSource', [triple('rdf:value', lit('ISO 1'))]);
    w.blank('gloss:hasSource', [triple('rdf:value', lit('ISO 1'))]);

    expect(g.get('https://ex/a')!.triples).toHaveLength(1);
  });

  it('treats blank nodes with different content as distinct', () => {
    const g = new RdfGraph();
    const w = g.declare('https://ex/a', { types: [] });
    w.blank('gloss:hasSource', [triple('rdf:value', lit('ISO 1'))]);
    w.blank('gloss:hasSource', [triple('rdf:value', lit('ISO 2'))]);

    expect(g.get('https://ex/a')!.triples).toHaveLength(2);
  });

  it('skips empty literals and IRIs', () => {
    const g = new RdfGraph();
    const w = g.declare('https://ex/a', { types: [] });
    w.literal('gloss:note', '');
    w.iri('gloss:related', '');

    expect(g.get('https://ex/a')!.triples).toHaveLength(0);
  });

  it('skips blank node objects with no triples', () => {
    const g = new RdfGraph();
    const w = g.declare('https://ex/a', { types: [] });
    w.blank('gloss:hasSource', []);

    expect(g.get('https://ex/a')!.triples).toHaveLength(0);
  });
});

describe('termEquals', () => {
  it('compares IRIs by value', () => {
    expect(termEquals(iri('x'), iri('x'))).toBe(true);
    expect(termEquals(iri('x'), iri('y'))).toBe(false);
  });

  it('compares literals by value, lang, datatype', () => {
    expect(termEquals(lit('a'), lit('a'))).toBe(true);
    expect(termEquals(lit('a'), lit('a', { lang: 'en' }))).toBe(false);
    expect(termEquals(lit('a', { lang: 'en' }), lit('a', { lang: 'en' }))).toBe(true);
    expect(termEquals(lit('a', { lang: 'en' }), lit('a', { lang: 'fr' }))).toBe(false);
  });

  it('distinguishes kinds', () => {
    expect(termEquals(iri('a'), lit('a'))).toBe(false);
  });

  it('compares blank nodes structurally', () => {
    const b1 = blank(triple('p', lit('v')));
    const b2 = blank(triple('p', lit('v')));
    const b3 = blank(triple('p', lit('w')));
    expect(termEquals(b1, b2)).toBe(true);
    expect(termEquals(b1, b3)).toBe(false);
  });
});
