import type { RdfGraph, RdfResource, RdfTerm } from './rdf-graph';

export interface PropValue {
  predicate: string;
  values: string[];
  nested?: boolean;
}

export interface ClassInstance {
  classId: string;
  classLabel: string;
  label: string;
  props: PropValue[];
}

export function buildSections(graph: RdfGraph): ClassInstance[] {
  const out: ClassInstance[] = [];
  for (const r of graph.resources()) {
    out.push(resourceToSection(r));
  }
  return out;
}

function resourceToSection(r: RdfResource): ClassInstance {
  const props: PropValue[] = [];
  const seen = new Set<string>();

  for (const t of r.triples) {
    const value = formatTerm(t.object);
    if (!value) continue;
    const isNested = t.object.kind === 'blank';
    const key = `${t.predicate}#${isNested ? 'n' : 'f'}#${value}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const prop: PropValue = {
      predicate: t.predicate,
      values: [value],
    };
    if (isNested) prop.nested = true;
    props.push(prop);
  }

  return {
    classId: r.classId,
    classLabel: r.classLabel,
    label: r.label,
    props,
  };
}

export function formatTerm(term: RdfTerm): string {
  switch (term.kind) {
    case 'iri':
      return term.value;
    case 'literal':
      return term.value;
    case 'blank': {
      const parts = term.triples.map(t => `${t.predicate}: ${formatTerm(t.object)}`);
      return parts.join('; ');
    }
  }
}
