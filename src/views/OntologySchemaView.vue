<script setup lang="ts">
import { computed } from 'vue';
import { getClass, getAllPropertiesForClass, getStats } from '../adapters/ontology-schema';
import { ontology, type TaxonomyConcept } from '../adapters/ontology-registry';
import { useOntologyNav } from '../composables/use-ontology-nav';

const stats = getStats();

const {
  activeClassId,
  activeTaxonomy,
  taxonomyLabels,
  allNavItems,
} = useOntologyNav();

const activeClass = computed(() => getClass(activeClassId.value));
const activeProperties = computed(() => getAllPropertiesForClass(activeClassId.value));

function activeTaxonomyData() {
  if (!activeTaxonomy.value) return null;
  const key = activeTaxonomy.value as Parameters<typeof ontology.getAll>[0];
  const all = ontology.getAll(key);
  const top = all.filter(c => !c.broader);
  return { scheme: ontology.getScheme(key), concepts: all, top };
}
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
        <span class="badge text-[10px] bg-purple-50 text-purple-700">10 SKOS taxonomies</span>
      </div>
      <code class="block text-xs text-ink-400 mt-2">https://www.glossarist.org/ontologies/glossarist</code>
    </div>

    <!-- Sticky mobile chips (for small screens where sidebar is hidden) -->
    <div class="lg:hidden sticky top-14 z-10 bg-surface -mx-4 px-4 py-2 border-b border-ink-100/60 mb-4">
      <div class="flex gap-2 overflow-x-auto scrollbar-none">
        <button v-for="item in allNavItems" :key="item.id"
          @click="activeClassId = item.id; activeTaxonomy = null"
          class="flex-shrink-0 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[44px] flex items-center gap-1.5"
          :class="activeClassId === item.id && !activeTaxonomy
            ? 'bg-ink-800 text-white'
            : 'bg-surface-raised border border-ink-100 text-ink-600 hover:bg-ink-50'"
        >
          <span v-if="item.depth > 0" class="text-ink-300">{{ '&nbsp;'.repeat(item.depth * 2) }}</span>
          {{ item.label }}
        </button>
        <button @click="activeTaxonomy = activeTaxonomy ? null : 'conceptStatus'"
          class="flex-shrink-0 px-3 py-2.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors min-h-[44px] flex items-center gap-1.5"
          :class="activeTaxonomy
            ? 'bg-ink-800 text-white'
            : 'bg-surface-raised border border-ink-100 text-ink-600 hover:bg-ink-50'"
        >Taxonomies</button>
      </div>
    </div>

    <!-- Detail panel -->
    <div>
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
</template>
