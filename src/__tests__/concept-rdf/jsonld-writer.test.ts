import { describe, it, expect } from 'vitest';
import { writeJsonLd } from '../../components/concept-rdf/jsonld-writer';
import { RdfGraph, lit, iri, blank, triple } from '../../components/concept-rdf/rdf-graph';

describe('writeJsonLd', () => {
  it('produces a JSON-LD document with @context and @graph', () => {
    const g = new RdfGraph();
    const out = writeJsonLd(g);
    const doc = JSON.parse(out);
    expect(doc['@context']).toBeDefined();
    expect(Array.isArray(doc['@graph'])).toBe(true);
    expect(doc['@context'].gloss).toBe('https://www.glossarist.org/ontologies/');
    expect(doc['@context'].skosxl).toBe('http://www.w3.org/2008/05/skos-xl#');
  });

  it('emits @id and @type for each resource', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: ['gloss:Concept', 'skos:Concept'] });
    const out = writeJsonLd(g);
    const doc = JSON.parse(out);
    const node = doc['@graph'][0];
    expect(node['@id']).toBe('https://ex/c');
    expect(node['@type']).toEqual(['gloss:Concept', 'skos:Concept']);
  });

  it('emits plain string literals for untagged values', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .literal('gloss:identifier', 'X');
    const out = writeJsonLd(g);
    const doc = JSON.parse(out);
    expect(doc['@graph'][0]['gloss:identifier']).toBe('X');
  });

  it('emits language-tagged literals as @value/@language objects', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .literal('skos:prefLabel', 'term', { lang: 'eng' });
    const out = writeJsonLd(g);
    const doc = JSON.parse(out);
    expect(doc['@graph'][0]['skos:prefLabel']).toEqual({ '@value': 'term', '@language': 'eng' });
  });

  it('emits datatyped literals as @value/@type objects', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .literal('gloss:value', '42', { datatype: 'xsd:integer' });
    const out = writeJsonLd(g);
    const doc = JSON.parse(out);
    expect(doc['@graph'][0]['gloss:value']).toEqual({ '@value': '42', '@type': 'xsd:integer' });
  });

  it('emits IRI objects as @id references', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .iri('gloss:related', 'https://ex/other');
    const out = writeJsonLd(g);
    const doc = JSON.parse(out);
    expect(doc['@graph'][0]['gloss:related']).toEqual({ '@id': 'https://ex/other' });
  });

  it('emits single object for predicates with one value', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .literal('gloss:note', 'one');
    const out = writeJsonLd(g);
    const doc = JSON.parse(out);
    expect(doc['@graph'][0]['gloss:note']).toBe('one');
  });

  it('emits arrays for predicates with multiple values', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .literal('gloss:note', 'one')
      .literal('gloss:note', 'two');
    const out = writeJsonLd(g);
    const doc = JSON.parse(out);
    expect(doc['@graph'][0]['gloss:note']).toEqual(['one', 'two']);
  });

  it('serializes blank nodes as nested objects', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .blank('gloss:hasSource', [
        triple('rdf:value', lit('ISO 123')),
        triple('dcterms:title', lit('Standard')),
      ]);
    const out = writeJsonLd(g);
    const doc = JSON.parse(out);
    expect(doc['@graph'][0]['gloss:hasSource']).toEqual({
      'rdf:value': 'ISO 123',
      'dcterms:title': 'Standard',
    });
  });

  it('serializes multiple blank nodes for the same predicate as an array', () => {
    const g = new RdfGraph();
    g.declare('https://ex/c', { types: [] })
      .blank('gloss:hasSource', [triple('rdf:value', lit('A'))])
      .blank('gloss:hasSource', [triple('rdf:value', lit('B'))]);
    const out = writeJsonLd(g);
    const doc = JSON.parse(out);
    expect(Array.isArray(doc['@graph'][0]['gloss:hasSource'])).toBe(true);
    expect(doc['@graph'][0]['gloss:hasSource']).toEqual([
      { 'rdf:value': 'A' },
      { 'rdf:value': 'B' },
    ]);
  });
});
