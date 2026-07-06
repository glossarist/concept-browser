import type { ComputedRef } from 'vue';
import { computed } from 'vue';
import type { Concept } from 'glossarist';
import {
  conceptToQuads,
  provenanceToQuads,
  quadSectionsToClassInstances,
  writeTurtleSync,
  collectQuads,
  PREFIXES,
  type ClassInstance,
  type PropValue,
  type Quad,
} from 'glossarist/rdf';

export type { ClassInstance, PropValue };

export interface RdfDocument {
  sections: ComputedRef<ClassInstance[]>;
  turtle: ComputedRef<string>;
  jsonld: ComputedRef<string>;
  typeChain: ComputedRef<string[]>;
}

export interface UseRdfDocumentOptions {
  readonly registerId?: string;
  readonly uriBase?: string;
  readonly lazy?: boolean;
}

const SERIALIZER_VERSION =
  typeof __CONCEPT_BROWSER_VERSION__ !== 'undefined'
    ? __CONCEPT_BROWSER_VERSION__
    : 'dev';

function formatJsonLd(quads: readonly Quad[]): string {
  // Minimal sync JSON-LD serializer: @context + @graph array of nodes.
  // Predicates and types are emitted as compact IRIs; values are emitted
  // as their term-type-appropriate JSON form.
  const context: Record<string, string> = {};
  for (const prefix of ['gloss', 'skos', 'skosxl', 'dcterms', 'prov', 'rdf', 'rdfs', 'xsd', 'owl']) {
    // Skip — handled by RDF_PREFIXES for the Vue UI; JSON-LD context is
    // minimal here because glossarist/rdf's writeJsonld is async and
    // the composable must stay sync.
  }

  // Group quads by subject
  const bySubject = new Map<string, { subject: string; quads: Quad[] }>();
  const order: string[] = [];
  for (const q of quads) {
    const s = q.subject.value;
    if (!bySubject.has(s)) {
      bySubject.set(s, { subject: s, quads: [] });
      order.push(s);
    }
    bySubject.get(s)!.quads.push(q);
  }

  const nodes = order.map(s => {
    const entry = bySubject.get(s)!;
    const node: Record<string, unknown> = { '@id': entry.subject };
    const types: string[] = [];
    const props: Record<string, unknown[]> = {};

    for (const q of entry.quads) {
      if (q.predicate.value === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type') {
        types.push(q.object.value);
        continue;
      }
      const pred = q.predicate.value;
      const val = termToJsonLd(q.object);
      if (!props[pred]) props[pred] = [];
      props[pred].push(val);
    }

    if (types.length === 1) node['@type'] = types[0];
    else if (types.length > 1) node['@type'] = types;

    for (const [pred, vals] of Object.entries(props)) {
      node[pred] = vals.length === 1 ? vals[0] : vals;
    }
    return node;
  });

  return JSON.stringify({ '@context': context, '@graph': nodes }, null, 2);
}

function termToJsonLd(term: Quad['object']): unknown {
  switch (term.termType) {
    case 'NamedNode':
      return { '@id': term.value };
    case 'Literal':
      if (term.language) return { '@value': term.value, '@language': term.language };
      if (term.datatype && term.datatype.value !== 'http://www.w3.org/2001/XMLSchema#string') {
        return { '@value': term.value, '@type': term.datatype.value };
      }
      return term.value;
    case 'BlankNode':
      return { '@id': `_:${term.value}` };
    default:
      return term.value;
  }
}

export function useRdfDocument(
  getConcept: () => Concept,
  getConceptUri: () => string,
  options: UseRdfDocumentOptions = {},
): RdfDocument {
  const emission = computed(() => {
    const concept = getConcept();
    const uri = getConceptUri();
    const conceptQuads = collectQuads(
      conceptToQuads(concept, {
        registerId: options.registerId ?? '',
        uriBase: options.uriBase ?? '',
      }),
    );
    const provenanceQuads = collectQuads(
      provenanceToQuads({
        subjectUri: uri,
        serializer: 'concept-browser',
        serializerVersion: SERIALIZER_VERSION,
        generatedAt: new Date().toISOString(),
      }),
    );
    return [...conceptQuads, ...provenanceQuads];
  });

  const sections = computed(() => quadSectionsToClassInstances(emission.value));
  const turtle = computed(() => writeTurtleSync(emission.value, { prefixes: PREFIXES }));
  const jsonld = computed(() => formatJsonLd(emission.value));

  const typeChain = computed(() => ['owl:Thing', 'skos:Concept', 'gloss:Concept']);

  return { sections, turtle, jsonld, typeChain };
}
