/**
 * Ontology schema loader — provides class/property/shape definitions parsed from
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

export interface ShaclConstraint {
  path: string | null;
  datatype: string | null;
  class: string | null;
  valuesFrom: string | null;
  nodeKind: string | null;
  minCount: number | null;
  maxCount: number | null;
  in: string[] | null;
}

export interface OwlShape {
  iri: string;
  compact: string;
  label: string;
  comment: string | null;
  targetClass: string | null;
  shapeClass: string | null;
  constraints: ShaclConstraint[];
}

export interface OwlOntology {
  iri: string;
  label: string;
  comment: string | null;
  prefix: string | null;
  namespaceUri: string | null;
  imports: { iri: string; label: string }[];
  license: string | null;
  created: string | null;
}

export interface AnnotationProperty {
  iri: string;
  compact: string;
  label: string;
}

export type EntityType = 'class' | 'objectProperty' | 'datatypeProperty' | 'shape' | 'annotationProperty';

export const ENTITY_TYPE_META: Record<EntityType, { label: string; color: string }> = {
  class: { label: 'Classes', color: 'blue' },
  objectProperty: { label: 'Object Properties', color: 'emerald' },
  datatypeProperty: { label: 'Datatype Properties', color: 'amber' },
  shape: { label: 'SHACL Shapes', color: 'purple' },
  annotationProperty: { label: 'Annotation Properties', color: 'pink' },
};

interface OntologySchema {
  ontology: OwlOntology | null;
  ontologyIri: string;
  ontologyLabel: string;
  classes: Record<string, OwlClass>;
  classHierarchyRoots: string[];
  properties: Record<string, OwlProperty>;
  propertiesByDomain: Record<string, { object: string[]; datatype: string[] }>;
  shapes: Record<string, OwlShape>;
  shapesByTargetClass: Record<string, string[]>;
  annotationProperties: AnnotationProperty[];
  stats: {
    classCount: number;
    objectPropertyCount: number;
    datatypePropertyCount: number;
    shapeCount: number;
    annotationPropertyCount: number;
  };
}

const data = schemaData as unknown as OntologySchema;

export function getClass(id: string): OwlClass | null {
  return data.classes[id] ?? null;
}

export function getProperty(id: string): OwlProperty | null {
  return data.properties[id] ?? null;
}

export function getShape(id: string): OwlShape | null {
  return data.shapes[id] ?? null;
}

export function getPropertiesForDomain(domain: string): { object: OwlProperty[]; datatype: OwlProperty[] } {
  const group = data.propertiesByDomain[domain];
  if (!group) return { object: [], datatype: [] };
  return {
    object: group.object.map(id => data.properties[id]).filter(Boolean),
    datatype: group.datatype.map(id => data.properties[id]).filter(Boolean),
  };
}

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

export function getShapesForClass(classId: string): OwlShape[] {
  const shapeIds = data.shapesByTargetClass[classId] ?? [];
  return shapeIds.map(id => data.shapes[id]).filter(Boolean);
}

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

export function getObjectProperties(): OwlProperty[] {
  return Object.values(data.properties).filter(p => p.type === 'object');
}

export function getDatatypeProperties(): OwlProperty[] {
  return Object.values(data.properties).filter(p => p.type === 'datatype');
}

export function getAllShapes(): OwlShape[] {
  return Object.values(data.shapes);
}

export function getAnnotationProperties(): AnnotationProperty[] {
  return data.annotationProperties;
}

export function getOntology(): OwlOntology | null {
  return data.ontology;
}

export function getStats() {
  return data.stats;
}
