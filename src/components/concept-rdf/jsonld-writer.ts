import { RDF_PREFIXES } from './rdf-prefixes';
import type { RdfGraph, RdfResource, RdfTerm, RdfTriple } from './rdf-graph';

export function writeJsonLd(graph: RdfGraph): string {
  const context: Record<string, string> = {};
  for (const p of RDF_PREFIXES) {
    context[p.prefix] = p.iri;
  }

  const nodes: JsonLdNode[] = [];
  for (const r of graph.resources()) {
    nodes.push(resourceToNode(r));
  }

  const doc = {
    '@context': context,
    '@graph': nodes,
  };

  return JSON.stringify(doc, null, 2);
}

interface JsonLdNode {
  [key: string]: unknown;
}

function resourceToNode(r: RdfResource): JsonLdNode {
  const node: JsonLdNode = {
    '@id': r.subject,
    '@type': [...r.types],
  };
  mergeTriplesInto(node, r.triples);
  return node;
}

function blankNodeToNode(triples: readonly RdfTriple[]): JsonLdNode {
  const node: JsonLdNode = {};
  mergeTriplesInto(node, triples);
  return node;
}

function mergeTriplesInto(node: JsonLdNode, triples: readonly RdfTriple[]): void {
  const grouped = new Map<string, RdfTerm[]>();
  for (const t of triples) {
    const arr = grouped.get(t.predicate) ?? [];
    arr.push(t.object);
    grouped.set(t.predicate, arr);
  }
  for (const [pred, terms] of grouped) {
    node[pred] = terms.length === 1
      ? termToJson(terms[0])
      : terms.map(termToJson);
  }
}

function termToJson(term: RdfTerm): unknown {
  switch (term.kind) {
    case 'iri':
      return { '@id': term.value };
    case 'literal':
      if (term.lang) return { '@value': term.value, '@language': term.lang };
      if (term.datatype) return { '@value': term.value, '@type': term.datatype };
      return term.value;
    case 'blank':
      return blankNodeToNode(term.triples);
  }
}
