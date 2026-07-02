import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { writeJsonLd } from '../../components/concept-rdf/jsonld-writer';
import { emitDatasetGraph } from '../../components/concept-rdf/dataset-emitter';
import type { DatasetEmitterInput } from '../../components/concept-rdf/dataset-emitter';

const DATASET_BASE = 'https://glossarist.org/dataset';

function makeInput(overrides: Partial<DatasetEmitterInput> = {}): DatasetEmitterInput {
  return {
    datasetIri: `${DATASET_BASE}/test`,
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
      {
        id: 'test-tbx',
        title: 'TBX distribution',
        mediaType: 'application/x-tbx',
        downloadUrl: 'https://glossarist.org/data/test.tbx.xml',
      },
    ],
    topConceptUris: [
      `${DATASET_BASE}/test/concept/1`,
      `${DATASET_BASE}/test/concept/2`,
    ],
    sections: [
      {
        collectionIri: `${DATASET_BASE}/test/section/3-1`,
        title: 'Geodetic concepts',
        memberUris: [`${DATASET_BASE}/test/concept/1`, `${DATASET_BASE}/test/concept/2`],
      },
    ],
    sourceRepoUrl: 'https://github.com/example/test',
    publisherIri: 'https://glossarist.org/agent/test-publisher',
    contactIri: 'https://glossarist.org/agent/test-contact',
    ...overrides,
  };
}

function parseTurtle(turtle: string): Store {
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
  if (v.startsWith('xsd:'))     return `http://www.w3.org/2001/XMLSchema#${v.slice(4)}`;
  return v;
};

describe('emitDatasetGraph — J2 dcat:Dataset / skos:ConceptScheme', () => {
  it('types the dataset as dcat:Dataset and skos:ConceptScheme', () => {
    const input = makeInput();
    const { graph } = { graph: emitDatasetGraph(input) };
    const store = parseTurtle(writeTurtle(graph));
    const types = store.getObjects(input.datasetIri, expand('rdf:type'), null).map(q => q.value);
    expect(types).toContain(expand('dcat:Dataset'));
    expect(types).toContain(expand('skos:ConceptScheme'));
  });

  it('emits title, description, modified, and identifier', () => {
    const input = makeInput();
    const graph = emitDatasetGraph(input);
    const store = parseTurtle(writeTurtle(graph));
    const titles = store.getObjects(input.datasetIri, expand('dcterms:title'), null).map(q => q.value);
    expect(titles).toContain('Test Glossary');
    const descriptions = store.getObjects(input.datasetIri, expand('dcterms:description'), null).map(q => q.value);
    expect(descriptions).toContain('A test dataset.');
    const modified = store.getObjects(input.datasetIri, expand('dcterms:modified'), null).map(q => q.value);
    expect(modified).toContain('2026-06-28');
    const ids = store.getObjects(input.datasetIri, expand('dcterms:identifier'), null).map(q => q.value);
    expect(ids).toContain('test');
  });

  it('emits a dcat:Distribution blank per distribution with mediaType and downloadURL', () => {
    const input = makeInput();
    const graph = emitDatasetGraph(input);
    const store = parseTurtle(writeTurtle(graph));
    const dists = store.getObjects(input.datasetIri, expand('dcat:distribution'), null);
    expect(dists.length).toBe(2);

    const ttlDist = dists.find(d => {
      const types = store.getObjects(d, expand('rdf:type'), null).map(q => q.value);
      const mediaTypes = store.getObjects(d, expand('dcat:mediaType'), null).map(q => q.value);
      return types.includes(expand('dcat:Distribution')) && mediaTypes.includes('text/turtle');
    });
    expect(ttlDist).toBeDefined();

    const downloadUrls = store.getObjects(ttlDist!, expand('dcat:downloadURL'), null).map(q => q.value);
    expect(downloadUrls).toContain('https://glossarist.org/data/test.ttl');

    const byteSizes = store.getObjects(ttlDist!, expand('dcat:byteSize'), null).map(q => q.value);
    expect(byteSizes).toContain('12345');
  });

  it('emits skos:hasTopConcept for every top-level concept', () => {
    const input = makeInput();
    const graph = emitDatasetGraph(input);
    const store = parseTurtle(writeTurtle(graph));
    const tops = store.getObjects(input.datasetIri, expand('skos:hasTopConcept'), null).map(q => q.value);
    expect(tops).toContain(`${DATASET_BASE}/test/concept/1`);
    expect(tops).toContain(`${DATASET_BASE}/test/concept/2`);
  });

  it('emits dcterms:language IRIs for every language', () => {
    const input = makeInput();
    const graph = emitDatasetGraph(input);
    const store = parseTurtle(writeTurtle(graph));
    const langs = store.getObjects(input.datasetIri, expand('dcterms:language'), null).map(q => q.value);
    expect(langs).toContain('http://id.loc.gov/vocabulary/iso639-1/eng');
    expect(langs).toContain('http://id.loc.gov/vocabulary/iso639-1/fra');
  });

  it('emits prov:wasDerivedFrom, publisher, and contactPoint when provided', () => {
    const input = makeInput();
    const graph = emitDatasetGraph(input);
    const store = parseTurtle(writeTurtle(graph));
    const derived = store.getObjects(input.datasetIri, expand('prov:wasDerivedFrom'), null).map(q => q.value);
    const publishers = store.getObjects(input.datasetIri, expand('dcterms:publisher'), null).map(q => q.value);
    const contacts = store.getObjects(input.datasetIri, expand('dcat:contactPoint'), null).map(q => q.value);
    expect(derived).toContain('https://github.com/example/test');
    expect(publishers).toContain('https://glossarist.org/agent/test-publisher');
    expect(contacts).toContain('https://glossarist.org/agent/test-contact');
  });
});

