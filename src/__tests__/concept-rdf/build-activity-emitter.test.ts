import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { emitBuildActivityGraph, activityIri } from '../../components/concept-rdf/build-activity-emitter';
import type { BuildActivityInput } from '../../components/concept-rdf/build-activity-emitter';

function makeInput(overrides: Partial<BuildActivityInput> = {}): BuildActivityInput {
  return {
    runId: '2026-06-28T12-00-00Z',
    startedAt: '2026-06-28T12:00:00Z',
    endedAt: '2026-06-28T12:05:00Z',
    gitSha: 'abc1234',
    gitBranch: 'main',
    toolId: 'concept-browser',
    toolVersion: '0.7.51',
    datasetRegisters: ['iso-geodetic', 'iso-10303-2-terms'],
    conceptCount: 1234,
    associatedAgentIri: 'https://glossarist.org/agent/ci-bot',
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
  if (v.startsWith('prov:'))    return `http://www.w3.org/ns/prov#${v.slice(5)}`;
  if (v.startsWith('dcterms:')) return `http://purl.org/dc/terms/${v.slice(8)}`;
  if (v.startsWith('rdf:'))     return `http://www.w3.org/1999/02/22-rdf-syntax-ns#${v.slice(4)}`;
  if (v.startsWith('xsd:'))     return `http://www.w3.org/2001/XMLSchema#${v.slice(4)}`;
  if (v.startsWith('foaf:'))    return `http://xmlns.com/foaf/0.1/${v.slice(5)}`;
  return v;
};

describe('emitBuildActivityGraph — J7 build activity records', () => {
  it('types the activity as prov:Activity', () => {
    const input = makeInput();
    const graph = emitBuildActivityGraph(input);
    const store = parse(writeTurtle(graph));
    const iri = activityIri(input);
    const types = store.getObjects(iri, expand('rdf:type'), null).map(q => q.value);
    expect(types).toContain(expand('prov:Activity'));
  });

  it('records the start and end times', () => {
    const input = makeInput();
    const graph = emitBuildActivityGraph(input);
    const store = parse(writeTurtle(graph));
    const iri = activityIri(input);
    const generated = store.getObjects(iri, expand('prov:generatedAtTime'), null).map(q => q.value);
    expect(generated).toContain('2026-06-28T12:05:00Z');
  });

  it('types the tool as prov:SoftwareAgent with version', () => {
    const input = makeInput();
    const graph = emitBuildActivityGraph(input);
    const store = parse(writeTurtle(graph));
    const toolIri = `https://glossarist.org/tool/${input.toolId}/${input.toolVersion}`;
    const types = store.getObjects(toolIri, expand('rdf:type'), null).map(q => q.value);
    expect(types).toContain(expand('prov:SoftwareAgent'));
    const version = store.getObjects(toolIri, expand('prov:version'), null).map(q => q.value);
    expect(version).toContain(input.toolVersion);
  });

  it('records the git commit and the tool as prov:used entities', () => {
    const input = makeInput();
    const graph = emitBuildActivityGraph(input);
    const store = parse(writeTurtle(graph));
    const iri = activityIri(input);
    const used = store.getObjects(iri, expand('prov:used'), null).map(q => q.value);
    expect(used).toContain(`https://glossarist.org/commit/${input.gitSha}`);
    expect(used).toContain(`https://glossarist.org/tool/${input.toolId}/${input.toolVersion}`);
  });

  it('references every dataset register via prov:used', () => {
    const input = makeInput();
    const graph = emitBuildActivityGraph(input);
    const store = parse(writeTurtle(graph));
    const iri = activityIri(input);
    const used = store.getObjects(iri, expand('prov:used'), null).map(q => q.value);
    for (const register of input.datasetRegisters) {
      expect(used).toContain(`https://glossarist.org/${register}/`);
    }
  });

  it('records the concept count as an xsd:integer literal', () => {
    const input = makeInput();
    const graph = emitBuildActivityGraph(input);
    const store = parse(writeTurtle(graph));
    const iri = activityIri(input);
    const counts = store.getObjects(iri, 'https://www.glossarist.org/ontologies/conceptCount', null).map(q => q.value);
    expect(counts).toContain('1234');
  });

  it('associates the CI agent when provided', () => {
    const input = makeInput();
    const graph = emitBuildActivityGraph(input);
    const store = parse(writeTurtle(graph));
    const iri = activityIri(input);
    const agents = store.getObjects(iri, expand('prov:wasAssociatedWith'), null).map(q => q.value);
    expect(agents).toContain(input.associatedAgentIri);

    const agentTypes = store.getObjects(input.associatedAgentIri!, expand('rdf:type'), null).map(q => q.value);
    expect(agentTypes).toContain(expand('prov:Agent'));
  });

  it('omits the commit entity when gitSha is not provided', () => {
    const input = makeInput({ gitSha: undefined, gitBranch: undefined });
    const graph = emitBuildActivityGraph(input);
    const store = parse(writeTurtle(graph));
    const iri = activityIri(input);
    const used = store.getObjects(iri, expand('prov:used'), null).map(q => q.value);
    expect(used.some(u => u.includes('/commit/'))).toBe(false);
  });
});
