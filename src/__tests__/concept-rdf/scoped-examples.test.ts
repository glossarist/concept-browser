import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { Concept } from 'glossarist';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { emitConceptGraph } from '../../components/concept-rdf/concept-emitter';

const G = 'https://www.glossarist.org/ontologies/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

const BASE = 'https://glossarist.org/fixtures/scoped';

describe('A3/B2 — DetailedDefinition helper with scoped examples recursion', () => {
  it('emits a gloss:hasExample blank inside gloss:hasNote when the note has examples', () => {
    const concept = Concept.fromJSON({
      id: 'scoped.1',
      uri: `${BASE}/scoped.1`,
      status: 'valid',
      localizations: {
        eng: {
          language_code: 'eng',
          entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'scoped concept', normative_status: 'preferred' }],
          definition: [{ content: 'Outer definition.' }],
          notes: [{
            content: 'NOTE — Outer note text.',
            examples: [{ content: 'EXAMPLE — Nested scoped example.' }],
          }],
        },
      },
    });

    const { graph } = emitConceptGraph(concept, concept.uri ?? "");
    const store = parse(writeTurtle(graph));

    const lcUri = `${BASE}/scoped.1/eng`;
    const noteBlanks = store.getObjects(lcUri, `${G}hasNote`, null);
    expect(noteBlanks.length).toBe(1);

    const noteBlank = noteBlanks[0];
    const noteTypes = store.getObjects(noteBlank, RDF_TYPE, null).map(q => q.value);
    expect(noteTypes).toContain(`${G}DetailedDefinition`);

    const innerExamples = store.getObjects(noteBlank, `${G}hasExample`, null);
    expect(innerExamples.length).toBe(1);

    const innerEx = innerExamples[0];
    const innerExTypes = store.getObjects(innerEx, RDF_TYPE, null).map(q => q.value);
    expect(innerExTypes).toContain(`${G}DetailedDefinition`);

    const innerValues = store.getObjects(innerEx, 'http://www.w3.org/1999/02/22-rdf-syntax-ns#value', null);
    expect(innerValues.length).toBe(1);
    expect((innerValues[0] as any).value).toBe('EXAMPLE — Nested scoped example.');
  });

  it('recurses through arbitrarily deep scoped example chains', () => {
    const concept = Concept.fromJSON({
      id: 'scoped.2',
      uri: `${BASE}/scoped.2`,
      status: 'valid',
      localizations: {
        eng: {
          language_code: 'eng',
          entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'deep', normative_status: 'preferred' }],
          definition: [{
            content: 'Outer def.',
            examples: [{
              content: 'EXAMPLE level 1',
              examples: [{
                content: 'EXAMPLE level 2 (nested inside example)',
              }],
            }],
          }],
        },
      },
    });

    const { graph } = emitConceptGraph(concept, concept.uri ?? "");
    const store = parse(writeTurtle(graph));

    const lcUri = `${BASE}/scoped.2/eng`;
    const defBlanks = store.getObjects(lcUri, `${G}hasDefinition`, null);
    expect(defBlanks.length).toBe(1);

    const inner1 = store.getObjects(defBlanks[0], `${G}hasExample`, null);
    expect(inner1.length).toBe(1);

    const inner2 = store.getObjects(inner1[0], `${G}hasExample`, null);
    expect(inner2.length).toBe(1);

    const inner2Values = store.getObjects(inner2[0], 'http://www.w3.org/1999/02/22-rdf-syntax-ns#value', null);
    expect((inner2Values[0] as any).value).toBe('EXAMPLE level 2 (nested inside example)');
  });

  it('does not emit gloss:hasExample when no scoped examples are present', () => {
    const concept = Concept.fromJSON({
      id: 'scoped.3',
      uri: `${BASE}/scoped.3`,
      status: 'valid',
      localizations: {
        eng: {
          language_code: 'eng',
          entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'flat', normative_status: 'preferred' }],
          definition: [{ content: 'Flat def.' }],
          notes: [{ content: 'Flat note.' }],
        },
      },
    });

    const { graph } = emitConceptGraph(concept, concept.uri ?? "");
    const store = parse(writeTurtle(graph));

    const lcUri = `${BASE}/scoped.3/eng`;
    const noteBlanks = store.getObjects(lcUri, `${G}hasNote`, null);
    const innerExamples = store.getObjects(noteBlanks[0], `${G}hasExample`, null);
    expect(innerExamples.length).toBe(0);
  });
});