describe('emitDatasetGraph — J5 skos:Collection per section', () => {
  it('emits a skos:Collection per section with skos:member entries', () => {
    const input = makeInput({
      sections: [
        {
          collectionIri: `${DATASET_BASE}/test/section/1-1`,
          title: 'Section 1.1',
          memberUris: [`${DATASET_BASE}/test/concept/1`],
        },
        {
          collectionIri: `${DATASET_BASE}/test/section/1-2`,
          title: 'Section 1.2',
          memberUris: [`${DATASET_BASE}/test/concept/2`, `${DATASET_BASE}/test/concept/3`],
        },
      ],
    });
    const graph = emitDatasetGraph(input);
    const store = parseTurtle(writeTurtle(graph));

    for (const section of input.sections) {
      const types = store.getObjects(section.collectionIri, expand('rdf:type'), null).map(q => q.value);
      expect(types).toContain(expand('skos:Collection'));
      const titles = store.getObjects(section.collectionIri, expand('dcterms:title'), null).map(q => q.value);
      expect(titles).toContain(section.title);
      const members = store.getObjects(section.collectionIri, expand('skos:member'), null).map(q => q.value);
      for (const member of section.memberUris) {
        expect(members).toContain(member);
      }
    }
  });

  it('omits collections when sections array is empty', () => {
    const input = makeInput({ sections: [] });
    const graph = emitDatasetGraph(input);
    const ttl = writeTurtle(graph);
    expect(ttl).not.toMatch(/skos:Collection/);
  });

  it('emits gloss:hasParentSection and gloss:hasChildSection for hierarchical sections', () => {
    const root = `${DATASET_BASE}/test/section/3`;
    const mid = `${DATASET_BASE}/test/section/3-1`;
    const leaf = `${DATASET_BASE}/test/section/3-1-1`;
    const input = makeInput({
      sections: [
        { collectionIri: root, title: 'Section 3', memberUris: [], childCollectionIris: [mid] },
        { collectionIri: mid, title: 'Section 3.1', memberUris: [], parentCollectionIri: root, childCollectionIris: [leaf] },
        { collectionIri: leaf, title: 'Section 3.1.1', memberUris: [], parentCollectionIri: mid },
      ],
    });
    const graph = emitDatasetGraph(input);
    const store = parseTurtle(writeTurtle(graph));

    const midChildren = store.getObjects(mid, 'https://www.glossarist.org/ontologies/hasChildSection', null).map(q => q.value);
    expect(midChildren).toContain(leaf);

    const midParent = store.getObjects(mid, 'https://www.glossarist.org/ontologies/hasParentSection', null).map(q => q.value);
    expect(midParent).toContain(root);

    const leafParent = store.getObjects(leaf, 'https://www.glossarist.org/ontologies/hasParentSection', null).map(q => q.value);
    expect(leafParent).toContain(mid);

    const rootParent = store.getObjects(root, 'https://www.glossarist.org/ontologies/hasParentSection', null);
    expect(rootParent.length).toBe(0);
  });
});

describe('emitDatasetGraph — JSON-LD output', () => {
  it('produces a parseable JSON-LD document with the dataset node', () => {
    const input = makeInput();
    const graph = emitDatasetGraph(input);
    const doc = JSON.parse(writeJsonLd(graph));
    const datasetNode = doc['@graph'].find((n: any) =>
      Array.isArray(n['@type']) && n['@type'].includes('dcat:Dataset'),
    );
    expect(datasetNode).toBeDefined();
    expect(datasetNode['@id']).toBe(input.datasetIri);
    expect(datasetNode['dcterms:title']).toBe('Test Glossary');
    const types = datasetNode['@type'];
    expect(types).toContain('skos:ConceptScheme');
  });
});
