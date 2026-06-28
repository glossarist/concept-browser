import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { Concept } from 'glossarist';
import { emitConceptGraph } from '../../components/concept-rdf/concept-emitter';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { writeJsonLd } from '../../components/concept-rdf/jsonld-writer';
import { GLOSS, SKOS, SKOSXL, DCTERMS } from '../../components/concept-rdf/predicates';

const BASE = 'https://glossarist.org/roundtrip/concept';

function makeFullConcept(): Concept {
  return Concept.fromJSON({
    id: '3.1.1',
    uri: `${BASE}/3.1.1`,
    status: 'valid',
    localizations: {
      eng: {
        language_code: 'eng',
        entry_status: 'valid',
        terms: [
          { type: 'expression', designation: 'atomic data unit', normative_status: 'preferred' },
          { type: 'expression', designation: 'ADU', normative_status: 'admitted' },
        ],
        definition: [{ content: 'A data unit that cannot be subdivided.' }],
        notes: [{ content: 'A note.' }],
        examples: [{ content: 'An example.' }],
        non_verbal_rep: [
          {
            type: 'figure',
            caption: 'Diagram',
            description: 'Schematic diagram',
            images: [{ src: 'https://glossarist.org/figs/1.svg' }],
          },
        ],
      },
    },
  });
}

function expandPrefixed(value: string): string {
  if (value.startsWith('gloss:')) return `https://www.glossarist.org/ontologies/${value.slice(6)}`;
  if (value.startsWith('skos:')) return `http://www.w3.org/2004/02/skos/core#${value.slice(5)}`;
  if (value.startsWith('skosxl:')) return `http://www.w3.org/2008/05/skos-xl#${value.slice(7)}`;
  if (value.startsWith('dcterms:')) return `http://purl.org/dc/terms/${value.slice(8)}`;
  if (value.startsWith('rdf:')) return `http://www.w3.org/1999/02/22-rdf-syntax-ns#${value.slice(4)}`;
  return value;
}

function parseTurtle(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const quads = parser.parse(turtle);
  const store = new Store();
  store.addQuads(quads);
  return store;
}

