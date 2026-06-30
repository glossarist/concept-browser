import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import {
  emitImageVariantGraph,
  imageVariantIri,
} from '../../components/concept-rdf/image-variant-emitter';

const FOAF = 'http://xmlns.com/foaf/0.1/';
const DCTERMS = 'http://purl.org/dc/terms/';
const DCAT = 'http://www.w3.org/ns/dcat#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

describe('WS K2 — image binary references', () => {
  it('types each image variant as foaf:Image', () => {
    const graph = emitImageVariantGraph({
      registerId: 'iso-geodetic',
      figureId: 'fig_1',
      lang: 'eng',
      format: 'svg',
      downloadUrl: 'https://glossarist.org/data/iso-geodetic/images/fig_1.svg',
    });
    const store = parse(writeTurtle(graph));
    const iri = imageVariantIri({
      registerId: 'iso-geodetic',
      figureId: 'fig_1',
      lang: 'eng',
      format: 'svg',
      downloadUrl: 'x',
    });
    const types = store.getObjects(iri, RDF_TYPE, null).map(q => q.value);
    expect(types).toContain(`${FOAF}Image`);
  });

  it('emits dcterms:format with the correct MIME type', () => {
    const cases: Array<{ format: 'svg' | 'png' | 'webp' | 'jpg' | 'gif'; mime: string }> = [
      { format: 'svg', mime: 'image/svg+xml' },
      { format: 'png', mime: 'image/png' },
      { format: 'webp', mime: 'image/webp' },
      { format: 'jpg', mime: 'image/jpeg' },
      { format: 'gif', mime: 'image/gif' },
    ];
    for (const { format, mime } of cases) {
      const graph = emitImageVariantGraph({
        registerId: 'r',
        figureId: 'f',
        format,
        downloadUrl: 'x',
      });
      const store = parse(writeTurtle(graph));
      const iri = imageVariantIri({ registerId: 'r', figureId: 'f', format, downloadUrl: 'x' });
      const formats = store.getObjects(iri, `${DCTERMS}format`, null).map(q => q.value);
      expect(formats).toContain(mime);
    }
  });

  it('emits dcterms:language when lang is provided', () => {
    const graph = emitImageVariantGraph({
      registerId: 'r',
      figureId: 'f',
      lang: 'fra',
      format: 'svg',
      downloadUrl: 'x',
    });
    const store = parse(writeTurtle(graph));
    const iri = imageVariantIri({ registerId: 'r', figureId: 'f', lang: 'fra', format: 'svg', downloadUrl: 'x' });
    const langs = store.getObjects(iri, `${DCTERMS}language`, null).map(q => q.value);
    expect(langs).toContain('fra');
  });

  it('omits dcterms:language when lang is absent', () => {
    const graph = emitImageVariantGraph({
      registerId: 'r',
      figureId: 'f',
      format: 'svg',
      downloadUrl: 'x',
    });
    const store = parse(writeTurtle(graph));
    const iri = imageVariantIri({ registerId: 'r', figureId: 'f', format: 'svg', downloadUrl: 'x' });
    const langs = store.getObjects(iri, `${DCTERMS}language`, null);
    expect(langs.length).toBe(0);
  });

  it('emits dcat:byteSize as xsd:integer when byteSize is provided', () => {
    const graph = emitImageVariantGraph({
      registerId: 'r',
      figureId: 'f',
      format: 'png',
      byteSize: 12345,
      downloadUrl: 'x',
    });
    const store = parse(writeTurtle(graph));
    const iri = imageVariantIri({ registerId: 'r', figureId: 'f', format: 'png', byteSize: 0, downloadUrl: 'x' });
    const sizes = store.getObjects(iri, `${DCAT}byteSize`, null);
    expect(sizes.length).toBe(1);
    expect((sizes[0] as any).value).toBe('12345');
    expect((sizes[0] as any).datatype.value).toBe('http://www.w3.org/2001/XMLSchema#integer');
  });

  it('emits dcat:downloadURL pointing at the binary asset', () => {
    const graph = emitImageVariantGraph({
      registerId: 'iso-geodetic',
      figureId: 'fig_1',
      lang: 'eng',
      format: 'svg',
      downloadUrl: 'https://glossarist.org/data/iso-geodetic/images/fig_1.svg',
    });
    const store = parse(writeTurtle(graph));
    const iri = imageVariantIri({
      registerId: 'iso-geodetic',
      figureId: 'fig_1',
      lang: 'eng',
      format: 'svg',
      downloadUrl: 'x',
    });
    const urls = store.getObjects(iri, `${DCAT}downloadURL`, null).map(q => q.value);
    expect(urls).toContain('https://glossarist.org/data/iso-geodetic/images/fig_1.svg');
  });

  it('produces distinct IRIs per (figure, lang, format) combination', () => {
    const iri1 = imageVariantIri({ registerId: 'r', figureId: 'f', lang: 'eng', format: 'svg', downloadUrl: 'x' });
    const iri2 = imageVariantIri({ registerId: 'r', figureId: 'f', lang: 'eng', format: 'png', downloadUrl: 'x' });
    const iri3 = imageVariantIri({ registerId: 'r', figureId: 'f', lang: 'fra', format: 'svg', downloadUrl: 'x' });
    expect(iri1).not.toBe(iri2);
    expect(iri1).not.toBe(iri3);
    expect(iri2).not.toBe(iri3);
  });
});