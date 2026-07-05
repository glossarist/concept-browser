import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { buildAgentsTurtle } from '../../../scripts/lib/agents-turtle.mjs';

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

const FOAF = 'http://xmlns.com/foaf/0.1/';
const PROV = 'http://www.w3.org/ns/prov#';
const DCTERMS = 'http://purl.org/dc/terms/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

describe('buildAgentsTurtle (mjs)', () => {
  it('parses without errors', async () => {
    const ttl = await buildAgentsTurtle([{ name: 'Ada Lovelace' }], 'https://glossarist.org/agent');
    const store = parse(ttl);
    expect(store.size).toBeGreaterThan(0);
  });

  it('types each person as foaf:Person, prov:Person, prov:Agent', async () => {
    const ttl = await buildAgentsTurtle([{ name: 'Ada Lovelace' }], 'https://glossarist.org/agent');
    const store = parse(ttl);
    const types = store.getObjects('https://glossarist.org/agent/ada-lovelace', RDF_TYPE, null).map(q => q.value);
    expect(types).toContain(`${FOAF}Person`);
    expect(types).toContain(`${PROV}Person`);
    expect(types).toContain(`${PROV}Agent`);
  });

  it('records name, mailto mbox, role, and seeAlso', async () => {
    const ttl = await buildAgentsTurtle([
      { name: 'Ada Lovelace', email: 'ada@example.org', role: 'Editor', url: 'https://example.org/ada' },
    ], 'https://glossarist.org/agent');
    const store = parse(ttl);
    const iri = 'https://glossarist.org/agent/ada-lovelace';
    expect(store.getObjects(iri, `${FOAF}name`, null).map(q => q.value)).toContain('Ada Lovelace');
    expect(store.getObjects(iri, `${FOAF}mbox`, null).map(q => q.value)).toContain('mailto:ada@example.org');
    expect(store.getObjects(iri, `${DCTERMS}description`, null).map(q => q.value)).toContain('Editor');
    expect(store.getObjects(iri, 'http://www.w3.org/2000/01/rdf-schema#seeAlso', null).map(q => q.value)).toContain('https://example.org/ada');
  });

  it('creates a single prov:Organization per unique organization', async () => {
    const ttl = await buildAgentsTurtle([
      { name: 'Alice', organization: 'ISO' },
      { name: 'Bob',   organization: 'ISO' },
    ], 'https://glossarist.org/agent');
    const store = parse(ttl);
    const types = store.getObjects('https://glossarist.org/org/iso', RDF_TYPE, null).map(q => q.value);
    expect(types).toContain(`${FOAF}Organization`);
    expect(types).toContain(`${PROV}Organization`);
  });

  it('emits only prefix declarations for an empty input', async () => {
    const ttl = await buildAgentsTurtle([], 'https://glossarist.org/agent');
    expect(ttl).toContain('@prefix foaf:');
    expect(ttl).not.toContain('<https://glossarist.org/agent/');
  });
});
