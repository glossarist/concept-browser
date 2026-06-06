<script setup lang="ts">
import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useOntologyNav, compactToSlug } from '../composables/use-ontology-nav';

const router = useRouter();
const route = useRoute();

const {
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
  groupedIndividuals,
  totalIndividuals,
  searchResults,
  toggleExpand,
  toggleSection,
  childClasses,
  hasChildren,
  ENTITY_TYPE_META,
} = useOntologyNav();

const activeClassId = computed(() => {
  if (route.name !== 'ontology-class') return null;
  const slug = route.params.classId as string;
  return slug.replace(/-/g, ':');
});

const activeTaxonomy = computed(() => {
  if (route.name !== 'ontology-taxonomy') return null;
  return route.params.taxonomyKey as string;
});

const activeShapeId = computed(() => {
  if (route.name !== 'ontology-shape') return null;
  const slug = route.params.shapeId as string;
  return slug.replace(/-/g, ':');
});

const activePropertyId = computed(() => {
  if (route.name !== 'ontology-property') return null;
  const slug = route.params.propertyId as string;
  return slug.replace(/-/g, ':');
});

const isOverview = computed(() => route.name === 'ontology');
const isSearching = computed(() => !!searchQuery.value.trim());

const ontologyExpanded = ref(true);

function selectClass(id: string) {
  router.push(`/ontology/class/${compactToSlug(id)}`);
}

function selectTaxonomy(key: string) {
  router.push(`/ontology/taxonomy/${key}`);
}

function selectShape(id: string) {
  router.push(`/ontology/shape/${compactToSlug(id)}`);
}

function selectProperty(id: string) {
  router.push(`/ontology/property/${compactToSlug(id)}`);
}
</script>

