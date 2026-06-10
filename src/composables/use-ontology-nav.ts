import { ref, computed } from 'vue';
import {
  getClass,
  getClassTree,
  getAllShapes,
  getObjectProperties,
  getDatatypeProperties,
  getAnnotationProperties,
  getOntology,
  getStats,
  type OwlClass,
  type OwlShape,
  type OwlProperty,
  type AnnotationProperty,
  type OwlOntology,
  ENTITY_TYPE_META,
  type EntityType,
} from '../adapters/ontology-schema';
import taxonomyData from '../data/taxonomies.json';

export function slugToCompact(slug: string): string {
  return slug.replace(/-/g, ':');
}

export function compactToSlug(compact: string): string {
  return compact.replace(/:/g, '-');
}

const treeRoots = getClassTree();
const allShapes = getAllShapes();
const objectProperties = getObjectProperties();
const datatypeProperties = getDatatypeProperties();
const annotationProperties = getAnnotationProperties();
const ontology = getOntology();
const stats = getStats();

const taxonomyKeys = [
  'conceptStatus', 'entryStatus', 'normativeStatus', 'sourceType', 'sourceStatus',
  'relationshipType', 'designationType', 'termType', 'grammarGender', 'grammarNumber',
];

const taxonomyLabels: Record<string, string> = {
  conceptStatus: 'Concept Status',
  entryStatus: 'Entry Status',
  normativeStatus: 'Normative Status',
  sourceType: 'Source Type',
  sourceStatus: 'Source Status',
  relationshipType: 'Relationship Type',
  designationType: 'Designation Type',
  termType: 'Term Type',
  grammarGender: 'Grammar Gender',
  grammarNumber: 'Grammar Number',
};

const valuesToTaxonomy: Record<string, string> = {
  'gloss:status': 'conceptStatus',
  'gloss:entstatus': 'entryStatus',
  'gloss:norm': 'normativeStatus',
  'gloss:sourceType': 'sourceType',
  'gloss:sourceStatus': 'sourceStatus',
  'gloss:rel': 'relationshipType',
  'gloss:desigType': 'designationType',
  'gloss:termType': 'termType',
  'gloss:gender': 'grammarGender',
  'gloss:number': 'grammarNumber',
};

function childClasses(parentId: string): OwlClass[] {
  const cls = getClass(parentId);
  if (!cls) return [];
  return cls.children.map(id => getClass(id)).filter((c): c is OwlClass => !!c);
}

function hasChildren(cls: OwlClass): boolean {
  return cls.children.length > 0;
}

function matchesSearch(text: string, query: string): boolean {
  return text.toLowerCase().includes(query.toLowerCase());
}

function taxonomyKeyForValuesFrom(valuesFrom: string | null): string | null {
  if (!valuesFrom) return null;
  return valuesToTaxonomy[valuesFrom] ?? null;
}

function getShapesForTaxonomy(taxonomyKey: string): OwlShape[] {
  const targetScheme = Object.entries(valuesToTaxonomy).find(([, v]) => v === taxonomyKey)?.[0];
  if (!targetScheme) return [];
  return allShapes.filter(s =>
    s.constraints.some(c => c.valuesFrom === targetScheme),
  );
}

