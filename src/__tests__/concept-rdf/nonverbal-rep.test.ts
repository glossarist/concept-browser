import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { emitConceptGraph } from '../../components/concept-rdf/concept-emitter';
import { Concept } from 'glossarist';

const G = 'https://www.glossarist.org/ontologies/';
const SKOSXL = 'http://www.w3.org/2008/05/skos-xl#';
const SKOS = 'http://www.w3.org/2004/02/skos/core#';
const PROV = 'http://www.w3.org/ns/prov#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

const BASE = 'https://glossarist.org/fixtures/k4';

function emitAndParse(concept: Concept) {
  const { graph } = emitConceptGraph(concept, concept.uri ?? '');
  return { graph, store: parse(writeTurtle(graph)) };
}

describe('WS K4 — NVRs as first-class URIs', () => {
  it('emits an NVR URI when the NVR has a caption (prefLabel material)', () => {
    const concept = Concept.fromJSON({
      id: 'k4.1', uri: `${BASE}/k4.1`, status: 'valid',
      localizations: {
        eng: {
          language_code: 'eng', entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'K4 concept', normative_status: 'preferred' }],
          definition: [{ content: 'Concept with a referenced NVR.' }],
          non_verbal_rep: [
            { type: 'expression', caption: 'Diagram label', images: [{ src: 'https://glossarist.org/figs/1.svg' }] },
          ],
        },
      },
    });

    const { graph, store } = emitAndParse(concept);
    const nvrUri = `${BASE}/k4.1/nvr/1`;
    expect(graph.get(nvrUri)).toBeDefined();

    const lcUri = `${BASE}/k4.1/eng`;
    const links = store.getObjects(lcUri, `${G}hasNonVerbalRepresentation`, null).map(q => q.value);
    expect(links).toContain(nvrUri);

    const nvrTypes = store.getObjects(nvrUri, RDF_TYPE, null).map(q => q.value);
    expect(nvrTypes).toContain(`${G}NonVerbalRep`);
    expect(nvrTypes).toContain(`${G}Expression`);
    expect(nvrTypes).toContain(`${SKOS}Concept`);

    const prefLabelBlanks = store.getObjects(nvrUri, `${SKOSXL}prefLabel`, null);
    expect(prefLabelBlanks.length).toBe(1);
    const literalForms = store.getObjects(prefLabelBlanks[0], `${SKOSXL}literalForm`, null);
    expect(literalForms.length).toBe(1);
    expect((literalForms[0] as any).value).toBe('Diagram label');
    expect((literalForms[0] as any).language).toBe('eng');
  });

  it('emits gloss:image as xsd:anyURI on the NVR', () => {
    const concept = Concept.fromJSON({
      id: 'k4.2', uri: `${BASE}/k4.2`, status: 'valid',
      localizations: {
        eng: {
          language_code: 'eng', entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'K4 with image', normative_status: 'preferred' }],
          definition: [{ content: 'Has an NVR with image.' }],
          non_verbal_rep: [
            { type: 'expression', caption: 'Fig', images: [{ src: 'https://x.test/fig.svg' }] },
          ],
        },
      },
    });
    const { store } = emitAndParse(concept);
    const nvrUri = `${BASE}/k4.2/nvr/1`;
    const images = store.getObjects(nvrUri, `${G}image`, null);
    expect(images.length).toBe(1);
    expect((images[0] as any).value).toBe('https://x.test/fig.svg');
    expect((images[0] as any).datatype.value).toBe(`${XSD}anyURI`);
  });

  it('emits prov:wasDerivedFrom from sources[0].origin.link', () => {
    const concept = Concept.fromJSON({
      id: 'k4.3', uri: `${BASE}/k4.3`, status: 'valid',
      localizations: {
        eng: {
          language_code: 'eng', entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'K4 with source', normative_status: 'preferred' }],
          definition: [{ content: 'Has an NVR with source.' }],
          non_verbal_rep: [
            {
              type: 'expression', caption: 'Fig',
              sources: [{ status: 'identical', type: 'authoritative', origin: { ref: { source: 'ISO', id: 'X' }, link: 'https://x.test/source' } }],
            },
          ],
        },
      },
    });
    const { store } = emitAndParse(concept);
    const derived = store.getObjects(`${BASE}/k4.3/nvr/1`, `${PROV}wasDerivedFrom`, null).map(q => q.value);
    expect(derived).toContain('https://x.test/source');
  });

  it('falls back to gloss:hasNonVerbalRep blank-node emission when NVR has no caption and no image', () => {
    const concept = Concept.fromJSON({
      id: 'k4.4', uri: `${BASE}/k4.4`, status: 'valid',
      localizations: {
        eng: {
          language_code: 'eng', entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'K4 fallback', normative_status: 'preferred' }],
          definition: [{ content: 'Has an NVR with no useful content.' }],
          non_verbal_rep: [{ type: 'expression' }],
        },
      },
    });
    const { store } = emitAndParse(concept);
    const lcUri = `${BASE}/k4.4/eng`;
    const uriLinks = store.getObjects(lcUri, `${G}hasNonVerbalRepresentation`, null);
    expect(uriLinks.length).toBe(0);
    const blankLinks = store.getObjects(lcUri, `${G}hasNonVerbalRep`, null);
    expect(blankLinks.length).toBe(1);
  });

  it('produces NVR URIs keyed by index when multiple NVRs are present', () => {
    const concept = Concept.fromJSON({
      id: 'k4.5', uri: `${BASE}/k4.5`, status: 'valid',
      localizations: {
        eng: {
          language_code: 'eng', entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'K4 multiple', normative_status: 'preferred' }],
          definition: [{ content: 'Has multiple NVRs.' }],
          non_verbal_rep: [
            { type: 'expression', caption: 'One', images: [{ src: 'https://x.test/1.svg' }] },
            { type: 'expression', caption: 'Two', images: [{ src: 'https://x.test/2.svg' }] },
            { type: 'expression', caption: 'Three', images: [{ src: 'https://x.test/3.svg' }] },
          ],
        },
      },
    });
    const { store } = emitAndParse(concept);
    const lcUri = `${BASE}/k4.5/eng`;
    const links = store.getObjects(lcUri, `${G}hasNonVerbalRepresentation`, null).map(q => q.value);
    expect(links).toContain(`${BASE}/k4.5/nvr/1`);
    expect(links).toContain(`${BASE}/k4.5/nvr/2`);
    expect(links).toContain(`${BASE}/k4.5/nvr/3`);
  });
});

describe('WS K4 — URI NVR conforms to canonical NonVerbalRep shape', () => {
  it('emits NVR resources that satisfy gloss:NonVerbalRepShape (skosxl:prefLabel min 1)', () => {
    const concept = Concept.fromJSON({
      id: 'k4.6', uri: `${BASE}/k4.6`, status: 'valid',
      localizations: {
        eng: {
          language_code: 'eng', entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'shape-conformant', normative_status: 'preferred' }],
          definition: [{ content: 'NVR conforms to shape.' }],
          non_verbal_rep: [
            { type: 'expression', caption: 'Label', images: [{ src: 'https://x.test/fig.svg' }] },
          ],
        },
      },
    });
    const { store } = emitAndParse(concept);
    const nvrUri = `${BASE}/k4.6/nvr/1`;
    const prefLabels = store.getObjects(nvrUri, `${SKOSXL}prefLabel`, null);
    expect(prefLabels.length).toBeGreaterThanOrEqual(1);
    const nvrTypes = store.getObjects(nvrUri, RDF_TYPE, null).map(q => q.value);
    expect(nvrTypes).toContain(`${G}NonVerbalRep`);
    expect(nvrTypes).toContain(`${SKOS}Concept`);
  });
});