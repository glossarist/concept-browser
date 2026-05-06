<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useDsStyle } from '../utils/dataset-style';
import ConceptCard from '../components/ConceptCard.vue';

const props = defineProps<{ registerId: string }>();

const store = useVocabularyStore();
const { getStyle } = useDsStyle();

const manifest = computed(() => store.manifests.get(props.registerId));
const adapter = computed(() => store.datasets.get(props.registerId));
const loading = ref(false);
const localError = ref<string | null>(null);
const chunkLoading = ref(false);

async function ensureLoaded() {
  const adp = store.datasets.get(props.registerId);
  if (adp?.index) return;
  loading.value = true;
  localError.value = null;
  try {
    await store.loadDataset(props.registerId);
  } catch (e: any) {
    localError.value = e.message || 'Failed to load dataset';
  }
  loading.value = false;
}

onMounted(ensureLoaded);
watch(() => props.registerId, ensureLoaded);

const totalConceptCount = computed(() => adapter.value?.getConceptCount() ?? 0);

const filter = ref('');
const filterInput = ref<HTMLInputElement | null>(null);
const allChunksLoaded = ref(false);

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    filterInput.value?.focus();
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown));
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown));

// When filtering, ensure all chunks are loaded for accurate search
watch(filter, async (q) => {
  page.value = 1;
  if (q.trim().length >= 2 && !allChunksLoaded.value && adapter.value) {
    chunkLoading.value = true;
    await adapter.value.ensureAllChunksLoaded();
    allChunksLoaded.value = true;
    chunkLoading.value = false;
  }
});

// Dense array: only loaded (non-undefined) entries
const loadedConcepts = computed(() => {
  const arr = adapter.value?.getConcepts() as (import('../adapters/types').ConceptSummary | undefined)[] | undefined;
  if (!arr) return [];
  return arr.filter((c): c is import('../adapters/types').ConceptSummary => c != null);
});

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase();
  if (!q) return loadedConcepts.value;
  return loadedConcepts.value.filter(c => {
    return (c.eng || '').toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  });
});

const page = ref(1);
const perPage = 50;

// Check if the current page range is loaded in the index
const pageLoaded = computed(() => {
  if (!adapter.value) return false;
  const start = (page.value - 1) * perPage;
  return adapter.value.isRangeLoaded(start, perPage);
});

const paged = computed(() => {
  // When filtering, paginate over filtered dense results (all chunks loaded)
  if (filter.value.trim()) {
    const start = (page.value - 1) * perPage;
    return filtered.value.slice(start, start + perPage);
  }
  // When not filtering, slice directly from the pre-allocated index (may contain undefined)
  const start = (page.value - 1) * perPage;
  const arr = adapter.value?.getConcepts() as (import('../adapters/types').ConceptSummary | undefined)[] | undefined;
  if (!arr) return [];
  return arr.slice(start, start + perPage).filter((c): c is import('../adapters/types').ConceptSummary => c != null);
});

const totalPages = computed(() => {
  if (filter.value.trim()) {
    return Math.max(1, Math.ceil(filtered.value.length / perPage));
  }
  return Math.max(1, Math.ceil(totalConceptCount.value / perPage));
});

// Load chunks needed for current page
watch(page, async () => {
  if (!adapter.value || filter.value.trim()) return;
  const start = (page.value - 1) * perPage;
  if (!adapter.value.isRangeLoaded(start, perPage)) {
    chunkLoading.value = true;
    await adapter.value.ensureChunksForRange(start, perPage);
    chunkLoading.value = false;
  }
}, { immediate: true });

// Visible page numbers for pagination (avoids iterating 445+ pages)
const visiblePages = computed(() => {
  const total = totalPages.value;
  const current = page.value;
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: number[] = [1];
  const rangeStart = Math.max(2, current - 2);
  const rangeEnd = Math.min(total - 1, current + 2);
  if (rangeStart > 2) pages.push(-1);
  for (let p = rangeStart; p <= rangeEnd; p++) pages.push(p);
  if (rangeEnd < total - 1) pages.push(-2);
  pages.push(total);
  return pages;
});

