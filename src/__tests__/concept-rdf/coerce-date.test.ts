import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { Concept } from 'glossarist';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import { emitConceptGraph } from '../../components/concept-rdf/concept-emitter';

const G = 'https://www.glossarist.org/ontologies/';
const XSD = 'http://www.w3.org/2001/XMLSchema#';

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

const BASE = 'https://glossarist.org/fixtures/dates';

describe('B4/C — coerceToDateTime handles year-only and month-only dates', () => {
  it('coerces yyyy-mm-dd to xsd:dateTime unchanged (with T00:00:00Z)', () => {
    const concept = Concept.fromJSON({
      id: 'd.1', uri: `${BASE}/d.1`, status: 'valid',
      dates: [{ type: 'accepted', date: '2020-06-15' }],
      localizations: {
        eng: {
          language_code: 'eng', entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'd1', normative_status: 'preferred' }],
          definition: [{ content: 'def' }],
        },
      },
    });
    const { graph } = emitConceptGraph(concept, concept.uri ?? '');
    const store = parse(writeTurtle(graph));
    const dateBlanks = store.getObjects(concept.uri ?? '', `${G}hasDate`, null);
    const values = store.getObjects(dateBlanks[0], `${G}dateValue`, null);
    expect((values[0] as any).value).toBe('2020-06-15T00:00:00Z');
    expect((values[0] as any).datatype.value).toBe(`${XSD}dateTime`);
  });

  it('coerces year-only "2020" to "2020-01-01T00:00:00Z"', () => {
    const concept = Concept.fromJSON({
      id: 'd.2', uri: `${BASE}/d.2`, status: 'valid',
      dates: [{ type: 'accepted', date: '2020' }],
      localizations: {
        eng: {
          language_code: 'eng', entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'd2', normative_status: 'preferred' }],
          definition: [{ content: 'def' }],
        },
      },
    });
    const { graph } = emitConceptGraph(concept, concept.uri ?? '');
    const store = parse(writeTurtle(graph));
    const dateBlanks = store.getObjects(concept.uri ?? '', `${G}hasDate`, null);
    const values = store.getObjects(dateBlanks[0], `${G}dateValue`, null);
    expect((values[0] as any).value).toBe('2020-01-01T00:00:00Z');
    expect((values[0] as any).datatype.value).toBe(`${XSD}dateTime`);
  });

  it('coerces month-only "2020-06" to "2020-06-01T00:00:00Z"', () => {
    const concept = Concept.fromJSON({
      id: 'd.3', uri: `${BASE}/d.3`, status: 'valid',
      dates: [{ type: 'accepted', date: '2020-06' }],
      localizations: {
        eng: {
          language_code: 'eng', entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'd3', normative_status: 'preferred' }],
          definition: [{ content: 'def' }],
        },
      },
    });
    const { graph } = emitConceptGraph(concept, concept.uri ?? '');
    const store = parse(writeTurtle(graph));
    const dateBlanks = store.getObjects(concept.uri ?? '', `${G}hasDate`, null);
    const values = store.getObjects(dateBlanks[0], `${G}dateValue`, null);
    expect((values[0] as any).value).toBe('2020-06-01T00:00:00Z');
  });

  it('passes through ISO 8601 datetimes unchanged', () => {
    const concept = Concept.fromJSON({
      id: 'd.4', uri: `${BASE}/d.4`, status: 'valid',
      dates: [{ type: 'accepted', date: '2020-06-15T13:45:30Z' }],
      localizations: {
        eng: {
          language_code: 'eng', entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'd4', normative_status: 'preferred' }],
          definition: [{ content: 'def' }],
        },
      },
    });
    const { graph } = emitConceptGraph(concept, concept.uri ?? '');
    const store = parse(writeTurtle(graph));
    const dateBlanks = store.getObjects(concept.uri ?? '', `${G}hasDate`, null);
    const values = store.getObjects(dateBlanks[0], `${G}dateValue`, null);
    expect((values[0] as any).value).toBe('2020-06-15T13:45:30Z');
  });
});