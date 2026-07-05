import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { buildActivityTurtle } from '../../../scripts/lib/build-activity-turtle.mjs';

function makeInput(overrides: any = {}): any {
  return {
    runId: '2026-06-28T12-00-00Z',
    startedAt: '2026-06-28T12:00:00Z',
    endedAt: '2026-06-28T12:05:00Z',
    gitSha: 'abc1234',
    gitBranch: 'main',
    toolId: 'concept-browser',
    toolVersion: '0.7.51',
    datasetRegisters: ['iso-geodetic'],
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

const ACTIVITY_IRI = (runId: string) => `https://glossarist.org/activity/build/${runId}`;
const expand = (v: string): string => {
  if (v.startsWith('prov:'))    return `http://www.w3.org/ns/prov#${v.slice(5)}`;
  if (v.startsWith('dcterms:')) return `http://purl.org/dc/terms/${v.slice(8)}`;
  if (v.startsWith('rdf:'))     return `http://www.w3.org/1999/02/22-rdf-syntax-ns#${v.slice(4)}`;
  if (v.startsWith('xsd:'))     return `http://www.w3.org/2001/XMLSchema#${v.slice(4)}`;
  if (v.startsWith('foaf:'))    return `http://xmlns.com/foaf/0.1/${v.slice(5)}`;
  return v;
};

describe('buildActivityTurtle (mjs)', () => {
  it('parses without errors', async () => {
    const ttl = await buildActivityTurtle(makeInput());
    const store = parse(ttl);
    expect(store.size).toBeGreaterThan(0);
  });

  it('types the activity as prov:Activity', async () => {
    const input = makeInput();
    const store = parse(await buildActivityTurtle(input));
    const types = store.getObjects(ACTIVITY_IRI(input.runId), expand('rdf:type'), null).map(q => q.value);
    expect(types).toContain(expand('prov:Activity'));
  });

  it('records git commit and tool as prov:used', async () => {
    const input = makeInput();
    const store = parse(await buildActivityTurtle(input));
    const used = store.getObjects(ACTIVITY_IRI(input.runId), expand('prov:used'), null).map(q => q.value);
    expect(used).toContain(`https://glossarist.org/commit/${input.gitSha}`);
    expect(used).toContain(`https://glossarist.org/tool/${input.toolId}/${input.toolVersion}`);
  });

  it('references every dataset register via prov:used', async () => {
    const input = makeInput({ datasetRegisters: ['a', 'b', 'c'] });
    const store = parse(await buildActivityTurtle(input));
    const used = store.getObjects(ACTIVITY_IRI(input.runId), expand('prov:used'), null).map(q => q.value);
    for (const r of input.datasetRegisters) {
      expect(used).toContain(`https://glossarist.org/${r}/`);
    }
  });

  it('associates the CI agent when provided', async () => {
    const input = makeInput();
    const store = parse(await buildActivityTurtle(input));
    const agents = store.getObjects(ACTIVITY_IRI(input.runId), expand('prov:wasAssociatedWith'), null).map(q => q.value);
    expect(agents).toContain(input.associatedAgentIri);
  });
});
