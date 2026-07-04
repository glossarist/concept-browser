<script setup lang="ts">
import { computed, watch, ref, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { useVocabularyStore } from '../stores/vocabulary';
import { conceptUri } from '../adapters/model-bridge';
import ConceptDetail from '../components/ConceptDetail.vue';
import RelationSphere from '../components/RelationSphere.vue';
import ShortcutsModal from '../components/ShortcutsModal.vue';
import { useI18n } from '../i18n';

const { t } = useI18n();

const props = defineProps<{
  registerId: string;
  conceptId: string;
}>();

const store = useVocabularyStore();
const router = useRouter();
const conceptLoading = ref(false);
const localError = ref<string | null>(null);
const showShortcuts = ref(false);

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
const viewMode = ref<'detail' | 'sphere'>('detail');

/* When the user clicks a card in the sphere, we store the navigation
   payload here. The concept loads via store.viewConcept (without
   router.push). When the user switches to Detail, we commit the URL. */
const sphereFocusPayload = ref<{ registerId: string; conceptId: string } | null>(null);
const permalinkCopied = ref(false);

async function copyPermalink() {
  try {
    await navigator.clipboard.writeText(window.location.href);
    permalinkCopied.value = true;
    setTimeout(() => { permalinkCopied.value = false; }, 1800);
  } catch {
    /* Clipboard API not available — fall back to URL prompt */
    window.prompt('Copy this URL:', window.location.href);
  }
}

async function loadAdjacent() {
  const adapter = store.datasets.get(props.registerId);
  if (!adapter?.index) return;
  const idx = adapter.getConceptPosition(props.conceptId);
  if (idx >= 0) {
    await adapter.ensureChunksForRange(Math.max(0, idx - 1), 3);
  }
  adjacent.value = adapter.getAdjacentConcepts(props.conceptId);
}

function goAdjacent(id: string) {
  router.push({ name: 'concept', params: { registerId: props.registerId, conceptId: id } });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function onSphereNavigate(payload: { registerId: string; conceptId: string }) {
  if (!payload.registerId || !payload.conceptId) return;
  /* DON'T router.push — that sets conceptLoading=true and unmounts the
     sphere. Instead, load the concept directly via the store. This
     updates store.currentConcept + store.conceptEdges, which flow as
     props to RelationSphere without any loading flash. The sphere's
     watch on props.concept fires → rebuilds the graph → animates. */
  sphereFocusPayload.value = { registerId: payload.registerId, conceptId: payload.conceptId };
  (async () => {
    try {
      const adapter = store.datasets.get(payload.registerId);
      if (!adapter?.index) {
        await store.loadDataset(payload.registerId);
      }
      await store.viewConcept(payload.registerId, payload.conceptId);
      loadAdjacent();
    } catch (e) {
      console.warn('Sphere navigation failed:', e);
    }
  })();
}

function switchToSphere() {
  viewMode.value = 'sphere';
  sphereFocusPayload.value = null;
}

function switchToDetail() {
  viewMode.value = 'detail';
  /* Commit the URL if the sphere navigated to a different concept.
     This triggers loadConcept → the Detail view shows the right concept. */
  if (sphereFocusPayload.value) {
    const { registerId, conceptId } = sphereFocusPayload.value;
    if (registerId !== props.registerId || conceptId !== props.conceptId) {
      router.push({ name: 'concept', params: { registerId, conceptId } });
    }
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

  if (e.key === '?') {
    e.preventDefault();
    showShortcuts.value = !showShortcuts.value;
    return;
  }
  if (e.key === 'Escape' && showShortcuts.value) {
    showShortcuts.value = false;
    return;
  }
  /* View mode toggle: 's' for sphere, 'd' for detail */
  if (e.key === 's' && concept.value) {
    e.preventDefault();
    switchToSphere();
    return;
  }
  if (e.key === 'd') {
    e.preventDefault();
    switchToDetail();
    return;
  }
  if (e.key === 'j' && adjacent.value.prev) {
    e.preventDefault();
    goAdjacent(adjacent.value.prev);
  } else if (e.key === 'k' && adjacent.value.next) {
    e.preventDefault();
    goAdjacent(adjacent.value.next);
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown));
onUnmounted(() => window.removeEventListener('keydown', onKeydown));
</script>

<template>
  <div :class="['concept-view', { 'sphere-mode': viewMode === 'sphere' }]">
    <!-- View mode toolbar — slim sub-header with segmented control + permalink.
         Sits ABOVE the content (not floating, doesn't block anything). -->
    <div
      v-if="!conceptLoading && !localError && concept"
      class="flex-shrink-0 w-full max-w-7xl mx-auto mb-4 flex items-center justify-between gap-4 pb-3 border-b border-ink-100 dark:border-ink-700"
    >
      <nav aria-label="View mode" class="inline-flex gap-1 p-1 rounded-lg bg-surface-alt dark:bg-ink-800" role="tablist">
        <button
          role="tab"
          :aria-selected="viewMode === 'detail'"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md cursor-pointer transition-all border-none font-inherit"
          :class="viewMode === 'detail'
            ? 'bg-surface-raised dark:bg-ink-600 text-ink-800 dark:text-ink-50 shadow-sm'
            : 'bg-transparent text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'"
          @click="switchToDetail"
          title="Detail view (d)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M4 6h16M4 12h16M4 18h10" stroke-linecap="round"/>
          </svg>
          <span>{{ t('concept.detailView') }}</span>
          <kbd class="ml-1 px-1 py-0.5 font-mono text-[9px] font-semibold rounded bg-ink-100 dark:bg-ink-700 text-ink-500 dark:text-ink-400 tracking-wide">d</kbd>
        </button>
        <button
          role="tab"
          :aria-selected="viewMode === 'sphere'"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-md cursor-pointer transition-all border-none font-inherit"
          :class="viewMode === 'sphere'
            ? 'bg-surface-raised dark:bg-ink-600 text-ink-800 dark:text-ink-50 shadow-sm'
            : 'bg-transparent text-ink-500 dark:text-ink-400 hover:text-ink-700 dark:hover:text-ink-200'"
          @click="switchToSphere"
          title="Relation sphere view (s)"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="9"/>
            <ellipse cx="12" cy="12" rx="9" ry="3.5"/>
            <ellipse cx="12" cy="12" rx="3.5" ry="9"/>
          </svg>
          <span>{{ t('concept.relationSphere') }}</span>
          <kbd class="ml-1 px-1 py-0.5 font-mono text-[9px] font-semibold rounded bg-ink-100 dark:bg-ink-700 text-ink-500 dark:text-ink-400 tracking-wide">s</kbd>
        </button>
      </nav>

      <div class="flex items-center gap-2.5">
        <button
          class="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-ink-500 dark:text-ink-400 bg-transparent border border-ink-100 dark:border-ink-700 rounded-md cursor-pointer transition-all font-inherit hover:text-ink-800 dark:hover:text-ink-100 hover:bg-surface-raised dark:hover:bg-ink-700 hover:border-ink-200 dark:hover:border-ink-600"
          title="Copy permalink to this concept"
          @click="copyPermalink"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101"/>
            <path stroke-linecap="round" stroke-linejoin="round" d="M10.172 13.828a4 4 0 005.656 0l4-4a4 4 0 10-5.656-5.656l-1.1 1.1"/>
          </svg>
          <span>{{ t('concept.permalink') }}</span>
        </button>
        <Transition name="fade">
          <span v-if="permalinkCopied" class="text-xs font-semibold text-green-600 dark:text-green-400">{{ t('concept.copied') }}</span>
        </Transition>
      </div>
    </div>

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
        <p class="text-red-700 font-medium mb-1">{{ t('concept.failedToLoad') }}</p>
        <p class="text-sm text-red-600/80 mb-4">{{ localError }}</p>
        <div class="flex gap-2 justify-center">
          <button @click="loadConcept(registerId, conceptId)" class="btn-primary">{{ t('dataset.retry') }}</button>
          <router-link :to="{ name: 'dataset', params: { registerId } }" class="btn-secondary">
            {{ t('concept.backToDataset') }}
          </router-link>
        </div>
      </div>
    </div>
    <div v-else-if="!concept" class="max-w-xl mx-auto text-center py-20">
      <div class="card p-8">
        <div class="text-ink-200 text-5xl mb-3 font-serif">?</div>
        <h3 class="text-lg font-medium text-ink-700 mb-2">{{ t('concept.notFound') }}</h3>
        <p class="text-sm text-ink-400 mb-4">{{ t('concept.notFoundMsg', { id: conceptId }) }}</p>
        <router-link :to="{ name: 'dataset', params: { registerId } }" class="btn-primary">
          {{ t('concept.backToDataset') }}
        </router-link>
      </div>
    </div>
    <template v-else-if="concept && manifest">
      <div class="concept-content" :class="{ 'sphere-content': viewMode === 'sphere' }">
        <!-- Sphere mode — receives concept + edges directly, no URI matching -->
        <RelationSphere
          v-if="viewMode === 'sphere'"
          :concept="concept"
          :manifest="manifest"
          :register-id="registerId"
          :edges="edges"
          @navigate="onSphereNavigate"
        />
        <!-- Detail mode -->
        <ConceptDetail
          v-else
          :concept="concept"
          :manifest="manifest"
          :edges="edges"
          :adjacent="adjacent"
          :register-id="registerId"
        />
      </div>
    </template>

    <ShortcutsModal v-if="showShortcuts" @close="showShortcuts = false" />
  </div>
</template>

<style scoped>
.concept-view {
  display: flex;
  flex-direction: column;
  position: relative;
  padding: 1rem;
  min-height: calc(100vh - 56px);
}
.concept-view.sphere-mode {
  height: calc(100vh - 56px);
  overflow: hidden;
}
.concept-content {
  flex: 1;
  min-height: 0;
  width: 100%;
  max-width: 80rem;
  margin: 0 auto;
}
.concept-content.sphere-content {
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
