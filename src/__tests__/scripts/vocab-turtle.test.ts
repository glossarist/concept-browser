import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { buildVocabularyTurtle, listVocabSchemes } from '../../../scripts/lib/vocab-turtle.mjs';

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

const SKOS = 'http://www.w3.org/2004/02/skos/core#';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

describe('buildVocabularyTurtle (mjs)', () => {
  it('parses without errors and produces a non-empty graph', async () => {
    const ttl = await buildVocabularyTurtle();
    const store = parse(ttl);
    expect(store.size).toBeGreaterThan(0);
  });

  it('declares at least one skos:ConceptScheme', async () => {
    const store = parse(await buildVocabularyTurtle());
    const schemes = [...store].filter(q =>
      q.predicate.value === RDF_TYPE && q.object.value === `${SKOS}ConceptScheme`,
    );
    expect(schemes.length).toBeGreaterThan(0);
  });

  it('declares enumeration IRIs as skos:Concept instances', async () => {
    const store = parse(await buildVocabularyTurtle());
    const concepts = [...store].filter(q =>
      q.predicate.value === RDF_TYPE && q.object.value === `${SKOS}Concept`,
    );
    expect(concepts.length).toBeGreaterThan(10);

    const conceptIris = new Set(concepts.map(q => q.subject.value));
    expect(conceptIris.has('https://www.glossarist.org/ontologies/status/valid')).toBe(true);
    expect(conceptIris.has('https://www.glossarist.org/ontologies/norm/preferred')).toBe(true);
    expect(conceptIris.has('https://www.glossarist.org/ontologies/datetype/accepted')).toBe(true);
  });

  it('listVocabSchemes returns the seven canonical schemes', () => {
    const schemes = listVocabSchemes();
    const ids = schemes.map(s => s.schemeIri);
    expect(ids).toContain('gloss:status-scheme');
    expect(ids).toContain('gloss:entstatus-scheme');
    expect(ids).toContain('gloss:norm-scheme');
    expect(ids).toContain('gloss:srcstatus-scheme');
    expect(ids).toContain('gloss:srctype-scheme');
    expect(ids).toContain('gloss:datetype-scheme');
    expect(ids).toContain('gloss:rel-scheme');
    expect(schemes.length).toBe(7);
  });

  it('emits skos:hasTopConcept and skos:inScheme bidirectionally', async () => {
    const store = parse(await buildVocabularyTurtle());
    const hasTopConcept = [...store].filter(q => q.predicate.value === `${SKOS}hasTopConcept`);
    const inScheme = [...store].filter(q => q.predicate.value === `${SKOS}inScheme`);
    expect(hasTopConcept.length).toBeGreaterThan(0);
    expect(inScheme.length).toBe(hasTopConcept.length);
  });
});
