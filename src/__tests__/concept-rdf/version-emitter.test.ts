import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { emitVersionGraph, emitVersionHistory } from '../../components/concept-rdf/version-emitter';

const PROV = 'http://www.w3.org/ns/prov#';
const DCTERMS = 'http://purl.org/dc/terms/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

const VERSION_IRI = 'https://glossarist.org/test/versions/1.0';

function makeInput() {
  return {
    registerId: 'test',
    version: '1.0',
    versionIri: VERSION_IRI,
    datasetIri: 'https://glossarist.org/test/',
    generatedAt: '2026-06-28T12:00:00Z',
  };
}

describe('emitVersionGraph — J6 dataset versioning', () => {
  it('types the version as prov:Entity', () => {
    const graph = emitVersionGraph(makeInput());
    const store = parse(writeTurtle(graph));
    const types = store.getObjects(VERSION_IRI, RDF_TYPE, null).map(q => q.value);
    expect(types).toContain(`${PROV}Entity`);
  });

  it('emits dcterms:isVersionOf pointing at the canonical dataset IRI', () => {
    const graph = emitVersionGraph(makeInput());
    const store = parse(writeTurtle(graph));
    const targets = store.getObjects(VERSION_IRI, `${DCTERMS}isVersionOf`, null).map(q => q.value);
    expect(targets).toContain('https://glossarist.org/test/');
  });

  it('emits prov:generatedAtTime as xsd:dateTime', () => {
    const graph = emitVersionGraph(makeInput());
    const store = parse(writeTurtle(graph));
    const ts = store.getObjects(VERSION_IRI, `${PROV}generatedAtTime`, null).map(q => q.value);
    expect(ts).toContain('2026-06-28T12:00:00Z');
  });

  it('emits prov:wasRevisionOf when a previous version is provided', () => {
    const graph = emitVersionGraph({ ...makeInput(), previousVersionIri: 'https://glossarist.org/test/versions/0.9' });
    const store = parse(writeTurtle(graph));
    const prev = store.getObjects(VERSION_IRI, `${PROV}wasRevisionOf`, null).map(q => q.value);
    expect(prev).toContain('https://glossarist.org/test/versions/0.9');
  });

  it('omits prov:wasRevisionOf when no previous version', () => {
    const graph = emitVersionGraph(makeInput());
    const store = parse(writeTurtle(graph));
    const prev = store.getObjects(VERSION_IRI, `${PROV}wasRevisionOf`, null);
    expect(prev).toHaveLength(0);
  });

  it('records change summary and associated agent when provided', () => {
    const graph = emitVersionGraph({
      ...makeInput(),
      changeSummary: 'Initial release',
      associatedAgentIri: 'https://glossarist.org/agent/ci-bot',
    });
    const store = parse(writeTurtle(graph));
    const summaries = store.getObjects(VERSION_IRI, `${DCTERMS}description`, null).map(q => q.value);
    expect(summaries).toContain('Initial release');
    const agents = store.getObjects(VERSION_IRI, `${PROV}wasAssociatedWith`, null).map(q => q.value);
    expect(agents).toContain('https://glossarist.org/agent/ci-bot');
  });
});

describe('emitVersionHistory', () => {
  it('emits a chain of versions with prov:wasRevisionOf links', () => {
    const graph = emitVersionHistory({
      registerId: 'test',
      datasetIri: 'https://glossarist.org/test/',
      versions: [
        { version: '1.0', generatedAt: '2024-01-01T00:00:00Z' },
        { version: '1.1', generatedAt: '2024-06-01T00:00:00Z', changeSummary: 'Add 50 terms' },
        { version: '2.0', generatedAt: '2025-01-01T00:00:00Z', changeSummary: 'Major release' },
      ],
      associatedAgentIri: 'https://glossarist.org/agent/ci-bot',
    });

    const store = parse(writeTurtle(graph));
    const iri10 = 'https://glossarist.org/test/versions/1.0';
    const iri11 = 'https://glossarist.org/test/versions/1.1';
    const iri20 = 'https://glossarist.org/test/versions/2.0';

    expect(store.getObjects(iri10, RDF_TYPE, null).length).toBeGreaterThan(0);
    expect(store.getObjects(iri11, RDF_TYPE, null).length).toBeGreaterThan(0);
    expect(store.getObjects(iri20, RDF_TYPE, null).length).toBeGreaterThan(0);

    const v11Prev = store.getObjects(iri11, `${PROV}wasRevisionOf`, null).map(q => q.value);
    expect(v11Prev).toContain(iri10);

    const v20Prev = store.getObjects(iri20, `${PROV}wasRevisionOf`, null).map(q => q.value);
    expect(v20Prev).toContain(iri11);

    const v10Prev = store.getObjects(iri10, `${PROV}wasRevisionOf`, null);
    expect(v10Prev).toHaveLength(0);
  });

  it('emits an empty graph when versions array is empty', () => {
    const graph = emitVersionHistory({
      registerId: 'test',
      datasetIri: 'https://glossarist.org/test/',
      versions: [],
    });
    const resources = Array.from(graph.resources());
    expect(resources.length).toBe(0);
  });
});