function goToPage(p: number) {
  page.value = Math.max(1, Math.min(p, totalPages.value));
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Breadcrumb -->
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
      <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors">Home</router-link>
      <span class="text-ink-200">/</span>
      <span class="text-ink-700">{{ manifest?.title || registerId }}</span>
    </nav>

    <!-- Header -->
    <div v-if="manifest" class="mb-8">
      <h1 class="font-serif text-3xl text-ink-800 mb-2">{{ manifest.title }}</h1>
      <p class="text-ink-400 leading-relaxed max-w-2xl">{{ manifest.description }}</p>
      <div class="flex flex-wrap gap-2 mt-4">
        <span class="badge" :style="{ backgroundColor: getStyle(registerId).light, color: getStyle(registerId).dark }">{{ manifest.conceptCount.toLocaleString() }} concepts</span>
        <span class="badge badge-gray">{{ manifest.languages.length }} languages</span>
        <span class="badge badge-green">{{ manifest.owner }}</span>
        <router-link :to="{ name: 'stats', params: { registerId } }" class="badge badge-blue hover:opacity-80 transition-opacity">
          Statistics
        </router-link>
        <router-link :to="{ name: 'about', params: { registerId } }" class="badge badge-purple hover:opacity-80 transition-opacity">
          About
        </router-link>
      </div>
    </div>

    <!-- Loading state (initial dataset load) -->
    <div v-if="loading || (!adapter?.index && !localError)" class="space-y-4 py-4">
      <div class="space-y-2">
        <div class="skeleton h-3 w-32"></div>
        <div class="skeleton h-8 w-64"></div>
        <div class="skeleton h-4 w-96"></div>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mt-6">
        <div v-for="i in 6" :key="i" class="skeleton h-20"></div>
      </div>
    </div>

    <!-- Error state -->
    <div v-else-if="localError" class="max-w-xl mx-auto text-center py-20">
      <div class="card p-8 border-red-200 bg-red-50/50">
        <p class="text-red-700 font-medium mb-1">Failed to load dataset</p>
        <p class="text-sm text-red-600/80 mb-4">{{ localError }}</p>
        <div class="flex gap-2 justify-center">
          <button @click="ensureLoaded" class="btn-primary">Retry</button>
          <router-link :to="{ name: 'home' }" class="btn-secondary">Back to home</router-link>
        </div>
      </div>
    </div>

    <template v-else>
      <!-- Filters -->
      <div class="flex flex-wrap items-center gap-3 mb-5">
        <div class="relative">
          <input
            ref="filterInput"
            v-model="filter"
            type="text"
            aria-label="Filter concepts"
            placeholder="Filter concepts... (press /)"
            class="pl-9 pr-3 py-2 text-sm bg-surface border border-ink-100 rounded-lg focus:ring-2 focus:ring-ink-200 focus:border-ink-400 outline-none placeholder:text-ink-300 transition-all w-full sm:w-64"
          />
          <svg class="absolute left-3 top-2.5 w-4 h-4 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
        <span class="text-sm text-ink-400">
          {{ filter.trim()
            ? `${filtered.length.toLocaleString()} of ${totalConceptCount.toLocaleString()} concepts`
            : `${totalConceptCount.toLocaleString()} concepts`
          }}
        </span>
      </div>

      <!-- Chunk loading skeleton -->
      <div v-if="chunkLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <div v-for="i in 6" :key="i" class="skeleton h-20"></div>
      </div>

      <!-- Concept grid -->
      <div v-else-if="paged.length" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        <ConceptCard
          v-for="(entry, idx) in paged"
          :key="entry.id"
          :entry="entry"
          :register-id="registerId"
          class="animate-entrance"
          :style="{ animationDelay: `${Math.min(idx, 20) * 30}ms` }"
        />
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-20">
        <div class="text-ink-200 text-5xl mb-4 font-serif">&empty;</div>
        <template v-if="filter.trim()">
          <p class="text-ink-500 font-medium mb-1">No concepts match your filter</p>
          <button @click="filter = ''" class="text-sm concept-link mt-1">Clear filter</button>
        </template>
        <template v-else>
          <p class="text-ink-500 font-medium mb-1">This dataset has no concepts</p>
        </template>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-center gap-1.5 mt-8 pt-6 border-t border-ink-100/60">
        <button
          :disabled="page <= 1"
          @click="goToPage(page - 1)"
          class="btn-secondary disabled:opacity-30 text-xs"
        >&larr; Prev</button>
        <template v-for="p in visiblePages" :key="p">
          <span v-if="p < 0" class="text-ink-300 px-0.5">&hellip;</span>
          <button
            v-else
            @click="goToPage(p)"
            :class="p === page ? 'bg-ink-800 text-white' : 'bg-surface-raised text-ink-600 hover:bg-ink-50 border border-ink-100'"
            class="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
          >{{ p }}</button>
        </template>
        <button
          :disabled="page >= totalPages"
          @click="goToPage(page + 1)"
          class="btn-secondary disabled:opacity-30 text-xs"
        >Next &rarr;</button>
      </div>
    </template>
  </div>
</template>
