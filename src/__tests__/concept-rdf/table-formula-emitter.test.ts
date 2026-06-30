import { describe, it, expect } from 'vitest';
import { Parser, Store } from 'n3';
import { writeTurtle } from '../../components/concept-rdf/turtle-writer';
import {
  emitFormulaGraph,
  emitTableGraph,
  formulaIri,
  tableIri,
} from '../../components/concept-rdf/table-formula-emitter';

const G = 'https://www.glossarist.org/ontologies/';
const DCTERMS = 'http://purl.org/dc/terms/';
const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

function parse(turtle: string): Store {
  const parser = new Parser({ format: 'Turtle' });
  const store = new Store();
  store.addQuads(parser.parse(turtle));
  return store;
}

describe('WS K3 — Formula representation', () => {
  it('types each formula as gloss:Formula', () => {
    const graph = emitFormulaGraph({
      registerId: 'iso-geodetic',
      formulaId: 'f1',
      expression: 'E = mc^2',
    });
    const store = parse(writeTurtle(graph));
    const iri = formulaIri({ registerId: 'iso-geodetic', formulaId: 'f1', expression: '' });
    const types = store.getObjects(iri, RDF_TYPE, null).map(q => q.value);
    expect(types).toContain(`${G}Formula`);
  });

  it('emits gloss:expression as the canonical form', () => {
    const graph = emitFormulaGraph({
      registerId: 'r',
      formulaId: 'f1',
      expression: 'tan(θ) = μ',
    });
    const store = parse(writeTurtle(graph));
    const iri = formulaIri({ registerId: 'r', formulaId: 'f1', expression: '' });
    const exprs = store.getObjects(iri, `${G}expression`, null).map(q => q.value);
    expect(exprs).toContain('tan(θ) = μ');
  });

  it('emits gloss:latexForm when provided', () => {
    const graph = emitFormulaGraph({
      registerId: 'r',
      formulaId: 'f1',
      expression: 'E = mc^2',
      latexForm: '\\mathrm{E} = mc^2',
    });
    const store = parse(writeTurtle(graph));
    const iri = formulaIri({ registerId: 'r', formulaId: 'f1', expression: '' });
    const latex = store.getObjects(iri, `${G}latexForm`, null).map(q => q.value);
    expect(latex).toContain('\\mathrm{E} = mc^2');
  });

  it('emits dcterms:description when provided', () => {
    const graph = emitFormulaGraph({
      registerId: 'r',
      formulaId: 'f1',
      expression: 'E = mc^2',
      description: 'Mass-energy equivalence',
      lang: 'eng',
    });
    const store = parse(writeTurtle(graph));
    const iri = formulaIri({ registerId: 'r', formulaId: 'f1', expression: '' });
    const desc = store.getObjects(iri, `${DCTERMS}description`, null).map(q => q.value);
    expect(desc).toContain('Mass-energy equivalence');
  });
});

describe('WS K3 — Table representation', () => {
  it('types each table as gloss:Table', () => {
    const graph = emitTableGraph({
      registerId: 'r',
      tableId: 't1',
      title: 'Conversion factors',
    });
    const store = parse(writeTurtle(graph));
    const iri = tableIri({ registerId: 'r', tableId: 't1' });
    const types = store.getObjects(iri, RDF_TYPE, null).map(q => q.value);
    expect(types).toContain(`${G}Table`);
  });

  it('emits dcterms:title and gloss:caption when provided', () => {
    const graph = emitTableGraph({
      registerId: 'r',
      tableId: 't1',
      title: 'Conversion factors',
      caption: 'Common unit conversions',
      lang: 'eng',
    });
    const store = parse(writeTurtle(graph));
    const iri = tableIri({ registerId: 'r', tableId: 't1' });
    expect(store.getObjects(iri, `${DCTERMS}title`, null).map(q => q.value)).toContain('Conversion factors');
    expect(store.getObjects(iri, `${G}caption`, null).map(q => q.value)).toContain('Common unit conversions');
  });

  it('emits a MarkupTable content blank when markup is provided', () => {
    const graph = emitTableGraph({
      registerId: 'r',
      tableId: 't1',
      markup: '<table><tr><td>1</td></tr></table>',
      markupFormat: 'html',
    });
    const store = parse(writeTurtle(graph));
    const iri = tableIri({ registerId: 'r', tableId: 't1' });
    const contentBlanks = store.getObjects(iri, `${G}content`, null);
    expect(contentBlanks.length).toBe(1);
    const contentBlank = contentBlanks[0];
    const innerTypes = store.getObjects(contentBlank, RDF_TYPE, null).map(q => q.value);
    expect(innerTypes).toContain(`${G}MarkupTable`);
    const markupLiterals = store.getObjects(contentBlank, `${G}content`, null).map(q => q.value);
    expect(markupLiterals).toContain('<table><tr><td>1</td></tr></table>');
    const formats = store.getObjects(contentBlank, `${DCTERMS}format`, null).map(q => q.value);
    expect(formats).toContain('html');
  });

  it('emits a StructuredTable content blank when headers and rows are provided', () => {
    const graph = emitTableGraph({
      registerId: 'r',
      tableId: 't1',
      headers: [{ value: 'Term' }, { value: 'Definition' }],
      rows: [
        { cells: ['metre', 'unit of length'] },
        { cells: ['second', 'unit of time'] },
      ],
    });
    const store = parse(writeTurtle(graph));
    const iri = tableIri({ registerId: 'r', tableId: 't1' });
    const contentBlanks = store.getObjects(iri, `${G}content`, null);
    expect(contentBlanks.length).toBe(1);
    const contentBlank = contentBlanks[0];
    const innerTypes = store.getObjects(contentBlank, RDF_TYPE, null).map(q => q.value);
    expect(innerTypes).toContain(`${G}StructuredTable`);
    const rows = store.getObjects(contentBlank, `${G}hasRow`, null);
    expect(rows.length).toBe(2);
  });
});