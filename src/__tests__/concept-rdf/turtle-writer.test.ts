import { describe, it, expect } from 'vitest';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { RdfGraph, lit, iri, blank, triple } from '../../components/concept-rdf/rdf-graph';

describe('writeTurtle', () => {
  it('declares all canonical @prefix lines', () => {
    const g = new RdfGraph();
    const out = writeTurtle(g);
    expect(out).toContain('@prefix gloss: <https://www.glossarist.org/ontologies/> .');
    expect(out).toContain('@prefix skos: <http://www.w3.org/2004/02/skos/core#> .');
    expect(out).toContain('@prefix skosxl: <http://www.w3.org/2008/05/skos-xl#> .');
    expect(out).toContain('@prefix dcterms: <http://purl.org/dc/terms/> .');
    expect(out).toContain('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
  });

  it('writes types after `a` keyword', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: ['gloss:Concept', 'skos:Concept'] })
      .literal('gloss:identifier', '1');
    const out = writeTurtle(g);
    expect(out).toMatch(/<https:\/\/ex\/c> a gloss:Concept, skos:Concept ;/);
  });

  it('terminates resources with full stops', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: ['gloss:Concept'] })
      .literal('gloss:identifier', '1');
    const out = writeTurtle(g);
    expect(out).toMatch(/gloss:identifier "1" \./);
    expect(out).not.toMatch(/gloss:identifier "1" ;/);
  });

  it('emits language-tagged literals', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .literal('skos:prefLabel', 'atomic', { lang: 'en' });
    const out = writeTurtle(g);
    expect(out).toContain('skos:prefLabel "atomic"@en');
  });

  it('emits datatyped literals', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .literal('gloss:value', '42', { datatype: 'xsd:integer' });
    const out = writeTurtle(g);
    expect(out).toContain('gloss:value "42"^^xsd:integer');
  });

  it('emits inline blank nodes with bracket syntax', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .blank('gloss:hasSource', [
        triple('rdf:value', lit('ISO 123')),
        triple('dcterms:title', lit('Standard')),
      ]);
    const out = writeTurtle(g);
    expect(out).toMatch(/gloss:hasSource \[ rdf:value "ISO 123" ; dcterms:title "Standard" \]/);
  });

  it('wraps absolute IRIs in angle brackets', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .iri('gloss:related', 'https://example.org/other');
    const out = writeTurtle(g);
    expect(out).toContain('gloss:related <https://example.org/other>');
  });

  it('escapes slash in prefixed local names (Turtle 1.1 PN_LOCAL rule)', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .iri('gloss:hasStatus', 'gloss:status/valid');
    const out = writeTurtle(g);
    expect(out).toContain('gloss:hasStatus gloss:status\\/valid');
    expect(out).not.toContain('gloss:hasStatus <gloss:status');
  });

  it('wraps relative IRIs (paths without scheme) in angle brackets', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .iri('gloss:image', 'fig_A.23.svg');
    const out = writeTurtle(g);
    expect(out).toContain('gloss:image <fig_A.23.svg>');
  });

  it('escapes special characters in literals', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .literal('gloss:note', 'She said "hi"\nand left');
    const out = writeTurtle(g);
    expect(out).toContain('"She said \\"hi\\"\\nand left"');
  });

  it('separates resources with blank lines', () => {
    const g = new RdfGraph();
    g.declare('https://ex/a', { types: [] }).literal('gloss:x', '1');
    g.declare('https://ex/b', { types: [] }).literal('gloss:x', '2');
    const out = writeTurtle(g);
    expect(out).toMatch(/\.\n\n<https:\/\/ex\/b>/);
  });

  it('handles a resource with no triples', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: ['gloss:Concept'] });
    const out = writeTurtle(g);
    expect(out).toMatch(/<https:\/\/ex\/c> a gloss:Concept \./);
  });

  it('handles a resource with no types', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', {}).literal('gloss:x', '1');
    const out = writeTurtle(g);
    expect(out).toMatch(/<https:\/\/ex\/c> gloss:x "1" \./);
  });
});
