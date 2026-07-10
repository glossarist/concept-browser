<template>
  <div class="concept-island">
    <!-- View mode toggle -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <button @click="viewMode = 'detail'" :class="['px-3 py-1 text-sm rounded transition-colors', viewMode === 'detail' ? 'bg-blue-500 text-white' : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800']">Detail</button>
        <button @click="viewMode = 'sphere'" :class="['px-3 py-1 text-sm rounded transition-colors', viewMode === 'sphere' ? 'bg-blue-500 text-white' : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800']">Sphere</button>
      </div>
      <button @click="toggleRdf()" class="px-3 py-1 text-sm rounded text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800 transition-colors">RDF Source {{ rdfOpen ? '▾' : '▸' }}</button>
    </div>

    <!-- Detail view using REAL SPA components -->
    <div v-if="viewMode === 'detail'" class="space-y-6">
      <!-- Designations from real DesignationList -->
      <DesignationList v-if="hasDesignations" :designations="parsedDesignations" :language="activeLang" />

      <!-- Definition -->
      <section v-if="concept.definition?.eng">
        <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-2">Definition</h2>
        <p class="text-ink-700 dark:text-ink-200 leading-relaxed" dir="auto">{{ concept.definition.eng }}</p>
      </section>

      <!-- Non-verbal representations from real NonVerbalRepDisplay -->
      <NonVerbalRepDisplay v-if="concept.nonVerbalRep?.length" :reps="concept.nonVerbalRep" :register-id="registerId" />

      <!-- Format downloads from real FormatDownloads -->
      <FormatDownloads v-if="concept.formats?.length" :formats="concept.formats" :register-id="registerId" />

      <!-- Groups / Sections -->
      <section v-if="concept.groups?.length">
        <h2 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-2">Sections</h2>
        <div class="flex flex-wrap gap-2">
          <span v-for="g in concept.groups" :key="g" class="text-xs px-2 py-1 rounded bg-ink-100 dark:bg-ink-800 text-ink-600 dark:text-ink-300">{{ g }}</span>
        </div>
      </section>
    </div>

    <!-- Sphere view placeholder -->
    <div v-else class="border border-ink-200 dark:border-ink-700 rounded-lg p-8 text-center">
      <p class="text-ink-400">3D sphere visualization loads on interaction</p>
    </div>

    <!-- RDF panel — lazy-loaded client-side only (glossarist/rdf is Node-only) -->
    <component v-if="rdfOpen && RdfComponent" :is="RdfComponent" :concept="parsedConcept" :register-id="registerId" :concept-uri-value="conceptUri" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, shallowRef, onMounted } from 'vue';
import DesignationList from '../components/DesignationList.vue';
import NonVerbalRepDisplay from '../components/NonVerbalRepDisplay.vue';
import FormatDownloads from '../components/FormatDownloads.vue';

const props = defineProps<{
  concept: any;
  registerId: string;
  conceptUri: string;
}>();

const viewMode = ref<'detail' | 'sphere'>('detail');
const rdfOpen = ref(false);
const activeLang = ref('eng');
const RdfComponent = shallowRef<any>(null);

// Lazy-load ConceptRdfView only when RDF panel is opened
// (it imports glossarist/rdf which has Node-only deps — can't SSR)
async function toggleRdf() {
  rdfOpen.value = !rdfOpen.value;
  if (rdfOpen.value && !RdfComponent.value) {
    try {
      const mod = await import('../components/ConceptRdfView.vue');
      RdfComponent.value = mod.default;
    } catch (e) {
      console.error('Failed to load RDF view:', e);
    }
  }
}

const hasDesignations = computed(() => {
  return Object.keys(props.concept?.designations || {}).length > 0;
});

const parsedDesignations = computed(() => {
  // Convert the content collection format to what DesignationList expects
  const out: any[] = [];
  for (const [lang, text] of Object.entries(props.concept?.designations || {})) {
    out.push({ designation: text, type: 'expression', normative_status: 'preferred', language_code: lang });
  }
  return out;
});

const parsedConcept = computed(() => {
  // Create a minimal Concept-like object for ConceptRdfView
  return {
    id: props.concept?.conceptId,
    uri: props.conceptUri,
    status: props.concept?.status,
    localizations: {},
    ...props.concept,
  };
});
</script>
