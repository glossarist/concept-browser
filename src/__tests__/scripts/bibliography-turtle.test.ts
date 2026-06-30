import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { buildBibliographyTurtle } from '../../../scripts/lib/bibliography-turtle.mjs';

const FOAF = 'http://xmlns.com/foaf/0.1/';
const DCTERMS = 'http://purl.org/dc/terms/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

describe('buildBibliographyTurtle (mjs)', () => {
  it('parses without errors', () => {
    const ttl = buildBibliographyTurtle('iso-geodetic', { iso704: { reference: 'ISO 704' } });
    const store = parse(ttl);
    expect(store.size).toBeGreaterThan(0);
  });

  it('types each entry as dcterms:BibliographicResource', () => {
    const ttl = buildBibliographyTurtle('iso-geodetic', { iso704: { reference: 'ISO 704' } });
    const store = parse(ttl);
    const types = store.getObjects('https://glossarist.org/iso-geodetic/bib/iso704', RDF_TYPE, null).map(q => q.value);
    expect(types).toContain(`${DCTERMS}BibliographicResource`);
  });

  it('emits identifier, bibliographicCitation, and title', () => {
    const ttl = buildBibliographyTurtle('iso-geodetic', {
      iso704: { reference: 'ISO 704', title: 'Terminology work — Principles and methods' },
    });
    const store = parse(ttl);
    const iri = 'https://glossarist.org/iso-geodetic/bib/iso704';
    expect(store.getObjects(iri, `${DCTERMS}identifier`, null).map(q => q.value)).toContain('iso704');
    expect(store.getObjects(iri, `${DCTERMS}bibliographicCitation`, null).map(q => q.value)).toContain('ISO 704');
    expect(store.getObjects(iri, `${DCTERMS}title`, null).map(q => q.value)).toContain('Terminology work — Principles and methods');
  });

  it('emits foaf:page when link is provided', () => {
    const ttl = buildBibliographyTurtle('iso-geodetic', {
      ref: { reference: 'X', link: 'https://example.org/x' },
    });
    const store = parse(ttl);
    const iri = 'https://glossarist.org/iso-geodetic/bib/ref';
    expect(store.getObjects(iri, `${FOAF}page`, null).map(q => q.value)).toContain('https://example.org/x');
  });

  it('emits one resource per bibliography entry', () => {
    const ttl = buildBibliographyTurtle('iso-geodetic', {
      a: { reference: 'A' },
      b: { reference: 'B' },
    });
    const store = parse(ttl);
    expect(store.getObjects('https://glossarist.org/iso-geodetic/bib/a', `${DCTERMS}bibliographicCitation`, null).map(q => q.value)).toContain('A');
    expect(store.getObjects('https://glossarist.org/iso-geodetic/bib/b', `${DCTERMS}bibliographicCitation`, null).map(q => q.value)).toContain('B');
  });
});