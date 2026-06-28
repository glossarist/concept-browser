import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { writeJsonLd } from '../../components/concept-rdf/jsonld-writer';
import { emitConceptGraph } from '../../components/concept-rdf/concept-emitter';
import { GLOSS, SKOS, SKOSXL, DCTERMS, RDF } from '../../components/concept-rdf/predicates';
import { CONCEPT_FIXTURES } from '../__fixtures__/concepts';

function expandPrefixed(value: string): string {
  if (value.startsWith('gloss:'))   return `https://www.glossarist.org/ontologies/${value.slice(6)}`;
  if (value.startsWith('skos:'))    return `http://www.w3.org/2004/02/skos/core#${value.slice(5)}`;
  if (value.startsWith('skosxl:'))  return `http://www.w3.org/2008/05/skos-xl#${value.slice(7)}`;
  if (value.startsWith('dcterms:')) return `http://purl.org/dc/terms/${value.slice(8)}`;
  if (value.startsWith('rdf:'))     return `http://www.w3.org/1999/02/22-rdf-syntax-ns#${value.slice(4)}`;
  if (value.startsWith('rdfs:'))    return `http://www.w3.org/2000/01/rdf-schema#${value.slice(5)}`;
  if (value.startsWith('prov:'))    return `http://www.w3.org/ns/prov#${value.slice(5)}`;
  if (value.startsWith('xsd:'))     return `http://www.w3.org/2001/XMLSchema#${value.slice(4)}`;
  return value;
}

