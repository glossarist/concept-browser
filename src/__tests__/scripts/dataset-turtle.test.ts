import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { buildDatasetTurtle } from '../../../scripts/lib/dataset-turtle.mjs';

const BASE = 'https://glossarist.org/dataset';

function makeInput(overrides: Record<string, any> = {}): any {
  return {
    datasetIri: `${BASE}/test`,
    registerId: 'test',
    title: 'Test Glossary',
    description: 'A test dataset.',
    modified: '2026-06-28',
    languages: ['eng', 'fra'],
    distributions: [
      {
        id: 'test-ttl',
        title: 'Turtle distribution',
        mediaType: 'text/turtle',
        downloadUrl: 'https://glossarist.org/data/test.ttl',
        byteSize: 12345,
      },
    ],
    topConceptUris: [`${BASE}/test/concept/1`, `${BASE}/test/concept/2`],
    sections: [
      {
        collectionIri: `${BASE}/test/section/3-1`,
        title: 'Geodetic concepts',
        memberUris: [`${BASE}/test/concept/1`],
      },
    ],
    ...overrides,
  };
}

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

const expand = (v: string): string => {
  if (v.startsWith('dcat:'))    return `http://www.w3.org/ns/dcat#${v.slice(5)}`;
  if (v.startsWith('skos:'))    return `http://www.w3.org/2004/02/skos/core#${v.slice(5)}`;
  if (v.startsWith('dcterms:')) return `http://purl.org/dc/terms/${v.slice(8)}`;
  if (v.startsWith('rdf:'))     return `http://www.w3.org/1999/02/22-rdf-syntax-ns#${v.slice(4)}`;
  if (v.startsWith('prov:'))    return `http://www.w3.org/ns/prov#${v.slice(5)}`;
  return v;
};

describe('buildDatasetTurtle (mjs)', () => {
  it('parses without errors and produces a non-empty graph', () => {
    const ttl = buildDatasetTurtle(makeInput());
    const store = parse(ttl);
    expect(store.size).toBeGreaterThan(0);
  });

  it('types the dataset as dcat:Dataset and skos:ConceptScheme', () => {
    const input = makeInput();
    const store = parse(buildDatasetTurtle(input));
    const types = store.getObjects(input.datasetIri, expand('rdf:type'), null).map(q => q.value);
    expect(types).toContain(expand('dcat:Dataset'));
    expect(types).toContain(expand('skos:ConceptScheme'));
  });

  it('emits a dcat:Distribution blank per distribution', () => {
    const input = makeInput();
    const store = parse(buildDatasetTurtle(input));
    const dists = store.getObjects(input.datasetIri, expand('dcat:distribution'), null);
    expect(dists.length).toBe(1);
    const mediaTypes = store.getObjects(dists[0], expand('dcat:mediaType'), null).map(q => q.value);
    expect(mediaTypes).toContain('text/turtle');
    const byteSizes = store.getObjects(dists[0], expand('dcat:byteSize'), null).map(q => q.value);
    expect(byteSizes).toContain('12345');
  });

  it('emits skos:Collection per section with skos:member entries', () => {
    const input = makeInput();
    const store = parse(buildDatasetTurtle(input));
    const section = input.sections[0];
    const types = store.getObjects(section.collectionIri, expand('rdf:type'), null).map(q => q.value);
    expect(types).toContain(expand('skos:Collection'));
    const members = store.getObjects(section.collectionIri, expand('skos:member'), null).map(q => q.value);
    expect(members).toContain(`${BASE}/test/concept/1`);
  });

  it('escapes double-quotes and backslashes in titles', () => {
    const input = makeInput({ title: 'has "quotes" and back\\slash' });
    const store = parse(buildDatasetTurtle(input));
    const titles = store.getObjects(input.datasetIri, expand('dcterms:title'), null).map(q => q.value);
    expect(titles).toContain('has "quotes" and back\\slash');
  });
});
