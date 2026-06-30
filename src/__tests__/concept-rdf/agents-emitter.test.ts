import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import {
  agentsFromContributors,
  emitAgentsGraph,
} from '../../components/concept-rdf/agents-emitter';

const FOAF = 'http://xmlns.com/foaf/0.1/';
const PROV = 'http://www.w3.org/ns/prov#';
const DCTERMS = 'http://purl.org/dc/terms/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

describe('agentsFromContributors', () => {
  it('turns each contributor into an AgentInput with a slugified IRI', () => {
    const agents = agentsFromContributors([
      { name: 'Ada Lovelace', role: 'Editor', organization: 'Royal Society', email: 'ada@example.org' },
      { name: 'Grace Hopper', organization: 'USN' },
    ]);
    expect(agents.length).toBe(2);
    expect(agents[0].agentIri).toBe('https://glossarist.org/agent/ada-lovelace');
    expect(agents[1].agentIri).toBe('https://glossarist.org/agent/grace-hopper');
    expect(agents[0].role).toBe('Editor');
  });

  it('deduplicates organizations by slug', () => {
    const result = emitAgentsGraph(agentsFromContributors([
      { name: 'Alice', organization: 'ISO' },
      { name: 'Bob',   organization: 'ISO' },
      { name: 'Carol', organization: 'IEC' },
    ]));
    expect(result.organizationIris.length).toBe(2);
  });
});

describe('emitAgentsGraph — J4 agent records', () => {
  it('types each person as foaf:Person, prov:Person, prov:Agent', () => {
    const graph = emitAgentsGraph(agentsFromContributors([
      { name: 'Ada Lovelace', email: 'ada@example.org' },
    ]));
    const store = parse(writeTurtle(graph.graph));
    const types = store.getObjects('https://glossarist.org/agent/ada-lovelace', RDF_TYPE, null).map(q => q.value);
    expect(types).toContain(`${FOAF}Person`);
    expect(types).toContain(`${PROV}Person`);
    expect(types).toContain(`${PROV}Agent`);
  });

  it('records name, email (as mailto IRI), role, and url', () => {
    const graph = emitAgentsGraph(agentsFromContributors([
      { name: 'Ada Lovelace', role: 'Editor', email: 'ada@example.org', url: 'https://example.org/ada' },
    ]));
    const store = parse(writeTurtle(graph.graph));
    const names = store.getObjects('https://glossarist.org/agent/ada-lovelace', `${FOAF}name`, null).map(q => q.value);
    expect(names).toContain('Ada Lovelace');

    const mboxes = store.getObjects('https://glossarist.org/agent/ada-lovelace', `${FOAF}mbox`, null).map(q => q.value);
    expect(mboxes).toContain('mailto:ada@example.org');

    const roles = store.getObjects('https://glossarist.org/agent/ada-lovelace', `${DCTERMS}description`, null).map(q => q.value);
    expect(roles).toContain('Editor');

    const seeAlso = store.getObjects('https://glossarist.org/agent/ada-lovelace', 'http://www.w3.org/2000/01/rdf-schema#seeAlso', null).map(q => q.value);
    expect(seeAlso).toContain('https://example.org/ada');
  });

  it('creates a single prov:Organization per unique organization', () => {
    const result = emitAgentsGraph(agentsFromContributors([
      { name: 'Alice', organization: 'ISO' },
      { name: 'Bob',   organization: 'ISO' },
    ]));
    expect(result.organizationIris).toEqual(['https://glossarist.org/org/iso']);

    const store = parse(writeTurtle(result.graph));
    const types = store.getObjects('https://glossarist.org/org/iso', RDF_TYPE, null).map(q => q.value);
    expect(types).toContain(`${FOAF}Organization`);
    expect(types).toContain(`${PROV}Organization`);
    expect(types).toContain(`${PROV}Agent`);

    const names = store.getObjects('https://glossarist.org/org/iso', `${FOAF}name`, null).map(q => q.value);
    expect(names).toContain('ISO');
  });

  it('links every person to their organization via prov:actedOnBehalfOf', () => {
    const result = emitAgentsGraph(agentsFromContributors([
      { name: 'Alice', organization: 'ISO' },
      { name: 'Bob',   organization: 'IEC' },
    ]));
    const store = parse(writeTurtle(result.graph));
    const aliceOrg = store.getObjects('https://glossarist.org/agent/alice', `${PROV}actedOnBehalfOf`, null).map(q => q.value);
    expect(aliceOrg).toContain('https://glossarist.org/org/iso');
    const bobOrg = store.getObjects('https://glossarist.org/agent/bob', `${PROV}actedOnBehalfOf`, null).map(q => q.value);
    expect(bobOrg).toContain('https://glossarist.org/org/iec');
  });

  it('omits mbox, seeAlso, and actedOnBehalfOf when not provided', () => {
    const graph = emitAgentsGraph(agentsFromContributors([{ name: 'Solo' }]));
    const store = parse(writeTurtle(graph.graph));
    const mbox = store.getObjects('https://glossarist.org/agent/solo', `${FOAF}mbox`, null);
    expect(mbox).toHaveLength(0);
    const acted = store.getObjects('https://glossarist.org/agent/solo', `${PROV}actedOnBehalfOf`, null);
    expect(acted).toHaveLength(0);
  });
});