function parseTurtle(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

const RDF_TYPE = expandPrefixed(RDF.type);

describe('RDF round-trip — Layer 2 fixture corpus (Turtle)', () => {
  for (const fixture of CONCEPT_FIXTURES) {
    describe(`fixture: ${fixture.name}`, () => {
      it('parses without errors and yields a non-empty graph', () => {
        const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
        const store = parseTurtle(writeTurtle(graph));
        expect(store.size).toBeGreaterThan(0);
      });

      it('preserves the concept type and identifier', () => {
        const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
        const store = parseTurtle(writeTurtle(graph));

        const types = store.getObjects(fixture.uri, RDF_TYPE, null).map(q => q.value);
        expect(types).toContain(expandPrefixed(GLOSS.Concept));
        expect(types).toContain(expandPrefixed(SKOS.Concept));

        const ids = store.getObjects(fixture.uri, expandPrefixed(GLOSS.identifier), null).map(q => q.value);
        expect(ids).toContain(fixture.concept.id);
      });

      it('emits a skos:prefLabel and a skosxl:literalForm for every localization', () => {
        const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
        const store = parseTurtle(writeTurtle(graph));

        for (const lang of fixture.concept.languages) {
          const lcUri = `${fixture.uri}/${lang}`;
          const pref = store.getObjects(lcUri, expandPrefixed(SKOS.prefLabel), null);
          expect(pref.length).toBeGreaterThan(0);

          const lcTypes = store.getObjects(lcUri, RDF_TYPE, null).map(q => q.value);
          expect(lcTypes).toContain(expandPrefixed(GLOSS.LocalizedConcept));

          const xlLabels = store.getObjects(lcUri, expandPrefixed(SKOSXL.prefLabel), null);
          expect(xlLabels.length).toBeGreaterThan(0);

          const literalForms = xlLabels.flatMap(label =>
            store.getObjects(label, expandPrefixed(SKOSXL.literalForm), null),
          );
          expect(literalForms.length).toBeGreaterThan(0);
        }
      });

      it('preserves isLocalizationOf back-references', () => {
        const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
        const store = parseTurtle(writeTurtle(graph));

        for (const lang of fixture.concept.languages) {
          const lcUri = `${fixture.uri}/${lang}`;
          const parents = store.getObjects(lcUri, expandPrefixed(GLOSS.isLocalizationOf), null).map(q => q.value);
          expect(parents).toContain(fixture.uri);
        }
      });
    });
  }
});

describe('RDF round-trip — Layer 2 fixture corpus (JSON-LD syntactic)', () => {
  for (const fixture of CONCEPT_FIXTURES) {
    it(`${fixture.name}: emits a parseable JSON-LD document with a non-empty @graph`, () => {
      const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
      const doc = JSON.parse(writeJsonLd(graph));
      expect(Array.isArray(doc['@graph'])).toBe(true);
      expect(doc['@graph'].length).toBeGreaterThan(0);
    });

    it(`${fixture.name}: includes the concept and at least one localized concept node`, () => {
      const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
      const doc = JSON.parse(writeJsonLd(graph));

      const conceptNode = doc['@graph'].find((n: any) =>
        Array.isArray(n['@type']) && n['@type'].includes('gloss:Concept'),
      );
      expect(conceptNode).toBeDefined();
      expect(conceptNode['@id']).toBe(fixture.uri);

      const lcNode = doc['@graph'].find((n: any) =>
        Array.isArray(n['@type']) && n['@type'].includes('gloss:LocalizedConcept'),
      );
      expect(lcNode).toBeDefined();
    });
  }
});

describe('RDF round-trip — Turtle and JSON-LD agree on prefLabel values', () => {
  for (const fixture of CONCEPT_FIXTURES) {
    it(`${fixture.name}: prefLabel values are identical across formats`, () => {
      const { graph } = emitConceptGraph(fixture.concept, fixture.uri);

      const turtleStore = parseTurtle(writeTurtle(graph));
      const doc = JSON.parse(writeJsonLd(graph));

      for (const lang of fixture.concept.languages) {
        const lcUri = `${fixture.uri}/${lang}`;
        const turtleLabels = turtleStore.getObjects(lcUri, expandPrefixed(SKOS.prefLabel), null).map(q => q.value);

        const lcNode = doc['@graph'].find((n: any) => n['@id'] === lcUri);
        expect(lcNode).toBeDefined();

        const raw = lcNode['skos:prefLabel'];
        const arr = Array.isArray(raw) ? raw : [raw];
        const jsonLabels = arr.map((v: any) => typeof v === 'string' ? v : v['@value']);

        expect(jsonLabels.sort()).toEqual(turtleLabels.slice().sort());
      }
    });
  }
});

describe('RDF round-trip — fixture-specific invariants', () => {
  it('multilingual: emits three distinct localizations with matching language codes', () => {
    const fixture = CONCEPT_FIXTURES.find(f => f.name === 'multilingual')!;
    const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
    const store = parseTurtle(writeTurtle(graph));

    const langs = ['eng', 'fra', 'jpn'];
    for (const lang of langs) {
      const lcUri = `${fixture.uri}/${lang}`;
      const langsOnLc = store.getObjects(lcUri, expandPrefixed(DCTERMS.language), null).map(q => q.value);
      expect(langsOnLc).toContain(lang);
    }
  });

  it('with-sources: every concept-level source is typed as gloss:Citation', () => {
    const fixture = CONCEPT_FIXTURES.find(f => f.name === 'with-sources')!;
    const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
    const store = parseTurtle(writeTurtle(graph));

    const sources = store.getObjects(fixture.uri, expandPrefixed(GLOSS.hasSource), null);
    expect(sources.length).toBeGreaterThanOrEqual(3);
    for (const src of sources) {
      const types = store.getObjects(src, RDF_TYPE, null).map(q => q.value);
      expect(types).toContain(expandPrefixed(GLOSS.Citation));
    }
  });

  it('with-non-verbal: emits at least three non-verbal blank nodes on the localization', () => {
    const fixture = CONCEPT_FIXTURES.find(f => f.name === 'with-non-verbal')!;
    const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
    const store = parseTurtle(writeTurtle(graph));

    const lcUri = `${fixture.uri}/eng`;
    const nvrs = store.getObjects(lcUri, expandPrefixed(GLOSS.hasNonVerbalRep), null);
    expect(nvrs.length).toBeGreaterThanOrEqual(3);
  });

  it('with-dates: emits one hasDate blank node per date entry', () => {
    const fixture = CONCEPT_FIXTURES.find(f => f.name === 'with-dates')!;
    const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
    const store = parseTurtle(writeTurtle(graph));

    const dates = store.getObjects(fixture.uri, expandPrefixed(GLOSS.hasDate), null);
    expect(dates.length).toBe(3);
  });

  it('full-relationships: emits hasRelatedConcept for each related entry', () => {
    const fixture = CONCEPT_FIXTURES.find(f => f.name === 'full-relationships')!;
    const { graph } = emitConceptGraph(fixture.concept, fixture.uri);
    const store = parseTurtle(writeTurtle(graph));

    const rels = store.getObjects(fixture.uri, expandPrefixed(GLOSS.hasRelatedConcept), null);
    expect(rels.length).toBe(5);

    for (const blank of rels) {
      const typeQuads = store.getObjects(blank, expandPrefixed(GLOSS.relationshipType), null);
      expect(typeQuads.length).toBe(1);
    }
  });
});
