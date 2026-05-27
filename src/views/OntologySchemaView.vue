<script setup lang="ts">
import { computed, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { getClass, getAllPropertiesForClass, getAllClasses, getAllShapes, getAllProperties, getShape, getProperty, getShapesForClass } from '../adapters/ontology-schema';
import { ontology, type TaxonomyConcept } from '../adapters/ontology-registry';
import { useVocabularyStore } from '../stores/vocabulary';
import { useOntologyNav, slugToCompact, compactToSlug } from '../composables/use-ontology-nav';
import taxonomyData from '../data/taxonomies.json';

const route = useRoute();
const vocabStore = useVocabularyStore();

const {
  stats,
  ontology: ontologyMeta,
  taxonomyLabels,
  groupedIndividuals,
  totalIndividuals,
  allNavItems,
  treeRoots,
  hasChildren,
  childClasses,
  annotationProperties,
  taxonomyKeyForValuesFrom,
  getShapesForTaxonomy,
} = useOntologyNav();

const activeClassId = computed(() => {
  if (route.name !== 'ontology-class') return null;
  const slug = route.params.classId as string;
  return slugToCompact(slug);
});

const activeTaxonomy = computed(() => {
  if (route.name !== 'ontology-taxonomy') return null;
  return route.params.taxonomyKey as string;
});

const activeShapeId = computed(() => {
  if (route.name !== 'ontology-shape') return null;
  const slug = route.params.shapeId as string;
  return slugToCompact(slug);
});

const activePropertyId = computed(() => {
  if (route.name !== 'ontology-property') return null;
  const slug = route.params.propertyId as string;
  return slugToCompact(slug);
});

const isOverview = computed(() => route.name === 'ontology');

const activeClass = computed(() => activeClassId.value ? getClass(activeClassId.value) : null);
const activeProperties = computed(() => activeClassId.value ? getAllPropertiesForClass(activeClassId.value) : { object: [], datatype: [] });
const activeClassShapes = computed(() => activeClassId.value ? getShapesForClass(activeClassId.value) : []);

const activeShape = computed(() => activeShapeId.value ? getShape(activeShapeId.value) : null);
const activeProperty = computed(() => activePropertyId.value ? getProperty(activePropertyId.value) : null);

function activeTaxonomyData() {
  if (!activeTaxonomy.value) return null;
  const key = activeTaxonomy.value as Parameters<typeof ontology.getAll>[0];
  const all = ontology.getAll(key);
  const top = all.filter(c => !c.broader);
  return { scheme: ontology.getScheme(key), concepts: all, top };
}

watch(() => route.fullPath, () => {
  nextTick(() => {
    const main = document.querySelector('main');
    if (main) main.scrollTo({ top: 0 });
  });
});

const allClasses = getAllClasses();
const allShapes = getAllShapes();
const allPropertiesList = getAllProperties();

const taxonomyMeta = Object.entries(taxonomyData).map(([key, tax]: [string, any]) => ({
  key,
  label: tax.schemeLabel,
  conceptCount: Object.keys(tax.concepts).length,
}));

const totalTaxonomyIndividuals = taxonomyMeta.reduce((sum: number, t: any) => sum + t.conceptCount, 0);

const loadedDatasets = computed(() => {
  const datasets: { id: string; title: string; conceptCount: number; languages: string[] }[] = [];
  for (const [id, adapter] of vocabStore.datasets) {
    const m = vocabStore.manifests.get(id);
    if (m) datasets.push({ id, title: m.title, conceptCount: m.conceptCount, languages: m.languages });
  }
  return datasets;
});

const instanceCounts = computed(() => {
  const counts: Record<string, { datasetId: string; title: string; count: number }[]> = {};
  for (const ds of loadedDatasets.value) {
    const entry = { datasetId: ds.id, title: ds.title, count: ds.conceptCount };
    if (!counts['gloss:Concept']) counts['gloss:Concept'] = [];
    counts['gloss:Concept'].push(entry);

    if (!counts['gloss:LocalizedConcept']) counts['gloss:LocalizedConcept'] = [];
    counts['gloss:LocalizedConcept'].push({ ...entry, count: ds.conceptCount * ds.languages.length });
  }
  return counts;
});
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Overview: header + grids -->
    <template v-if="isOverview">
      <div class="mb-8">
        <h1 class="text-2xl sm:text-3xl font-semibold text-ink-800">Glossarist Ontology</h1>
        <p class="text-sm text-ink-400 mt-1">
          OWL ontology for terminology management (ISO 10241-1, 30042, 12620, 25964/SKOS)
        </p>
        <div class="max-w-2xl mt-3 text-sm text-ink-500 leading-relaxed space-y-2">
          <p>The Glossarist ontology defines the RDF/OWL vocabulary for describing structured terminology data. It models <strong>concepts</strong> with multilingual <strong>localizations</strong> (definitions, notes, examples) and typed <strong>designations</strong> (expressions, abbreviations, symbols) using the SKOS-XL pattern for reified lexical labels.</p>
          <p>It aligns with <strong>SKOS</strong> (concepts and relationships), <strong>SKOS-XL</strong> (designations as labels), <strong>ISO 25964</strong> (hierarchical relationship subtypes — generic, partitive, instantial), <strong>PROV-O</strong> (source provenance), and <strong>Dublin Core Terms</strong> (language, citation). Enumeration values use SKOS ConceptSchemes (10 taxonomies).</p>
        </div>

        <!-- Ontology metadata (TODO 07) -->
        <div v-if="ontologyMeta" class="mt-4 space-y-2">
          <div class="flex flex-wrap items-center gap-2">
            <code class="text-xs text-ink-400 bg-ink-50 px-2 py-1 rounded">{{ ontologyMeta.iri }}</code>
            <span v-if="ontologyMeta.created" class="text-[10px] text-ink-300">Created {{ ontologyMeta.created }}</span>
            <a v-if="ontologyMeta.license" :href="ontologyMeta.license" target="_blank" rel="noopener" class="text-[10px] text-blue-500 hover:text-blue-700">
              CC BY 4.0
            </a>
          </div>
          <div v-if="ontologyMeta.imports.length" class="flex flex-wrap items-center gap-1.5">
            <span class="text-[10px] text-ink-300">Imports:</span>
            <span v-for="imp in ontologyMeta.imports" :key="imp.iri"
              class="text-[10px] bg-ink-50 text-ink-500 px-1.5 py-0.5 rounded">{{ imp.label }}</span>
          </div>
        </div>

        <div class="flex flex-wrap gap-2 mt-4">
          <span class="badge badge-blue text-[10px]">{{ stats.classCount }} classes</span>
          <span class="badge text-[10px] bg-emerald-50 text-emerald-700">{{ stats.objectPropertyCount }} object properties</span>
          <span class="badge text-[10px] bg-amber-50 text-amber-700">{{ stats.datatypePropertyCount }} datatype properties</span>
          <span class="badge text-[10px] bg-purple-50 text-purple-700">{{ stats.shapeCount }} SHACL shapes</span>
          <span class="badge text-[10px] bg-rose-50 text-rose-700">{{ totalTaxonomyIndividuals }} named individuals</span>
          <span class="badge text-[10px] bg-pink-50 text-pink-700">{{ annotationProperties.length }} annotation properties</span>
        </div>
      </div>

      <!-- Class Overview -->
      <h2 class="text-lg font-semibold text-ink-800 mb-4">Class Overview</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <router-link v-for="cls in allClasses" :key="cls.compact"
          :to="`/ontology/class/${compactToSlug(cls.compact)}`"
          class="border border-ink-100/60 rounded-lg p-3 cursor-pointer hover:border-ink-200 hover:bg-ink-50/50 transition-colors block">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-ink-700">{{ cls.label }}</span>
            <code class="text-[10px] text-ink-400 bg-ink-50 px-1.5 py-0.5 rounded">{{ cls.compact }}</code>
          </div>
          <p v-if="cls.comment" class="text-xs text-ink-400 mt-1 line-clamp-2">{{ cls.comment }}</p>
          <div v-if="cls.subClassOf" class="text-[10px] text-ink-300 mt-1">
            subClassOf <code class="text-ink-400">{{ cls.subClassOf }}</code>
          </div>
        </router-link>
      </div>

      <!-- SHACL Shapes -->
      <h2 class="text-lg font-semibold text-ink-800 mt-8 mb-4">SHACL Shapes</h2>
      <div class="grid gap-3 sm:grid-cols-2">
        <router-link v-for="shape in allShapes" :key="shape.compact"
          :to="`/ontology/shape/${compactToSlug(shape.compact)}`"
          class="border border-ink-100/60 rounded-lg p-3 cursor-pointer hover:border-ink-200 hover:bg-ink-50/50 transition-colors block">
          <div class="flex items-center gap-2">
            <span class="text-sm font-medium text-ink-700">{{ shape.label }}</span>
            <code class="text-[10px] text-ink-400 bg-ink-50 px-1.5 py-0.5 rounded">{{ shape.compact }}</code>
          </div>
          <div class="text-[10px] text-ink-300 mt-1">
            targetClass <code class="text-ink-400">{{ shape.targetClass }}</code>
            · {{ shape.constraints.length }} constraints
          </div>
        </router-link>
      </div>

      <!-- Named Individuals (TODO 06) -->
      <h2 class="text-lg font-semibold text-ink-800 mt-8 mb-4">Named Individuals</h2>
      <p class="text-sm text-ink-400 mb-4">
        {{ totalTaxonomyIndividuals }} SKOS Concepts across {{ groupedIndividuals.length }} ConceptSchemes serve as controlled vocabulary instances.
      </p>
      <div class="space-y-4">
        <div v-for="group in groupedIndividuals" :key="group.key" class="border border-ink-100/60 rounded-lg p-3">
          <div class="flex items-center gap-2 mb-2">
            <router-link :to="`/ontology/taxonomy/${group.key}`" class="text-sm font-medium text-ink-700 hover:text-blue-600 transition-colors">
              {{ group.label }}
            </router-link>
            <span class="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded">{{ group.concepts.length }}</span>
          </div>
          <div class="flex flex-wrap gap-1.5">
            <router-link v-for="c in group.concepts" :key="c.id"
              :to="`/ontology/taxonomy/${group.key}`"
              class="text-[10px] bg-ink-50 text-ink-600 px-2 py-1 rounded hover:bg-ink-100 transition-colors">
              {{ c.prefLabel }}
            </router-link>
          </div>
        </div>
      </div>

      <!-- Annotation Properties (TODO 09) -->
      <h2 class="text-lg font-semibold text-ink-800 mt-8 mb-4">Annotation Properties</h2>
      <p class="text-sm text-ink-400 mb-4">
        Standard annotation properties from RDFS, Dublin Core Terms, and VANN used for ontology metadata. These do not participate in reasoning.
      </p>
      <div class="grid gap-2 sm:grid-cols-2">
        <div v-for="ap in annotationProperties" :key="ap.compact"
          class="border border-ink-100/60 rounded-lg px-3 py-2 flex items-center gap-2">
          <code class="text-xs text-pink-600 bg-pink-50 px-1.5 py-0.5 rounded">{{ ap.compact }}</code>
          <span class="text-xs text-ink-500">{{ ap.label }}</span>
        </div>
      </div>

      <!-- Concept Data Model (TODO 08) -->
      <h2 class="text-lg font-semibold text-ink-800 mt-8 mb-4">Concept Data Model</h2>
      <p class="text-sm text-ink-400 mb-4">
        The three-layer architecture maps ontology schema (TBox) to controlled vocabularies (RBox) to instance data (ABox).
      </p>
      <div class="bg-ink-50/50 rounded-lg p-4 text-sm font-mono text-ink-600 leading-relaxed space-y-1 border border-ink-100/60">
        <div class="text-ink-400 text-xs mb-2">TBox — Ontology Classes (schema layer)</div>
        <div class="ml-2">
          <span class="text-blue-600">gloss:ConceptCollection</span> (skos:Collection)<br/>
          <span class="ml-4"><span class="text-blue-600">gloss:Concept</span> (skos:Concept)</span><br/>
          <span class="ml-8"><span class="text-emerald-600">gloss:hasLocalization</span> → <span class="text-blue-600">gloss:LocalizedConcept</span></span><br/>
          <span class="ml-12"><span class="text-emerald-600">gloss:hasDesignation</span> → <span class="text-blue-600">gloss:Designation</span> (skosxl:Label)</span><br/>
          <span class="ml-12"><span class="text-emerald-600">gloss:hasDefinition</span> → <span class="text-blue-600">gloss:DetailedDefinition</span></span><br/>
          <span class="ml-12"><span class="text-emerald-600">gloss:hasSource</span> → <span class="text-blue-600">gloss:ConceptSource</span></span><br/>
          <span class="ml-8"><span class="text-emerald-600">gloss:hasRelatedConcept</span> → <span class="text-blue-600">gloss:RelatedConcept</span></span><br/>
          <span class="ml-8"><span class="text-emerald-600">gloss:hasDate</span> → <span class="text-blue-600">gloss:ConceptDate</span></span><br/>
          <span class="ml-8"><span class="text-emerald-600">gloss:hasStatus</span> → <span class="text-rose-600">gloss:status/*</span></span>
        </div>
        <div class="text-ink-400 text-xs mt-3 mb-2">RBox — Controlled Vocabularies ({{ totalTaxonomyIndividuals }} named individuals)</div>
        <div class="ml-2 text-ink-500">
          <span class="text-rose-600">gloss:status/*</span> — concept lifecycle<br/>
          <span class="text-rose-600">gloss:normativeStatus/*</span> — designation normativity<br/>
          <span class="text-rose-600">gloss:relationshipType/*</span> — concept relations<br/>
          <span class="text-rose-600">gloss:designationType/*</span> — designation kinds<br/>
          <span class="text-rose-600">...</span> and {{ groupedIndividuals.length - 4 }} more SKOS ConceptSchemes
        </div>
        <div class="text-ink-400 text-xs mt-3 mb-2">ABox — Instance Data</div>
        <div v-if="loadedDatasets.length" class="ml-2 space-y-1">
          <div v-for="ds in loadedDatasets" :key="ds.id" class="flex items-center gap-2 text-ink-500">
            <router-link :to="`/dataset/${ds.id}`" class="text-blue-600 hover:text-blue-700">{{ ds.title }}</router-link>
            <span class="text-[10px] text-ink-300">{{ ds.conceptCount.toLocaleString() }} concepts · {{ ds.languages.length }} languages</span>
          </div>
        </div>
        <div v-else class="ml-2 text-ink-400 italic text-xs">No datasets loaded.</div>
      </div>
    </template>

    <!-- Class detail -->
    <template v-if="!activeTaxonomy && !activeShapeId && !activePropertyId && activeClass">
      <nav class="flex items-center gap-1.5 text-sm text-ink-400 mb-4">
        <router-link to="/ontology" class="hover:text-ink-700 transition-colors">Overview</router-link>
        <template v-if="activeClass.ancestors.length">
          <span class="text-ink-200">/</span>
          <template v-for="(anc, i) in activeClass.ancestors" :key="anc">
            <router-link :to="`/ontology/class/${compactToSlug(anc)}`" class="hover:text-ink-700 transition-colors">{{ getClass(anc)?.label || anc }}</router-link>
            <span class="text-ink-200">/</span>
          </template>
        </template>
        <span class="text-ink-700">{{ activeClass.label }}</span>
      </nav>

      <div class="pb-4 border-b border-ink-100/60 mb-4">
        <h1 class="text-xl font-semibold text-ink-800">{{ activeClass.label }}</h1>
        <code class="block text-xs text-ink-400 mt-1">{{ activeClass.iri }}</code>
        <div v-if="activeClass.subClassOf" class="flex items-center gap-2 mt-2 text-sm">
          <span class="text-ink-400 text-xs">subClassOf</span>
          <router-link :to="`/ontology/class/${compactToSlug(activeClass.subClassOf)}`" class="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors">{{ activeClass.subClassOf }}</router-link>
          <template v-if="activeClass.ancestors.length > 1">
            <span class="text-ink-300 text-xs">→</span>
            <span class="text-xs text-ink-500">{{ activeClass.ancestors.slice(1).map(a => getClass(a)?.label || a).join(' → ') }}</span>
          </template>
        </div>
        <p v-if="activeClass.comment" class="text-sm text-ink-500 mt-3 leading-relaxed">{{ activeClass.comment }}</p>

        <!-- Instance counts for this class -->
        <div v-if="instanceCounts[activeClassId!]" class="mt-3 pt-3 border-t border-ink-100/40">
          <h3 class="text-[10px] uppercase tracking-wide text-ink-300 font-medium mb-1.5">Instance Data</h3>
          <div class="space-y-0.5">
            <div v-for="entry in instanceCounts[activeClassId!]" :key="entry.datasetId" class="text-xs text-ink-500">
              <router-link :to="`/dataset/${entry.datasetId}`" class="text-blue-600 hover:text-blue-700">{{ entry.title }}</router-link>
              — {{ entry.count.toLocaleString() }} instances
            </div>
          </div>
        </div>
      </div>

      <!-- SHACL Shape constraints for this class -->
      <div v-if="activeClassShapes.length" class="mb-6">
        <h3 class="text-xs uppercase tracking-wide text-ink-300 font-medium mb-2">
          SHACL Shape{{ activeClassShapes.length > 1 ? 's' : '' }}
        </h3>
        <div v-for="shape in activeClassShapes" :key="shape.compact" class="border border-purple-100 bg-purple-50/30 rounded-lg p-3 mb-3">
          <div class="flex items-center gap-2 mb-2">
            <span class="text-xs font-medium text-purple-700">{{ shape.label }}</span>
            <router-link :to="`/ontology/shape/${compactToSlug(shape.compact)}`" class="text-[10px] text-purple-500 hover:text-purple-700">View full shape →</router-link>
          </div>
          <div class="grid gap-1 text-xs">
            <div v-for="(c, ci) in shape.constraints" :key="c.path ?? ci" class="flex items-start gap-2">
              <code class="text-purple-600 bg-purple-50 px-1 py-0.5 rounded text-[10px] whitespace-nowrap">{{ c.path }}</code>
              <span class="text-ink-400">
                <span v-if="c.datatype">{{ c.datatype }}</span>
                <span v-if="c.class" class="text-blue-600">{{ c.class }}</span>
                <span v-if="c.minCount !== null || c.maxCount !== null" class="text-ink-300 ml-1">
                  [{{ c.minCount ?? 0 }}..{{ c.maxCount ?? '*' }}]
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

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
                <router-link :to="`/ontology/property/${compactToSlug(p.compact)}`" class="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors">{{ p.compact }}</router-link>
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
                <router-link :to="`/ontology/property/${compactToSlug(p.compact)}`" class="text-xs text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded hover:bg-blue-100 transition-colors">{{ p.compact }}</router-link>
              </td>
              <td class="py-2 px-3 align-top">
                <code class="text-xs text-ink-500">{{ p.range || '—' }}</code>
              </td>
              <td class="py-2 px-3 text-xs text-ink-400 align-top">{{ p.comment || '' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="!activeProperties.object.length && !activeProperties.datatype.length && !activeClassShapes.length" class="text-sm text-ink-300 italic">
        No properties or shapes defined directly on this class.
      </div>
    </template>

    <!-- Shape detail -->
    <template v-if="activeShape">
      <nav class="flex items-center gap-1.5 text-sm text-ink-400 mb-4">
        <router-link to="/ontology" class="hover:text-ink-700 transition-colors">Overview</router-link>
        <span class="text-ink-200">/</span>
        <span class="text-ink-700">{{ activeShape.label }} Shape</span>
      </nav>

      <div class="pb-4 border-b border-ink-100/60 mb-4">
        <h1 class="text-xl font-semibold text-ink-800">{{ activeShape.label }} Shape</h1>
        <code class="block text-xs text-ink-400 mt-1">{{ activeShape.iri }}</code>
        <div class="flex items-center gap-3 mt-2">
          <div v-if="activeShape.targetClass" class="flex items-center gap-2 text-sm">
            <span class="text-ink-400 text-xs">targetClass</span>
            <router-link :to="`/ontology/class/${compactToSlug(activeShape.targetClass)}`" class="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors">{{ activeShape.targetClass }}</router-link>
          </div>
          <div v-if="activeShape.shapeClass" class="flex items-center gap-2 text-sm">
            <span class="text-ink-400 text-xs">class</span>
            <code class="text-xs text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ activeShape.shapeClass }}</code>
          </div>
        </div>
        <p v-if="activeShape.comment" class="text-sm text-ink-500 mt-3 leading-relaxed">{{ activeShape.comment }}</p>
      </div>

      <h3 class="text-xs uppercase tracking-wide text-ink-300 font-medium mb-2">
        Constraints ({{ activeShape.constraints.length }})
      </h3>
      <table class="w-full text-sm border-collapse">
        <thead>
          <tr class="border-b border-ink-100/60">
            <th class="text-left text-[11px] font-medium text-ink-400 uppercase tracking-wide py-2 px-3">Path</th>
            <th class="text-left text-[11px] font-medium text-ink-400 uppercase tracking-wide py-2 px-3">Type / Class</th>
            <th class="text-left text-[11px] font-medium text-ink-400 uppercase tracking-wide py-2 px-3">Cardinality</th>
            <th class="text-left text-[11px] font-medium text-ink-400 uppercase tracking-wide py-2 px-3">Values</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(c, ci) in activeShape.constraints" :key="c.path ?? ci" class="border-b border-ink-100/30">
            <td class="py-2 px-3 align-top">
              <code class="text-xs text-purple-600 bg-purple-50 px-1.5 py-0.5 rounded">{{ c.path }}</code>
            </td>
            <td class="py-2 px-3 align-top">
              <span v-if="c.datatype"><code class="text-xs text-ink-500">{{ c.datatype }}</code></span>
              <span v-if="c.class"><code class="text-xs text-blue-600">{{ c.class }}</code></span>
              <span v-if="!c.datatype && !c.class" class="text-xs text-ink-300">—</span>
            </td>
            <td class="py-2 px-3 align-top text-xs text-ink-500">
              <span v-if="c.minCount !== null || c.maxCount !== null">
                {{ c.minCount ?? 0 }}..{{ c.maxCount ?? '*' }}
              </span>
              <span v-else class="text-ink-300">*</span>
            </td>
            <td class="py-2 px-3 align-top">
              <span v-if="c.valuesFrom">
                <router-link v-if="taxonomyKeyForValuesFrom(c.valuesFrom)"
                  :to="`/ontology/taxonomy/${taxonomyKeyForValuesFrom(c.valuesFrom)}`"
                  class="text-[10px] text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded hover:bg-rose-100 transition-colors">{{ c.valuesFrom }}</router-link>
                <span v-else class="text-[10px] text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ c.valuesFrom }}</span>
              </span>
              <span v-if="c.in" class="text-[10px] text-ink-500">{{ c.in.join(' | ') }}</span>
              <span v-if="!c.valuesFrom && !c.in" class="text-xs text-ink-300">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </template>

    <!-- Property detail -->
    <template v-if="activeProperty">
      <nav class="flex items-center gap-1.5 text-sm text-ink-400 mb-4">
        <router-link to="/ontology" class="hover:text-ink-700 transition-colors">Overview</router-link>
        <span class="text-ink-200">/</span>
        <span class="text-ink-700">{{ activeProperty.label }}</span>
      </nav>

      <div class="pb-4 border-b border-ink-100/60 mb-4">
        <div class="flex items-center gap-3">
          <h1 class="text-xl font-semibold text-ink-800">{{ activeProperty.label }}</h1>
          <span class="badge text-[10px]" :class="activeProperty.type === 'object' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'">
            {{ activeProperty.type === 'object' ? 'Object Property' : 'Datatype Property' }}
          </span>
        </div>
        <code class="block text-xs text-ink-400 mt-1">{{ activeProperty.iri }}</code>
      </div>

      <div class="space-y-3">
        <div v-if="activeProperty.comment" class="text-sm text-ink-500 leading-relaxed">{{ activeProperty.comment }}</div>

        <div v-if="activeProperty.domain || activeProperty.domainUnion" class="flex items-center gap-2 text-sm">
          <span class="text-ink-400 text-xs">Domain:</span>
          <template v-if="activeProperty.domainUnion">
            <router-link v-for="d in activeProperty.domainUnion" :key="d" :to="`/ontology/class/${compactToSlug(d)}`" class="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors">{{ d }}</router-link>
          </template>
          <router-link v-else-if="activeProperty.domain" :to="`/ontology/class/${compactToSlug(activeProperty.domain)}`" class="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors">{{ activeProperty.domain }}</router-link>
        </div>

        <div v-if="activeProperty.range || activeProperty.rangeUnion" class="flex items-center gap-2 text-sm">
          <span class="text-ink-400 text-xs">Range:</span>
          <template v-if="activeProperty.rangeUnion">
            <code v-for="r in activeProperty.rangeUnion" :key="r" class="text-xs text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ r }}</code>
          </template>
          <code v-else-if="activeProperty.range" class="text-xs text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ activeProperty.range }}</code>
        </div>

        <div v-if="activeProperty.inverseOf" class="flex items-center gap-2 text-sm">
          <span class="text-ink-400 text-xs">Inverse of:</span>
          <router-link :to="`/ontology/property/${compactToSlug(activeProperty.inverseOf)}`" class="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100 transition-colors">{{ activeProperty.inverseOf }}</router-link>
        </div>
      </div>
    </template>

    <!-- Taxonomy detail -->
    <template v-if="activeTaxonomy && activeTaxonomyData()">
      <nav class="flex items-center gap-1.5 text-sm text-ink-400 mb-4">
        <router-link to="/ontology" class="hover:text-ink-700 transition-colors">Overview</router-link>
        <span class="text-ink-200">/</span>
        <span class="text-ink-700">{{ taxonomyLabels[activeTaxonomy] }}</span>
      </nav>

      <div class="pb-4 border-b border-ink-100/60 mb-4">
        <h1 class="text-xl font-semibold text-ink-800">{{ taxonomyLabels[activeTaxonomy] }}</h1>
        <code class="block text-xs text-ink-400 mt-1">{{ activeTaxonomyData()!.scheme }}</code>
      </div>

      <!-- Referencing shapes -->
      <div v-if="getShapesForTaxonomy(activeTaxonomy).length" class="mb-4">
        <h3 class="text-xs uppercase tracking-wide text-ink-300 font-medium mb-2">
          Referencing SHACL Shapes
        </h3>
        <div class="flex flex-wrap gap-2">
          <router-link v-for="shape in getShapesForTaxonomy(activeTaxonomy)" :key="shape.compact"
            :to="`/ontology/shape/${compactToSlug(shape.compact)}`"
            class="text-xs text-purple-600 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100 transition-colors">
            {{ shape.label }}
          </router-link>
        </div>
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
</template>
