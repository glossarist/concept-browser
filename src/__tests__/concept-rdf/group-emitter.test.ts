import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { emitGroupGraph } from '../../components/concept-rdf/group-emitter';

const DCAT = 'http://www.w3.org/ns/dcat#';
const DCTERMS = 'http://purl.org/dc/terms/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

describe('emitGroupGraph — lineage → dcat:DatasetSeries', () => {
  it('types lineage group as dcat:DatasetSeries', () => {
    const graph = emitGroupGraph({
      groupId: 'viml', groupIri: 'https://x.test/group/viml',
      kind: 'lineage', title: 'VIML',
      memberIris: ['https://x.test/dataset/viml-2022'],
    });
    const store = parse(writeTurtle(graph));
    const types = store.getObjects('https://x.test/group/viml', RDF_TYPE, null).map(q => q.value);
    expect(types).toContain(`${DCAT}DatasetSeries`);
  });

  it('emits dcat:hasVersion for each member', () => {
    const graph = emitGroupGraph({
      groupId: 'viml', groupIri: 'https://x.test/group/viml',
      kind: 'lineage', title: 'VIML',
      memberIris: ['https://x.test/dataset/viml-2013', 'https://x.test/dataset/viml-2022'],
    });
    const store = parse(writeTurtle(graph));
    const versions = store.getObjects('https://x.test/group/viml', `${DCAT}hasVersion`, null).map(q => q.value);
    expect(versions).toContain('https://x.test/dataset/viml-2013');
    expect(versions).toContain('https://x.test/dataset/viml-2022');
  });

  it('emits gloss:hasCurrentVersion for the current member', () => {
    const graph = emitGroupGraph({
      groupId: 'viml', groupIri: 'https://x.test/group/viml',
      kind: 'lineage', title: 'VIML',
      memberIris: ['https://x.test/dataset/viml-2022'],
      currentMemberIri: 'https://x.test/dataset/viml-2022',
    });
    const store = parse(writeTurtle(graph));
    const current = store.getObjects('https://x.test/group/viml', 'https://www.glossarist.org/ontologies/hasCurrentVersion', null).map(q => q.value);
    expect(current).toContain('https://x.test/dataset/viml-2022');
  });
});

describe('emitGroupGraph — topic/family/collection → dcat:Catalog', () => {
  it('types topic group as dcat:Catalog', () => {
    const graph = emitGroupGraph({
      groupId: 'its', groupIri: 'https://x.test/group/its',
      kind: 'topic', title: 'ITS Standards',
      memberIris: ['https://x.test/dataset/iso-14817'],
    });
    const store = parse(writeTurtle(graph));
    const types = store.getObjects('https://x.test/group/its', RDF_TYPE, null).map(q => q.value);
    expect(types).toContain(`${DCAT}Catalog`);
  });

  it('emits dcat:dataset for each member', () => {
    const graph = emitGroupGraph({
      groupId: 'its', groupIri: 'https://x.test/group/its',
      kind: 'topic', title: 'ITS',
      memberIris: ['https://x.test/dataset/a', 'https://x.test/dataset/b'],
    });
    const store = parse(writeTurtle(graph));
    const datasets = store.getObjects('https://x.test/group/its', `${DCAT}dataset`, null).map(q => q.value);
    expect(datasets).toContain('https://x.test/dataset/a');
    expect(datasets).toContain('https://x.test/dataset/b');
  });
});

describe('emitGroupGraph — default kind → no emission', () => {
  it('produces an empty graph for default kind', () => {
    const graph = emitGroupGraph({
      groupId: 'misc', groupIri: 'https://x.test/group/misc',
      kind: 'default', title: 'Misc',
      memberIris: [],
    });
    expect(Array.from(graph.resources()).length).toBe(0);
  });
});

describe('emitGroupGraph — metadata', () => {
  it('emits title, description, identifier, subject, keywords', () => {
    const graph = emitGroupGraph({
      groupId: 'viml', groupIri: 'https://x.test/group/viml',
      kind: 'lineage', title: 'VIML',
      description: 'Legal metrology vocabulary',
      subject: 'legal metrology',
      keywords: ['metrology', 'legal'],
      memberIris: [],
    });
    const store = parse(writeTurtle(graph));
    expect(store.getObjects('https://x.test/group/viml', `${DCTERMS}title`, null).map(q => q.value)).toContain('VIML');
    expect(store.getObjects('https://x.test/group/viml', `${DCTERMS}description`, null).map(q => q.value)).toContain('Legal metrology vocabulary');
    expect(store.getObjects('https://x.test/group/viml', `${DCTERMS}identifier`, null).map(q => q.value)).toContain('viml');
    expect(store.getObjects('https://x.test/group/viml', `${DCTERMS}subject`, null).map(q => q.value)).toContain('legal metrology');
    const keywords = store.getObjects('https://x.test/group/viml', `${DCAT}keyword`, null).map(q => q.value);
    expect(keywords).toContain('metrology');
    expect(keywords).toContain('legal');
  });
});