<template>
  <!-- Search input -->
  <div class="relative mb-1.5">
    <input
      v-model="searchQuery"
      type="text"
      placeholder="Search entities..."
      class="w-full text-[11px] px-2 py-1.5 rounded-md border border-ink-200/60 bg-surface text-ink-700 placeholder:text-ink-300 focus:outline-none focus:border-blue-300 focus:ring-1 focus:ring-blue-200"
    />
    <span v-if="searchResults" class="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-ink-400">
      {{ searchResults.total }}
    </span>
  </div>

  <!-- Overview link -->
  <router-link to="/ontology"
    class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors"
    :class="isOverview ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-600 hover:bg-ink-50'"
  >
    <span class="w-3 text-ink-200">·</span>
    <span class="flex-1 text-left">Overview</span>
  </router-link>

  <!-- Search results mode -->
  <template v-if="isSearching && searchResults">
    <div v-if="searchResults.classes.length" class="mt-1">
      <div class="px-2 py-1 text-[10px] uppercase tracking-wide text-blue-500 font-medium">Classes ({{ searchResults.classes.length }})</div>
      <button v-for="cls in searchResults.classes" :key="cls.compact"
        @click="selectClass(cls.compact); searchQuery = ''"
        class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors text-ink-600 hover:bg-ink-50"
      >
        <span class="w-3 text-ink-200">·</span>
        <span class="flex-1 text-left truncate">{{ cls.label }}</span>
        <code class="text-[9px] text-ink-300">{{ cls.compact }}</code>
      </button>
    </div>
    <div v-if="searchResults.objectProperties.length" class="mt-1">
      <div class="px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-500 font-medium">Object Properties ({{ searchResults.objectProperties.length }})</div>
      <button v-for="p in searchResults.objectProperties" :key="p.compact"
        @click="selectProperty(p.compact); searchQuery = ''"
        class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors text-ink-600 hover:bg-ink-50"
      >
        <span class="w-3 text-ink-200">·</span>
        <span class="flex-1 text-left truncate">{{ p.label }}</span>
      </button>
    </div>
    <div v-if="searchResults.datatypeProperties.length" class="mt-1">
      <div class="px-2 py-1 text-[10px] uppercase tracking-wide text-amber-500 font-medium">Datatype Properties ({{ searchResults.datatypeProperties.length }})</div>
      <button v-for="p in searchResults.datatypeProperties" :key="p.compact"
        @click="selectProperty(p.compact); searchQuery = ''"
        class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors text-ink-600 hover:bg-ink-50"
      >
        <span class="w-3 text-ink-200">·</span>
        <span class="flex-1 text-left truncate">{{ p.label }}</span>
      </button>
    </div>
    <div v-if="searchResults.shapes.length" class="mt-1">
      <div class="px-2 py-1 text-[10px] uppercase tracking-wide text-purple-500 font-medium">SHACL Shapes ({{ searchResults.shapes.length }})</div>
      <button v-for="s in searchResults.shapes" :key="s.compact"
        @click="selectShape(s.compact); searchQuery = ''"
        class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors text-ink-600 hover:bg-ink-50"
      >
        <span class="w-3 text-ink-200">·</span>
        <span class="flex-1 text-left truncate">{{ s.label }}</span>
      </button>
    </div>
    <div v-if="searchResults.individuals.length" class="mt-1">
      <div class="px-2 py-1 text-[10px] uppercase tracking-wide text-rose-500 font-medium">Named Individuals ({{ searchResults.individuals.length }})</div>
      <button v-for="ind in searchResults.individuals" :key="ind.group + '/' + ind.id"
        @click="selectTaxonomy(ind.group); searchQuery = ''"
        class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors text-ink-600 hover:bg-ink-50"
      >
        <span class="w-3 text-ink-200">·</span>
        <span class="flex-1 text-left truncate">{{ ind.prefLabel }}</span>
        <span class="text-[9px] text-ink-300">{{ taxonomyLabels[ind.group] }}</span>
      </button>
    </div>
    <div v-if="searchResults.annotationProperties.length" class="mt-1">
      <div class="px-2 py-1 text-[10px] uppercase tracking-wide text-pink-500 font-medium">Annotation Properties ({{ searchResults.annotationProperties.length }})</div>
      <div v-for="ap in searchResults.annotationProperties" :key="ap.compact"
        class="px-2 py-0.5 text-[11px] text-ink-500"
      >
        <span class="w-3 inline-block text-ink-200">·</span>
        {{ ap.compact }}
      </div>
    </div>
    <div v-if="searchResults.total === 0" class="px-2 py-3 text-[11px] text-ink-300 italic">
      No entities match "{{ searchQuery }}"
    </div>
  </template>

  <!-- Normal browse mode -->
  <template v-if="!isSearching">
    <!-- Classes section -->
    <div class="mt-1">
      <button @click="toggleSection('class')"
        class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] uppercase tracking-wide text-ink-400 hover:text-ink-600 hover:bg-ink-50 transition-colors"
      >
        <span class="w-3 text-[10px]">{{ collapsedSections.has('class') ? '▸' : '▾' }}</span>
        <span class="flex-1 text-left">Classes</span>
        <span class="badge text-[9px] bg-blue-50 text-blue-600 px-1 py-0.5">{{ treeRoots.length }}+</span>
      </button>
      <div v-if="!collapsedSections.has('class')" class="mt-0.5 space-y-0">
        <template v-for="root in treeRoots" :key="root.compact">
          <button @click="selectClass(root.compact); toggleExpand(root)"
            class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors"
            :class="activeClassId === root.compact && !activeTaxonomy && !activeShapeId && !activePropertyId ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-600 hover:bg-ink-50'"
          >
            <span v-if="hasChildren(root)" class="text-[10px] text-ink-300 w-3">{{ expandedClasses.has(root.compact) ? '▾' : '▸' }}</span>
            <span v-else class="w-3 text-ink-200">·</span>
            <span class="flex-1 text-left">{{ root.label }}</span>
          </button>
          <div v-if="expandedClasses.has(root.compact) && hasChildren(root)" class="ml-3">
            <template v-for="child in childClasses(root.compact)" :key="child.compact">
              <button @click="selectClass(child.compact); toggleExpand(child)"
                class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
                :class="activeClassId === child.compact ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-500 hover:bg-ink-50'"
              >
                <span v-if="hasChildren(child)" class="text-[10px] text-ink-300 w-3">{{ expandedClasses.has(child.compact) ? '▾' : '▸' }}</span>
                <span v-else class="w-3 text-ink-200">·</span>
                <span class="flex-1 text-left">{{ child.label }}</span>
              </button>
              <div v-if="expandedClasses.has(child.compact) && hasChildren(child)" class="ml-3">
                <button v-for="gc in childClasses(child.compact)" :key="gc.compact"
                  @click="selectClass(gc.compact)"
                  class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
                  :class="activeClassId === gc.compact ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-400 hover:bg-ink-50'"
                >
                  <span class="w-3 text-ink-200">·</span>
                  <span class="flex-1 text-left">{{ gc.label }}</span>
                </button>
              </div>
            </template>
          </div>
        </template>
      </div>
    </div>

    <!-- Object Properties section -->
    <div class="mt-1">
      <button @click="toggleSection('objectProperty')"
        class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] uppercase tracking-wide text-ink-400 hover:text-ink-600 hover:bg-ink-50 transition-colors"
      >
        <span class="w-3 text-[10px]">{{ collapsedSections.has('objectProperty') ? '▸' : '▾' }}</span>
        <span class="flex-1 text-left">Object Properties</span>
        <span class="badge text-[9px] bg-emerald-50 text-emerald-600 px-1 py-0.5">{{ objectProperties.length }}</span>
      </button>
      <div v-if="!collapsedSections.has('objectProperty')" class="mt-0.5 max-h-40 overflow-y-auto">
        <button v-for="p in objectProperties" :key="p.compact"
          @click="selectProperty(p.compact)"
          class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
          :class="activePropertyId === p.compact ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-500 hover:bg-ink-50'"
        >
          <span class="w-3 text-ink-200">·</span>
          <span class="flex-1 text-left truncate">{{ p.label }}</span>
        </button>
      </div>
    </div>

    <!-- Datatype Properties section -->
    <div class="mt-1">
      <button @click="toggleSection('datatypeProperty')"
        class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] uppercase tracking-wide text-ink-400 hover:text-ink-600 hover:bg-ink-50 transition-colors"
      >
        <span class="w-3 text-[10px]">{{ collapsedSections.has('datatypeProperty') ? '▸' : '▾' }}</span>
        <span class="flex-1 text-left">Datatype Properties</span>
        <span class="badge text-[9px] bg-amber-50 text-amber-600 px-1 py-0.5">{{ datatypeProperties.length }}</span>
      </button>
      <div v-if="!collapsedSections.has('datatypeProperty')" class="mt-0.5 max-h-40 overflow-y-auto">
        <button v-for="p in datatypeProperties" :key="p.compact"
          @click="selectProperty(p.compact)"
          class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
          :class="activePropertyId === p.compact ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-500 hover:bg-ink-50'"
        >
          <span class="w-3 text-ink-200">·</span>
          <span class="flex-1 text-left truncate">{{ p.label }}</span>
        </button>
      </div>
    </div>

    <!-- SHACL Shapes section -->
    <div class="mt-1">
      <button @click="toggleSection('shape')"
        class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] uppercase tracking-wide text-ink-400 hover:text-ink-600 hover:bg-ink-50 transition-colors"
      >
        <span class="w-3 text-[10px]">{{ collapsedSections.has('shape') ? '▸' : '▾' }}</span>
        <span class="flex-1 text-left">SHACL Shapes</span>
        <span class="badge text-[9px] bg-purple-50 text-purple-600 px-1 py-0.5">{{ allShapes.length }}</span>
      </button>
      <div v-if="!collapsedSections.has('shape')" class="mt-0.5 max-h-40 overflow-y-auto">
        <button v-for="s in allShapes" :key="s.compact"
          @click="selectShape(s.compact)"
          class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
          :class="activeShapeId === s.compact ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-500 hover:bg-ink-50'"
        >
          <span class="w-3 text-ink-200">·</span>
          <span class="flex-1 text-left truncate">{{ s.label }}</span>
        </button>
      </div>
    </div>

    <!-- Named Individuals section -->
    <div class="mt-1">
      <button @click="toggleSection('namedIndividual')"
        class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] uppercase tracking-wide text-ink-400 hover:text-ink-600 hover:bg-ink-50 transition-colors"
      >
        <span class="w-3 text-[10px]">{{ collapsedSections.has('namedIndividual') ? '▸' : '▾' }}</span>
        <span class="flex-1 text-left">Named Individuals</span>
        <span class="badge text-[9px] bg-rose-50 text-rose-600 px-1 py-0.5">{{ totalIndividuals }}</span>
      </button>
      <div v-if="!collapsedSections.has('namedIndividual')" class="mt-0.5 max-h-64 overflow-y-auto">
        <template v-for="group in groupedIndividuals" :key="group.key">
          <button @click="selectTaxonomy(group.key)"
            class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] uppercase tracking-wide text-ink-300 hover:text-ink-500 transition-colors"
          >
            <span class="w-3 text-ink-200">·</span>
            <span class="flex-1 text-left">{{ group.label }}</span>
            <span class="text-[9px] text-ink-300">{{ group.concepts.length }}</span>
          </button>
        </template>
      </div>
    </div>

    <!-- SKOS Taxonomies section -->
    <div class="mt-1">
      <button @click="toggleSection('taxonomy')"
        class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] uppercase tracking-wide text-ink-400 hover:text-ink-600 hover:bg-ink-50 transition-colors"
      >
        <span class="w-3 text-[10px]">{{ collapsedSections.has('taxonomy') ? '▸' : '▾' }}</span>
        <span class="flex-1 text-left">SKOS Taxonomies</span>
        <span class="badge text-[9px] bg-rose-50 text-rose-600 px-1 py-0.5">{{ taxonomyKeys.length }}</span>
      </button>
      <div v-if="!collapsedSections.has('taxonomy')" class="mt-0.5">
        <button v-for="tk in taxonomyKeys" :key="tk"
          @click="selectTaxonomy(tk)"
          class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
          :class="activeTaxonomy === tk ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-400 hover:bg-ink-50'"
        >
          <span class="w-3 text-ink-200">·</span>
          <span class="flex-1 text-left">{{ taxonomyLabels[tk] }}</span>
        </button>
      </div>
    </div>

    <!-- Annotation Properties section -->
    <div class="mt-1">
      <button @click="toggleSection('annotationProperty')"
        class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] uppercase tracking-wide text-ink-400 hover:text-ink-600 hover:bg-ink-50 transition-colors"
      >
        <span class="w-3 text-[10px]">{{ collapsedSections.has('annotationProperty') ? '▸' : '▾' }}</span>
        <span class="flex-1 text-left">Annotation Properties</span>
        <span class="badge text-[9px] bg-pink-50 text-pink-600 px-1 py-0.5">{{ annotationProperties.length }}</span>
      </button>
      <div v-if="!collapsedSections.has('annotationProperty')" class="mt-0.5">
        <div v-for="ap in annotationProperties" :key="ap.compact"
          class="w-full flex items-center gap-1.5 px-2 py-1 text-[11px] text-ink-500"
        >
          <span class="w-3 text-ink-200">·</span>
          <code class="text-ink-400">{{ ap.compact }}</code>
        </div>
      </div>
    </div>
  </template>
</template>
