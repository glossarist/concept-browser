import { GLOSS, DCTERMS, RDF, XSD } from './predicates';
import { RdfGraph, lit, iri, blank, triple } from './rdf-graph';
import type { RdfTriple } from './rdf-graph';

export interface FormulaInput {
  readonly registerId: string;
  readonly formulaId: string;
  readonly expression: string;
  readonly latexForm?: string;
  readonly description?: string;
  readonly lang?: string;
  readonly sourceIri?: string;
  readonly baseUri?: string;
}

export interface TableHeaderCell {
  readonly value: string;
  readonly lang?: string;
}

export interface TableRow {
  readonly cells: readonly string[];
}

export interface TableInput {
  readonly registerId: string;
  readonly tableId: string;
  readonly title?: string;
  readonly caption?: string;
  readonly headers?: readonly TableHeaderCell[];
  readonly rows?: readonly TableRow[];
  readonly markup?: string;
  readonly markupFormat?: string;
  readonly lang?: string;
  readonly baseUri?: string;
}

function base(input: { baseUri?: string }): string {
  return input.baseUri ?? 'https://glossarist.org';
}

export function formulaIri(input: FormulaInput): string {
  return `${base(input)}/${input.registerId}/formula/${input.formulaId}`;
}

export function tableIri(input: TableInput): string {
  return `${base(input)}/${input.registerId}/table/${input.tableId}`;
}

export function emitFormulaGraph(input: FormulaInput): RdfGraph {
  const graph = new RdfGraph();
  const iriStr = formulaIri(input);
  const w = graph.declare(iriStr, {
    types: [GLOSS.Formula],
    label: input.expression,
    classLabel: 'Formula',
    classId: GLOSS.Formula,
  });
  w.literal(GLOSS.expression, input.expression);
  if (input.latexForm) w.literal(GLOSS.latexForm, input.latexForm);
  if (input.description) w.literal(DCTERMS.description, input.description, { lang: input.lang });
  if (input.sourceIri) w.iri('prov:wasDerivedFrom', input.sourceIri);
  return graph;
}

export function emitTableGraph(input: TableInput): RdfGraph {
  const graph = new RdfGraph();
  const iriStr = tableIri(input);
  const w = graph.declare(iriStr, {
    types: [GLOSS.Table],
    label: input.title ?? input.caption ?? input.tableId,
    classLabel: 'Table',
    classId: GLOSS.Table,
  });

  if (input.title) w.literal(DCTERMS.title, input.title, { lang: input.lang });
  if (input.caption) w.literal(GLOSS.caption, input.caption, { lang: input.lang });

  if (input.markup != null) {
    const contentTriples: RdfTriple[] = [
      triple(RDF.type, iri('gloss:MarkupTable')),
      triple(GLOSS.content, lit(input.markup)),
    ];
    if (input.markupFormat) contentTriples.push(triple(DCTERMS.format, lit(input.markupFormat)));
    w.blank(GLOSS.content, contentTriples);
  } else if (input.headers && input.headers.length > 0) {
    const contentTriples: RdfTriple[] = [
      triple(RDF.type, iri('gloss:StructuredTable')),
    ];
    for (const h of input.headers) {
      contentTriples.push(triple(GLOSS.hasHeader, lit(h.value, { lang: h.lang ?? input.lang })));
    }
    for (const row of input.rows ?? []) {
      const rowTriples = row.cells.map(c => triple(GLOSS.content, lit(c)));
      contentTriples.push(triple(GLOSS.hasRow, blank(...rowTriples)));
    }
    w.blank(GLOSS.content, contentTriples);
  }

  return graph;
}