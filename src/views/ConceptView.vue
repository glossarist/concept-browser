<script setup lang="ts">
import { computed, watch, ref } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import ConceptDetail from '../components/ConceptDetail.vue';

const props = defineProps<{
  registerId: string;
  conceptId: string;
}>();

const store = useVocabularyStore();
const conceptLoading = ref(false);
const localError = ref<string | null>(null);

async function loadConcept(regId: string, cId: string) {
  conceptLoading.value = true;
  localError.value = null;
  store.error = null;
  try {
    // Ensure dataset is loaded (index + chunks) before fetching concept
    const adapter = store.datasets.get(regId);
    if (!adapter?.index) {
      await store.loadDataset(regId);
    }
    await store.viewConcept(regId, cId);
  } catch (e: any) {
    localError.value = e.message || 'Unknown error';
  } finally {
    conceptLoading.value = false;
  }
}

watch(
  () => [props.registerId, props.conceptId],
  async ([regId, cId]) => {
    await loadConcept(regId as string, cId as string);
    loadAdjacent();
  },
  { immediate: true }
);

const concept = computed(() => store.currentConcept);
const manifest = computed(() => store.currentManifest);
const edges = computed(() => store.conceptEdges);
const adjacent = ref({ prev: null as string | null, next: null as string | null });

async function loadAdjacent() {
  const adapter = store.datasets.get(props.registerId);
  if (!adapter?.index) return;
  const idx = adapter.getConceptPosition(props.conceptId);
  if (idx >= 0) {
    await adapter.ensureChunksForRange(Math.max(0, idx - 1), 3);
  }
  adjacent.value = adapter.getAdjacentConcepts(props.conceptId);
}

watch(() => props.conceptId, () => { loadAdjacent(); });
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8 py-8">
    <div v-if="conceptLoading" class="max-w-5xl mx-auto py-8 space-y-5">
      <!-- Breadcrumb skeleton -->
      <div class="flex items-center gap-1.5">
        <div class="skeleton h-3 w-24"></div>
        <div class="skeleton h-3 w-4"></div>
        <div class="skeleton h-3 w-16"></div>
      </div>
      <!-- Title skeleton -->
      <div class="skeleton h-10 w-72"></div>
      <!-- Badge skeleton -->
      <div class="flex gap-2">
        <div class="skeleton h-5 w-20"></div>
        <div class="skeleton h-5 w-16"></div>
        <div class="skeleton h-5 w-28"></div>
      </div>
      <!-- Language section skeleton -->
      <div class="border border-ink-100/80 rounded-lg p-4 space-y-3">
        <div class="flex items-center gap-2">
          <div class="skeleton h-4 w-4"></div>
          <div class="skeleton h-5 w-40"></div>
          <div class="skeleton h-3 w-12"></div>
        </div>
        <div class="skeleton h-20 w-full"></div>
        <div class="skeleton h-4 w-3/4"></div>
      </div>
    </div>
    <div v-else-if="localError" class="max-w-xl mx-auto text-center py-20">
      <div class="card p-8 border-red-200 bg-red-50/50">
        <p class="text-red-700 font-medium mb-1">Failed to load concept</p>
        <p class="text-sm text-red-600/80 mb-4">{{ localError }}</p>
        <div class="flex gap-2 justify-center">
          <button @click="loadConcept(registerId, conceptId)" class="btn-primary">Retry</button>
          <router-link :to="{ name: 'dataset', params: { registerId } }" class="btn-secondary">
            Back to dataset
          </router-link>
        </div>
      </div>
    </div>
    <div v-else-if="!concept" class="max-w-xl mx-auto text-center py-20">
      <div class="card p-8">
        <div class="text-ink-200 text-5xl mb-3 font-serif">?</div>
        <h3 class="text-lg font-medium text-ink-700 mb-2">Concept not found</h3>
        <p class="text-sm text-ink-400 mb-4">The concept "{{ conceptId }}" does not exist in this dataset.</p>
        <router-link :to="{ name: 'dataset', params: { registerId } }" class="btn-primary">
          Back to dataset
        </router-link>
      </div>
    </div>
    <ConceptDetail
      v-else-if="concept && manifest"
      :concept="concept"
      :manifest="manifest"
      :edges="edges"
      :adjacent="adjacent"
      :register-id="registerId"
    />
  </div>
</template>
