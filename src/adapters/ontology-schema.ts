/**
 * Ontology schema loader — provides class/property definitions parsed from
 * the Glossarist OWL ontology for the Ontospy-style concept view.
 */
import schemaData from '../data/ontology-schema.json';

export interface OwlClass {
  iri: string;
  compact: string;
  label: string;
  comment: string | null;
  subClassOf: string | null;
  disjointWith: string | null;
  children: string[];
  ancestors: string[];
}

export interface OwlProperty {
  iri: string;
  compact: string;
  label: string;
  comment: string | null;
  type: 'object' | 'datatype';
  domain: string | null;
  domainUnion: string[] | null;
  range: string | null;
  rangeUnion: string[] | null;
  inverseOf: string | null;
}

interface OntologySchema {
  ontologyIri: string;
  ontologyLabel: string;
  classes: Record<string, OwlClass>;
  classHierarchyRoots: string[];
  properties: Record<string, OwlProperty>;
  propertiesByDomain: Record<string, { object: string[]; datatype: string[] }>;
  stats: { classCount: number; objectPropertyCount: number; datatypePropertyCount: number };
}

const data = schemaData as unknown as OntologySchema;

export function getClass(id: string): OwlClass | null {
  return data.classes[id] ?? null;
}

export function getProperty(id: string): OwlProperty | null {
  return data.properties[id] ?? null;
}

export function getPropertiesForDomain(domain: string): { object: OwlProperty[]; datatype: OwlProperty[] } {
  const group = data.propertiesByDomain[domain];
  if (!group) return { object: [], datatype: [] };
  return {
    object: group.object.map(id => data.properties[id]).filter(Boolean),
    datatype: group.datatype.map(id => data.properties[id]).filter(Boolean),
  };
}

/** Get all properties applicable to a class, including inherited ones. */
export function getAllPropertiesForClass(classId: string): { object: OwlProperty[]; datatype: OwlProperty[] } {
  const cls = data.classes[classId];
  if (!cls) return { object: [], datatype: [] };

  const classChain = [classId, ...cls.ancestors];
  const objectProps: OwlProperty[] = [];
  const datatypeProps: OwlProperty[] = [];
  const seen = new Set<string>();

  for (const c of classChain) {
    const props = getPropertiesForDomain(c);
    for (const p of props.object) {
      if (!seen.has(p.compact)) { seen.add(p.compact); objectProps.push(p); }
    }
    for (const p of props.datatype) {
      if (!seen.has(p.compact)) { seen.add(p.compact); datatypeProps.push(p); }
    }
  }

  return { object: objectProps, datatype: datatypeProps };
}

/** Get the full class hierarchy tree starting from roots. */
export function getClassTree(): OwlClass[] {
  return data.classHierarchyRoots
    .map(id => data.classes[id])
    .filter(Boolean);
}

export function getAllClasses(): OwlClass[] {
  return Object.values(data.classes);
}

export function getAllProperties(): OwlProperty[] {
  return Object.values(data.properties);
}

export function getStats() {
  return data.stats;
}