describe('RDF round-trip: emit → Turtle → n3 parse', () => {
  it('parses without errors', () => {
    const { graph } = emitConceptGraph(makeFullConcept(), `${BASE}/3.1.1`);
    const turtle = writeTurtle(graph);
    const store = parseTurtle(turtle);
    expect(store.size).toBeGreaterThan(0);
  });

  it('preserves concept type and identifier quads', () => {
    const { graph } = emitConceptGraph(makeFullConcept(), `${BASE}/3.1.1`);
    const turtle = writeTurtle(graph);
    const store = parseTurtle(turtle);

    const uri = `${BASE}/3.1.1`;
    const typeQuads = store.getObjects(uri, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type', null);
    const typeValues = typeQuads.map(q => q.value);
    expect(typeValues).toContain(expandPrefixed(GLOSS.Concept));
    expect(typeValues).toContain(expandPrefixed(SKOS.Concept));

    const idQuads = store.getObjects(uri, expandPrefixed(GLOSS.identifier), null);
    expect(idQuads.map(q => q.value)).toContain('3.1.1');
  });

  it('preserves skos:prefLabel with language tag', () => {
    const { graph } = emitConceptGraph(makeFullConcept(), `${BASE}/3.1.1`);
    const turtle = writeTurtle(graph);
    const store = parseTurtle(turtle);

    const lcUri = `${BASE}/3.1.1/eng`;
    const prefLabels = store.getObjects(lcUri, expandPrefixed(SKOS.prefLabel), null);
    const labels = prefLabels.map(q => ({ value: q.value, lang: (q as any).language }));
    expect(labels).toContainEqual({ value: 'atomic data unit', lang: 'eng' });
  });

  it('preserves skos:definition with language tag', () => {
    const { graph } = emitConceptGraph(makeFullConcept(), `${BASE}/3.1.1`);
    const turtle = writeTurtle(graph);
    const store = parseTurtle(turtle);

    const lcUri = `${BASE}/3.1.1/eng`;
    const defs = store.getObjects(lcUri, expandPrefixed(SKOS.definition), null);
    const defValues = defs.map(q => ({ value: q.value, lang: (q as any).language }));
    expect(defValues).toContainEqual({ value: 'A data unit that cannot be subdivided.', lang: 'eng' });
  });

  it('preserves language tag on dcterms:language', () => {
    const { graph } = emitConceptGraph(makeFullConcept(), `${BASE}/3.1.1`);
    const turtle = writeTurtle(graph);
    const store = parseTurtle(turtle);

    const lcUri = `${BASE}/3.1.1/eng`;
    const langs = store.getObjects(lcUri, expandPrefixed(DCTERMS.language), null);
    expect(langs.map(q => q.value)).toContain('eng');
  });

  it('preserves designation resources with skosxl:literalForm', () => {
    const { graph } = emitConceptGraph(makeFullConcept(), `${BASE}/3.1.1`);
    const turtle = writeTurtle(graph);
    const store = parseTurtle(turtle);

    const desigUri = `${BASE}/3.1.1/eng/desig/atomic_data_unit`;
    const forms = store.getObjects(desigUri, expandPrefixed(SKOSXL.literalForm), null);
    expect(forms.map(q => q.value)).toContain('atomic data unit');
  });

  it('preserves hasNonVerbalRep blank nodes', () => {
    const { graph } = emitConceptGraph(makeFullConcept(), `${BASE}/3.1.1`);
    const turtle = writeTurtle(graph);
    const store = parseTurtle(turtle);

    const lcUri = `${BASE}/3.1.1/eng`;
    const nvrs = store.getObjects(lcUri, expandPrefixed(GLOSS.hasNonVerbalRep), null);
    expect(nvrs.length).toBeGreaterThanOrEqual(1);

    for (const nvr of nvrs) {
      const types = store.getObjects(nvr, expandPrefixed(GLOSS.nonVerbalType), null);
      expect(types.length).toBeGreaterThan(0);
    }
  });

  it('preserves isLocalizationOf links', () => {
    const { graph } = emitConceptGraph(makeFullConcept(), `${BASE}/3.1.1`);
    const turtle = writeTurtle(graph);
    const store = parseTurtle(turtle);

    const lcUri = `${BASE}/3.1.1/eng`;
    const parents = store.getObjects(lcUri, expandPrefixed(GLOSS.isLocalizationOf), null);
    expect(parents.map(q => q.value)).toContain(`${BASE}/3.1.1`);
  });
});

describe('RDF round-trip: emit → JSON-LD (syntactic)', () => {
  it('parses JSON-LD without errors', () => {
    const { graph } = emitConceptGraph(makeFullConcept(), `${BASE}/3.1.1`);
    const jsonld = writeJsonLd(graph);
    const doc = JSON.parse(jsonld);
    expect(doc['@graph'].length).toBeGreaterThan(0);
  });

  it('round-trips the same data through Turtle and JSON-LD', () => {
    const { graph } = emitConceptGraph(makeFullConcept(), `${BASE}/3.1.1`);
    const turtle = writeTurtle(graph);
    const jsonld = writeJsonLd(graph);

    const turtleStore = parseTurtle(turtle);
    const turtlePrefLabel = turtleStore.getObjects(
      `${BASE}/3.1.1/eng`,
      expandPrefixed(SKOS.prefLabel),
      null,
    ).map(q => q.value);

    const doc = JSON.parse(jsonld);
    const lcNode = doc['@graph'].find((n: any) => Array.isArray(n['@type']) && n['@type'].includes('gloss:LocalizedConcept'));
    const jsonPrefLabelRaw = lcNode['skos:prefLabel'];
    const jsonPrefLabels = Array.isArray(jsonPrefLabelRaw) ? jsonPrefLabelRaw : [jsonPrefLabelRaw];
    const jsonPrefLabelValues = jsonPrefLabels.map((v: any) => typeof v === 'string' ? v : v['@value']);

    expect(turtlePrefLabel).toEqual(jsonPrefLabelValues);
  });
});
