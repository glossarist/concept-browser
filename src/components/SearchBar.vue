<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useUiStore } from '../stores/ui';
import { useVocabularyStore } from '../stores/vocabulary';
import { ref, watch, onMounted, computed, nextTick } from 'vue';
import type { SearchHit } from '../adapters/types';
import { useI18n } from '../i18n';
import SearchResults from './SearchResults.vue';

const router = useRouter();
const ui = useUiStore();
const store = useVocabularyStore();
const { t } = useI18n();
const query = ref('');
const results = ref<SearchHit[]>([]);
const searched = ref(false);
const selectedIdx = ref(-1);
const loading = ref(false);
const searchError = ref<string | null>(null);
const searchInputEl = ref<HTMLInputElement | null>(null);
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

async function doSearch() {
  const q = query.value.trim();
  if (!q) return;
  ui.searchQuery = q;
  loading.value = true;
  searchError.value = null;
  try {
    results.value = await store.searchAcrossDatasets(q);
  } catch (e: any) {
    searchError.value = e.message || 'Search failed';
  } finally {
    loading.value = false;
  }
  searched.value = true;
  selectedIdx.value = -1;
  router.replace({ query: { q } });
}

function onInput() {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(async () => {
    const q = query.value.trim();
    if (q.length >= 2) {
      await doSearch();
    } else if (q.length === 0) {
      results.value = [];
      searched.value = false;
      selectedIdx.value = -1;
    }
  }, 300);
}

function clearSearch() {
  query.value = '';
  results.value = [];
  searched.value = false;
  selectedIdx.value = -1;
  router.replace({ query: {} });
}

interface GroupedResults {
  registerId: string;
  title: string;
  hits: SearchHit[];
}

const groupedResults = computed(() => {
  const capped = results.value.slice(0, 100);
  const map = new Map<string, SearchHit[]>();
  for (const hit of capped) {
    const group = map.get(hit.registerId) ?? [];
    group.push(hit);
    map.set(hit.registerId, group);
  }
  const groups: GroupedResults[] = [];
  for (const [registerId, hits] of map) {
    const m = store.manifests.get(registerId);
    groups.push({ registerId, title: m?.title ?? registerId, hits });
  }
  return groups;
});

const flatHits = computed(() => groupedResults.value.flatMap(g => g.hits));

function goToHit(hit: SearchHit) {
  router.push({
    name: 'concept',
    params: { registerId: hit.registerId, conceptId: hit.conceptId },
  });
}

function onKeydown(e: KeyboardEvent) {
  if (!searched.value || flatHits.value.length === 0) return;

  if (e.key === 'ArrowDown') {
    e.preventDefault();
    selectedIdx.value = Math.min(selectedIdx.value + 1, flatHits.value.length - 1);
    scrollToSelected();
  } else if (e.key === 'ArrowUp') {
    e.preventDefault();
    selectedIdx.value = Math.max(selectedIdx.value - 1, -1);
    scrollToSelected();
  } else if (e.key === 'Enter' && selectedIdx.value >= 0) {
    e.preventDefault();
    goToHit(flatHits.value[selectedIdx.value]);
  }
}

function scrollToSelected() {
  nextTick(() => {
    document.querySelector<HTMLElement>('.search-hit-selected')?.scrollIntoView({ block: 'nearest' });
  });
}

watch(() => ui.searchQuery, (q) => {
  if (q && q !== query.value) {
    query.value = q;
    doSearch();
  }
});

onMounted(() => {
  if (ui.searchQuery) {
    query.value = ui.searchQuery;
    doSearch();
  }
});
</script>

<template>
  <div class="max-w-2xl mx-auto px-0">
    <form @submit.prevent="doSearch" class="mb-6 sm:mb-8">
      <div class="flex gap-2">
        <div class="relative flex-1">
          <input
            ref="searchInputEl"
            v-model="query"
            @input="onInput"
            @keydown="onKeydown"
            type="text"
            placeholder="Search terms across all datasets..."
            class="w-full pl-9 pr-8 py-2.5 text-sm bg-surface border border-ink-100 rounded-lg focus:ring-2 focus:ring-ink-200 focus:border-ink-400 outline-none placeholder:text-ink-300 transition-all"
            autofocus
          />
          <svg v-if="!loading" class="absolute left-3 top-3 w-4 h-4 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
          <svg v-else class="absolute left-3 top-3 w-4 h-4 text-ink-400 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <button
            v-if="query"
            @click="clearSearch"
            type="button"
            class="absolute right-2.5 top-2.5 text-ink-300 hover:text-ink-600 transition-colors"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>
        <button type="submit" class="btn-primary" :disabled="loading">{{ t('search.button') }}</button>
      </div>
    </form>

    <SearchResults
      :loading="loading"
      :search-error="searchError"
      :searched="searched"
      :search-query="ui.searchQuery"
      :results="results"
      :grouped-results="groupedResults"
      :selected-idx="selectedIdx"
      @retry="doSearch"
      @go-hit="goToHit"
    />
  </div>
</template>