export function useOntologyNav() {
  const expandedClasses = ref(new Set<string>(['gloss:Designation']));

  const collapsedSections = ref(new Set<string>([
    'objectProperty',
    'datatypeProperty',
    'shape',
    'taxonomy',
    'namedIndividual',
    'annotationProperty',
  ]));

  const searchQuery = ref('');

  function toggleExpand(cls: OwlClass) {
    const s = new Set(expandedClasses.value);
    if (s.has(cls.compact)) s.delete(cls.compact);
    else s.add(cls.compact);
    expandedClasses.value = s;
  }

  function toggleSection(key: string) {
    const s = new Set(collapsedSections.value);
    if (s.has(key)) s.delete(key);
    else s.add(key);
    collapsedSections.value = s;
  }

  function expandAllSections() {
    collapsedSections.value = new Set();
  }

  function collapseAllSections() {
    collapsedSections.value = new Set(['objectProperty', 'datatypeProperty', 'shape', 'taxonomy', 'class', 'namedIndividual', 'annotationProperty']);
  }

  const allNavItems = computed(() => {
    const items: { id: string; label: string; depth: number }[] = [];
    function walk(classes: OwlClass[], depth: number) {
      for (const cls of classes) {
        items.push({ id: cls.compact, label: cls.label, depth });
        if (expandedClasses.value.has(cls.compact)) {
          walk(childClasses(cls.compact), depth + 1);
        }
      }
    }
    walk(treeRoots, 0);
    return items;
  });

  const searchResults = computed(() => {
    const q = searchQuery.value.trim();
    if (!q) return null;

    const matchedClasses: OwlClass[] = [];
    const matchedObjectProps: OwlProperty[] = [];
    const matchedDatatypeProps: OwlProperty[] = [];
    const matchedShapes: OwlShape[] = [];
    const matchedIndividuals: { group: string; id: string; prefLabel: string }[] = [];
    const matchedAnnotationProps: AnnotationProperty[] = [];

    function walkAll(classes: OwlClass[]) {
      for (const cls of classes) {
        if (matchesSearch(cls.label, q) || matchesSearch(cls.compact, q)) {
          matchedClasses.push(cls);
        }
        walkAll(childClasses(cls.compact));
      }
    }
    walkAll(treeRoots);

    for (const p of objectProperties) {
      if (matchesSearch(p.label, q) || matchesSearch(p.compact, q)) matchedObjectProps.push(p);
    }
    for (const p of datatypeProperties) {
      if (matchesSearch(p.label, q) || matchesSearch(p.compact, q)) matchedDatatypeProps.push(p);
    }
    for (const s of allShapes) {
      if (matchesSearch(s.label, q) || matchesSearch(s.compact, q)) matchedShapes.push(s);
    }
    for (const g of groupedIndividuals.value) {
      for (const c of g.concepts) {
        if (matchesSearch(c.prefLabel, q) || matchesSearch(c.id, q)) {
          matchedIndividuals.push({ group: g.key, id: c.id, prefLabel: c.prefLabel });
        }
      }
    }
    for (const ap of annotationProperties) {
      if (matchesSearch(ap.label, q) || matchesSearch(ap.compact, q)) matchedAnnotationProps.push(ap);
    }

    const total = matchedClasses.length + matchedObjectProps.length + matchedDatatypeProps.length + matchedShapes.length + matchedIndividuals.length + matchedAnnotationProps.length;

    return {
      total,
      classes: matchedClasses,
      objectProperties: matchedObjectProps,
      datatypeProperties: matchedDatatypeProps,
      shapes: matchedShapes,
      individuals: matchedIndividuals,
      annotationProperties: matchedAnnotationProps,
    };
  });

  const groupedIndividuals = computed<IndividualGroup[]>(() => {
    return taxonomyKeys.map(key => {
      const tax = (taxonomyData as Record<string, any>)[key];
      if (!tax) return { key, label: taxonomyLabels[key] || key, concepts: [] };
      const concepts = Object.values(tax.concepts as Record<string, any>).map((c: any) => ({
        id: c.id,
        prefLabel: c.prefLabel,
      }));
      return { key, label: tax.schemeLabel || taxonomyLabels[key] || key, concepts };
    });
  });

  const totalIndividuals = computed(() =>
    groupedIndividuals.value.reduce((sum, g) => sum + g.concepts.length, 0),
  );

  return {
    expandedClasses,
    collapsedSections,
    searchQuery,
    taxonomyKeys,
    taxonomyLabels,
    treeRoots,
    allShapes,
    objectProperties,
    datatypeProperties,
    annotationProperties,
    ontology,
    stats,
    groupedIndividuals,
    totalIndividuals,
    allNavItems,
    searchResults,
    valuesToTaxonomy,
    taxonomyKeyForValuesFrom,
    getShapesForTaxonomy,
    toggleExpand,
    toggleSection,
    expandAllSections,
    collapseAllSections,
    childClasses,
    hasChildren,
    ENTITY_TYPE_META,
  };
}

interface IndividualGroup {
  key: string;
  label: string;
  concepts: { id: string; prefLabel: string }[];
}
