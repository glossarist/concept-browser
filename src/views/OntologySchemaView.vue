<script setup lang="ts">
import { ref, computed } from 'vue';
import {
  getClass,
  getAllClasses,
  getClassTree,
  getAllPropertiesForClass,
  getStats,
  type OwlClass,
} from '../adapters/ontology-schema';
import { ontology, type TaxonomyConcept } from '../adapters/ontology-registry';

const stats = getStats();
const allClasses = getAllClasses();
const treeRoots = getClassTree();

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

const activeClassId = ref('gloss:Concept');
const showTaxonomies = ref(false);
const activeTaxonomy = ref<string | null>(null);

const activeClass = computed(() => getClass(activeClassId.value));
const activeProperties = computed(() => getAllPropertiesForClass(activeClassId.value));

function activeTaxonomyData() {
  if (!activeTaxonomy.value) return null;
  const key = activeTaxonomy.value as Parameters<typeof ontology.getAll>[0];
  const all = ontology.getAll(key);
  const top = all.filter(c => !c.broader);
  return { scheme: ontology.getScheme(key), concepts: all, top };
}

function childClasses(parentId: string): OwlClass[] {
  const cls = getClass(parentId);
  if (!cls) return [];
  return cls.children.map(id => getClass(id)).filter((c): c is OwlClass => !!c);
}

function hasChildren(cls: OwlClass): boolean {
  return cls.children.length > 0;
}

const expandedClasses = ref(new Set<string>(['gloss:Concept', 'gloss:Designation']));

