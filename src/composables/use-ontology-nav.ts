import { ref, computed } from 'vue';
import {
  getClass,
  getClassTree,
  getAllClasses,
  type OwlClass,
} from '../adapters/ontology-schema';

const OVERVIEW_ID = '__overview__';

const activeClassId = ref<string | null>(null);
const activeTaxonomy = ref<string | null>(null);
const expandedClasses = ref(new Set<string>(['gloss:Designation']));

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

function toggleExpand(cls: OwlClass) {
  const s = new Set(expandedClasses.value);
  if (s.has(cls.compact)) s.delete(cls.compact);
  else s.add(cls.compact);
  expandedClasses.value = s;
}

function childClasses(parentId: string): OwlClass[] {
  const cls = getClass(parentId);
  if (!cls) return [];
  return cls.children.map(id => getClass(id)).filter((c): c is OwlClass => !!c);
}

function hasChildren(cls: OwlClass): boolean {
  return cls.children.length > 0;
}

const treeRoots = getClassTree();

const supportingClasses = computed(() =>
  getAllClasses().filter(
    c => c.children.length === 0
      && !c.subClassOf?.startsWith('gloss:')
      && c.compact !== 'gloss:Concept'
      && c.compact !== 'gloss:ConceptCollection'
  )
);

const isOverview = computed(() => activeClassId.value === null && activeTaxonomy.value === null);

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

export function useOntologyNav() {
  return {
    activeClassId,
    activeTaxonomy,
    expandedClasses,
    taxonomyKeys,
    taxonomyLabels,
    treeRoots,
    supportingClasses,
    allNavItems,
    isOverview,
    toggleExpand,
    childClasses,
    hasChildren,
  };
}
