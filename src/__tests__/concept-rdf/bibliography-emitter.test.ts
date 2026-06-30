import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { emitBibliographyGraph, bibliographyEntryIri } from '../../components/concept-rdf/bibliography-emitter';

const FOAF = 'http://xmlns.com/foaf/0.1/';
const DCTERMS = 'http://purl.org/dc/terms/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

describe('emitBibliographyGraph — K5 bibliography graph', () => {
  it('types each entry as dcterms:BibliographicResource', () => {
    const graph = emitBibliographyGraph({
      registerId: 'iso-geodetic',
      entries: [{ id: 'iso-704', reference: 'ISO 704' }],
    });
    const store = parse(writeTurtle(graph));
    const iri = bibliographyEntryIri('iso-geodetic', 'iso-704');
    const types = store.getObjects(iri, RDF_TYPE, null).map(q => q.value);
    expect(types).toContain(`${DCTERMS}BibliographicResource`);
  });

  it('emits identifier, bibliographicCitation, and title as literals', () => {
    const graph = emitBibliographyGraph({
      registerId: 'iso-geodetic',
      entries: [
        { id: 'iso-704', reference: 'ISO 704', title: 'Terminology work — Principles and methods' },
      ],
    });
    const store = parse(writeTurtle(graph));
    const iri = bibliographyEntryIri('iso-geodetic', 'iso-704');
    const ids = store.getObjects(iri, `${DCTERMS}identifier`, null).map(q => q.value);
    expect(ids).toContain('iso-704');
    const cites = store.getObjects(iri, `${DCTERMS}bibliographicCitation`, null).map(q => q.value);
    expect(cites).toContain('ISO 704');
    const titles = store.getObjects(iri, `${DCTERMS}title`, null).map(q => q.value);
    expect(titles).toContain('Terminology work — Principles and methods');
  });

  it('emits foaf:page when link is provided', () => {
    const graph = emitBibliographyGraph({
      registerId: 'iso-geodetic',
      entries: [{ id: 'ref', reference: 'X', link: 'https://example.org/x' }],
    });
    const store = parse(writeTurtle(graph));
    const iri = bibliographyEntryIri('iso-geodetic', 'ref');
    const pages = store.getObjects(iri, `${FOAF}page`, null).map(q => q.value);
    expect(pages).toContain('https://example.org/x');
  });

  it('omits foaf:page when link is absent', () => {
    const graph = emitBibliographyGraph({
      registerId: 'iso-geodetic',
      entries: [{ id: 'no-link', reference: 'Y' }],
    });
    const store = parse(writeTurtle(graph));
    const iri = bibliographyEntryIri('iso-geodetic', 'no-link');
    const pages = store.getObjects(iri, `${FOAF}page`, null);
    expect(pages).toHaveLength(0);
  });

  it('emits one resource per entry', () => {
    const graph = emitBibliographyGraph({
      registerId: 'iso-geodetic',
      entries: [
        { id: 'a', reference: 'A' },
        { id: 'b', reference: 'B' },
        { id: 'c', reference: 'C' },
      ],
    });
    const iriA = bibliographyEntryIri('iso-geodetic', 'a');
    const iriB = bibliographyEntryIri('iso-geodetic', 'b');
    const iriC = bibliographyEntryIri('iso-geodetic', 'c');
    const store = parse(writeTurtle(graph));
    expect(store.getObjects(iriA, `${DCTERMS}bibliographicCitation`, null).map(q => q.value)).toContain('A');
    expect(store.getObjects(iriB, `${DCTERMS}bibliographicCitation`, null).map(q => q.value)).toContain('B');
    expect(store.getObjects(iriC, `${DCTERMS}bibliographicCitation`, null).map(q => q.value)).toContain('C');
  });

  it('links each entry to the dataset via dcterms:isPartOf', () => {
    const graph = emitBibliographyGraph({
      registerId: 'iso-geodetic',
      entries: [{ id: 'a', reference: 'A' }],
    });
    const store = parse(writeTurtle(graph));
    const iri = bibliographyEntryIri('iso-geodetic', 'a');
    const parts = store.getObjects(iri, `${DCTERMS}isPartOf`, null).map(q => q.value);
    expect(parts).toContain('https://glossarist.org/iso-geodetic/');
  });
});