function toggleExpand(cls: OwlClass) {
  const s = new Set(expandedClasses.value);
  if (s.has(cls.compact)) s.delete(cls.compact);
  else s.add(cls.compact);
  expandedClasses.value = s;
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
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-2xl sm:text-3xl font-semibold text-ink-800">Glossarist Ontology</h1>
      <p class="text-sm text-ink-400 mt-1">
        OWL ontology for terminology management (ISO 10241-1, 30042, 12620, 25964/SKOS)
      </p>
      <div class="max-w-2xl mt-3 text-sm text-ink-500 leading-relaxed space-y-2">
        <p>The Glossarist ontology defines the RDF/OWL vocabulary for describing structured terminology data. It models <strong>concepts</strong> with multilingual <strong>localizations</strong> (definitions, notes, examples) and typed <strong>designations</strong> (expressions, abbreviations, symbols) using the SKOS-XL pattern for reified lexical labels.</p>
        <p>It aligns with <strong>SKOS</strong> (concepts and relationships), <strong>SKOS-XL</strong> (designations as labels), <strong>ISO 25964</strong> (hierarchical relationship subtypes — generic, partitive, instantial), <strong>PROV-O</strong> (source provenance), and <strong>Dublin Core Terms</strong> (language, citation). Enumeration values use SKOS ConceptSchemes (10 taxonomies).</p>
      </div>
      <div class="flex flex-wrap gap-2 mt-4">
        <span class="badge badge-blue text-[10px]">{{ stats.classCount }} classes</span>
        <span class="badge text-[10px] bg-emerald-50 text-emerald-700">{{ stats.objectPropertyCount }} object properties</span>
        <span class="badge text-[10px] bg-amber-50 text-amber-700">{{ stats.datatypePropertyCount }} datatype properties</span>
        <span class="badge text-[10px] bg-purple-50 text-purple-700">{{ taxonomyKeys.length }} SKOS taxonomies</span>
      </div>
      <code class="block text-xs text-ink-400 mt-2">https://www.glossarist.org/ontologies/glossarist</code>
    </div>

    <!-- Sticky mobile chips -->
    <div class="lg:hidden sticky top-14 z-10 bg-surface -mx-4 px-4 py-2 border-b border-ink-100/60 mb-4">
      <div class="flex gap-2 overflow-x-auto scrollbar-none">
        <button v-for="item in allNavItems" :key="item.id"
          @click="activeClassId = item.id; activeTaxonomy = null"
          class="flex-shrink-0 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[44px] flex items-center gap-1.5"
          :class="activeClassId === item.id && !activeTaxonomy
            ? 'bg-ink-800 text-white'
            : 'bg-surface-raised border border-ink-100 text-ink-600 hover:bg-ink-50'"
        >
          <span v-if="item.depth > 0" class="text-ink-300">{{ ' '.repeat(item.depth * 2) }}</span>
          {{ item.label }}
        </button>
        <button @click="activeTaxonomy = activeTaxonomy ? null : taxonomyKeys[0]; showTaxonomies = true"
          class="flex-shrink-0 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[44px] flex items-center gap-1.5"
          :class="activeTaxonomy
            ? 'bg-ink-800 text-white'
            : 'bg-surface-raised border border-ink-100 text-ink-600 hover:bg-ink-50'"
        >Taxonomies</button>
      </div>
    </div>

    <!-- Two-column layout -->
    <div class="lg:grid lg:grid-cols-[220px_1fr] lg:gap-6">
      <!-- Left: tree sidebar (desktop only) -->
      <nav class="hidden lg:block border-r border-ink-100/60 pr-4">
        <div class="section-label mb-2">Classes</div>

        <!-- Tree roots with recursive children -->
        <template v-for="root in treeRoots" :key="root.compact">
          <div>
            <button @click="activeClassId = root.compact; activeTaxonomy = null; toggleExpand(root)"
              class="w-full flex items-center gap-1.5 px-2 py-2 rounded-lg text-sm transition-colors"
              :class="activeClassId === root.compact && !activeTaxonomy ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-600 hover:bg-ink-50'"
            >
              <span v-if="hasChildren(root)" class="text-[10px] text-ink-300 w-3">{{ expandedClasses.has(root.compact) ? '▾' : '▸' }}</span>
              <span v-else class="w-3"></span>
              <span class="flex-1 text-left">{{ root.label }}</span>
            </button>

            <!-- Children -->
            <div v-if="expandedClasses.has(root.compact) && hasChildren(root)" class="ml-4">
              <template v-for="child in childClasses(root.compact)" :key="child.compact">
                <button @click="activeClassId = child.compact; activeTaxonomy = null; toggleExpand(child)"
                  class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors"
                  :class="activeClassId === child.compact && !activeTaxonomy ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-500 hover:bg-ink-50'"
                >
                  <span v-if="hasChildren(child)" class="text-[10px] text-ink-300 w-3">{{ expandedClasses.has(child.compact) ? '▾' : '▸' }}</span>
                  <span v-else class="w-3 text-ink-200">·</span>
                  <span class="flex-1 text-left">{{ child.label }}</span>
                </button>
                <!-- Grandchildren -->
                <div v-if="expandedClasses.has(child.compact) && hasChildren(child)" class="ml-4">
                  <button v-for="gc in childClasses(child.compact)" :key="gc.compact"
                    @click="activeClassId = gc.compact; activeTaxonomy = null"
                    class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors"
                    :class="activeClassId === gc.compact && !activeTaxonomy ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-400 hover:bg-ink-50'"
                  >
                    <span class="w-3 text-ink-200">·</span>
                    <span class="flex-1 text-left">{{ gc.label }}</span>
                  </button>
                </div>
              </template>
            </div>
          </div>
        </template>

        <!-- Remaining classes not in tree (supporting) -->
        <div class="mt-4 pt-3 border-t border-ink-100/40">
          <div class="text-[10px] uppercase tracking-wide text-ink-300 mb-1.5">Supporting</div>
          <button v-for="cls in allClasses.filter(c => c.children.length === 0 && !c.subClassOf?.startsWith('gloss:') && c.compact !== 'gloss:Concept' && c.compact !== 'gloss:ConceptCollection')" :key="cls.compact"
            @click="activeClassId = cls.compact; activeTaxonomy = null"
            class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors"
            :class="activeClassId === cls.compact && !activeTaxonomy ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-400 hover:bg-ink-50'"
          >
            <span class="w-3 text-ink-200">·</span>
            <span class="flex-1 text-left">{{ cls.label }}</span>
          </button>
        </div>

        <!-- Taxonomies -->
        <div class="mt-4 pt-3 border-t border-ink-100/40">
          <div class="text-[10px] uppercase tracking-wide text-ink-300 mb-1.5">SKOS Taxonomies</div>
          <button v-for="tk in taxonomyKeys" :key="tk"
            @click="activeTaxonomy = tk; showTaxonomies = true"
            class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors"
            :class="activeTaxonomy === tk ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-400 hover:bg-ink-50'"
          >
            <span class="w-3 text-ink-200">·</span>
            <span class="flex-1 text-left">{{ taxonomyLabels[tk] }}</span>
          </button>
        </div>
      </nav>

      <!-- Right: detail panel -->
      <div class="mt-4 lg:mt-0">
        <!-- Class detail -->
        <template v-if="!activeTaxonomy && activeClass">
          <div class="pb-4 border-b border-ink-100/60 mb-4">
            <h2 class="text-lg font-semibold text-ink-800">{{ activeClass.label }}</h2>
            <code class="block text-xs text-ink-400 mt-1">{{ activeClass.iri }}</code>
            <div v-if="activeClass.subClassOf" class="flex items-center gap-2 mt-2 text-sm">
              <span class="text-ink-400 text-xs">subClassOf</span>
              <code class="text-xs text-ink-600 bg-ink-50 px-2 py-0.5 rounded">{{ activeClass.subClassOf }}</code>
              <template v-if="activeClass.ancestors.length > 1">
                <span class="text-ink-300 text-xs">→</span>
                <code class="text-xs text-ink-500">{{ activeClass.ancestors.slice(1).join(' → ') }}</code>
              </template>
            </div>
            <p v-if="activeClass.comment" class="text-sm text-ink-500 mt-3 leading-relaxed">{{ activeClass.comment }}</p>
          </div>

          <!-- Object Properties -->
          <div v-if="activeProperties.object.length" class="mb-6">
            <h3 class="text-xs uppercase tracking-wide text-ink-300 font-medium mb-2">
              Object Properties ({{ activeProperties.object.length }})
            </h3>
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="border-b border-ink-100/60">
                  <th class="text-left text-[11px] font-medium text-ink-400 uppercase tracking-wide py-2 px-3">Property</th>
                  <th class="text-left text-[11px] font-medium text-ink-400 uppercase tracking-wide py-2 px-3">Range</th>
                  <th class="text-left text-[11px] font-medium text-ink-400 uppercase tracking-wide py-2 px-3">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in activeProperties.object" :key="p.compact" class="border-b border-ink-100/30">
                  <td class="py-2 px-3 align-top">
                    <code class="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{{ p.compact }}</code>
                    <div v-if="p.inverseOf" class="text-[10px] text-ink-300 mt-0.5">↔ {{ p.inverseOf }}</div>
                  </td>
                  <td class="py-2 px-3 align-top">
                    <code class="text-xs text-ink-500">{{ p.range || p.rangeUnion?.join(' | ') || '—' }}</code>
                  </td>
                  <td class="py-2 px-3 text-xs text-ink-400 align-top">{{ p.comment || '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Datatype Properties -->
          <div v-if="activeProperties.datatype.length">
            <h3 class="text-xs uppercase tracking-wide text-ink-300 font-medium mb-2">
              Datatype Properties ({{ activeProperties.datatype.length }})
            </h3>
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="border-b border-ink-100/60">
                  <th class="text-left text-[11px] font-medium text-ink-400 uppercase tracking-wide py-2 px-3">Property</th>
                  <th class="text-left text-[11px] font-medium text-ink-400 uppercase tracking-wide py-2 px-3">Datatype</th>
                  <th class="text-left text-[11px] font-medium text-ink-400 uppercase tracking-wide py-2 px-3">Description</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="p in activeProperties.datatype" :key="p.compact" class="border-b border-ink-100/30">
                  <td class="py-2 px-3 align-top">
                    <code class="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">{{ p.compact }}</code>
                  </td>
                  <td class="py-2 px-3 align-top">
                    <code class="text-xs text-ink-500">{{ p.range || '—' }}</code>
                  </td>
                  <td class="py-2 px-3 text-xs text-ink-400 align-top">{{ p.comment || '' }}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="!activeProperties.object.length && !activeProperties.datatype.length" class="text-sm text-ink-300 italic">
            No properties defined directly on this class.
          </div>
        </template>

        <!-- Taxonomy detail -->
        <template v-if="activeTaxonomy && activeTaxonomyData()">
          <div class="pb-4 border-b border-ink-100/60 mb-4">
            <h2 class="text-lg font-semibold text-ink-800">{{ taxonomyLabels[activeTaxonomy] }}</h2>
            <code class="block text-xs text-ink-400 mt-1">{{ activeTaxonomyData()!.scheme }}</code>
          </div>

          <div class="space-y-2">
            <div v-for="concept in activeTaxonomyData()!.concepts" :key="concept.id"
              class="border border-ink-100/60 rounded-lg p-3">
              <div class="flex items-center gap-2">
                <code class="text-xs font-semibold text-ink-700">{{ concept.id }}</code>
                <span class="text-sm text-ink-600">{{ concept.prefLabel }}</span>
                <span v-if="concept.altLabel" class="text-xs text-ink-400">({{ concept.altLabel }})</span>
              </div>
              <p v-if="concept.definition" class="text-xs text-ink-400 mt-1 leading-relaxed">{{ concept.definition }}</p>
              <div v-if="concept.broader" class="text-[10px] text-ink-300 mt-1">
                broader: <code class="text-ink-400">{{ concept.broader }}</code>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
