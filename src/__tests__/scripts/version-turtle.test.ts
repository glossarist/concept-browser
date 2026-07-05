import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { buildVersionTurtle, buildVersionHistoryTurtle } from '../../../scripts/lib/version-turtle.mjs';

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

const PROV = 'http://www.w3.org/ns/prov#';
const DCTERMS = 'http://purl.org/dc/terms/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

describe('buildVersionTurtle (mjs)', () => {
  it('parses without errors', async () => {
    const ttl = await buildVersionTurtle({
      registerId: 'test',
      version: '1.0',
      versionIri: 'https://glossarist.org/test/versions/1.0',
      datasetIri: 'https://glossarist.org/test/',
      generatedAt: '2026-06-28T12:00:00Z',
    });
    const store = parse(ttl);
    expect(store.size).toBeGreaterThan(0);
  });

  it('types the version as prov:Entity', async () => {
    const ttl = await buildVersionTurtle({
      registerId: 'test',
      version: '1.0',
      versionIri: 'https://glossarist.org/test/versions/1.0',
      datasetIri: 'https://glossarist.org/test/',
      generatedAt: '2026-06-28T12:00:00Z',
    });
    const store = parse(ttl);
    const types = store.getObjects('https://glossarist.org/test/versions/1.0', RDF_TYPE, null).map(q => q.value);
    expect(types).toContain(`${PROV}Entity`);
  });

  it('emits prov:wasRevisionOf when a previous version is provided', async () => {
    const ttl = await buildVersionTurtle({
      registerId: 'test',
      version: '1.0',
      versionIri: 'https://glossarist.org/test/versions/1.0',
      datasetIri: 'https://glossarist.org/test/',
      generatedAt: '2026-06-28T12:00:00Z',
      previousVersionIri: 'https://glossarist.org/test/versions/0.9',
    });
    const store = parse(ttl);
    const prev = store.getObjects('https://glossarist.org/test/versions/1.0', `${PROV}wasRevisionOf`, null).map(q => q.value);
    expect(prev).toContain('https://glossarist.org/test/versions/0.9');
  });
});

describe('buildVersionHistoryTurtle (mjs)', () => {
  it('emits a chain with revision links', async () => {
    const ttl = await buildVersionHistoryTurtle({
      registerId: 'test',
      datasetIri: 'https://glossarist.org/test/',
      versions: [
        { version: '1.0', generatedAt: '2024-01-01T00:00:00Z' },
        { version: '1.1', generatedAt: '2024-06-01T00:00:00Z' },
      ],
    });
    const store = parse(ttl);
    const iri11 = 'https://glossarist.org/test/versions/1.1';
    const prev = store.getObjects(iri11, `${PROV}wasRevisionOf`, null).map(q => q.value);
    expect(prev).toContain('https://glossarist.org/test/versions/1.0');
  });
});
