<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted, onBeforeUnmount } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useVocabularyStore } from '../stores/vocabulary';
import { useDsStyle } from '../utils/dataset-style';
import { useDatasetLoader } from '../composables/use-dataset-loader';
import { FORMAT_LABELS } from '../config/types';
import { langName, langLabel, sortLanguages } from '../utils/lang';
import ConceptCard from '../components/ConceptCard.vue';
import { useI18n, locale } from '../i18n';
import { useSiteConfig } from '../config/use-site-config';
import type { SectionNode, ConceptSummary } from '../adapters/types';
import { collectDescendantSectionIds, findSectionNode } from '../utils/section-tree';
import { formatSectionLabel } from '../utils/section-display';

const props = defineProps<{ registerId: string }>();

const store = useVocabularyStore();
const { getStyle } = useDsStyle();
const { ensureLoaded, loading, localError } = useDatasetLoader(() => props.registerId);
const { t } = useI18n();
const { localizedDatasetField } = useSiteConfig();
const route = useRoute();
const router = useRouter();

const manifest = computed(() => store.manifests.get(props.registerId));
const localizedTitle = computed(() => localizedDatasetField(props.registerId, 'title', manifest.value?.title));
const localizedDescription = computed(() => localizedDatasetField(props.registerId, 'description', manifest.value?.description));
const adapter = computed(() => store.datasets.get(props.registerId));
const chunkLoading = ref(false);

// Background chunk preloading via requestIdleCallback
let idlePreloadHandle: ReturnType<typeof requestIdleCallback> | ReturnType<typeof setTimeout> | null = null;

watch(adapter, async (a) => {
  if (!a || !a.index) return;

  // If a section filter is active, load all chunks immediately (not idle)
  if (sectionQuery.value && !allChunksLoaded.value) {
    await ensureAllChunksForFilter(true);
    return;
  }

  if (idlePreloadHandle !== null) return;

  const schedule: (cb: () => void) => number = typeof requestIdleCallback !== 'undefined'
    ? (cb) => requestIdleCallback(cb, { timeout: 2000 })
    : (cb) => window.setTimeout(cb, 0);

  idlePreloadHandle = schedule(() => {
    if (allChunksLoaded.value || !a.index) {
      idlePreloadHandle = null;
      return;
    }
    const count = a.getConceptCount();
    if (count <= 200) {
      a.ensureAllChunksLoaded().then(() => {
        allChunksLoaded.value = true;
      }).catch(() => {});
    } else {
      a.ensureChunksForRange(0, 100).catch(() => {});
    }
    idlePreloadHandle = null;
  });
});

onBeforeUnmount(() => {
  if (idlePreloadHandle !== null) {
    (typeof cancelIdleCallback !== 'undefined' ? cancelIdleCallback : clearTimeout)(idlePreloadHandle as any);
    idlePreloadHandle = null;
  }
});

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const bulkDownloads = computed(() => {
  const m = manifest.value;
  if (!m?.bulkFormats?.length) return [];
  return m.bulkFormats.map(f => ({
    ...f,
    url: `${m.baseUrl}/${f.file}`,
    label: FORMAT_LABELS[f.format] || f.format.toUpperCase(),
    sizeLabel: formatSize(f.size),
  }));
});

const totalConceptCount = computed(() => adapter.value?.getConceptCount() ?? 0);

const filter = ref('');
const filterInput = ref<HTMLInputElement | null>(null);
const allChunksLoaded = ref(false);
const selectedLang = ref<string | null>(null);
const viewMode = ref<'systematic' | 'alphabetical'>('systematic');
const sectionQuery = computed(() => (route.query.section as string) || null);
const page = ref(1);

interface LangOption {
  code: string;
  name: string;
  label: string;
  termCount: number;
}

const languageOptions = computed<LangOption[]>(() => {
  const m = manifest.value;
  if (!m) return [];
  const sorted = sortLanguages(m.languages, m.languageOrder);
  return sorted.map(code => ({
    code,
    name: langName(code),
    label: langLabel(code),
    termCount: m.languageStats?.[code]?.terms ?? 0,
  }));
});

function onGlobalKeydown(e: KeyboardEvent) {
  if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
    e.preventDefault();
    filterInput.value?.focus();
  }
  if (e.key === 'j' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && page.value > 1) {
    goToPage(page.value - 1);
  } else if (e.key === 'k' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA' && page.value < totalPages.value) {
    goToPage(page.value + 1);
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown));
onUnmounted(() => window.removeEventListener('keydown', onGlobalKeydown));

async function ensureAllChunksForFilter(needsLoad: boolean) {
  page.value = 1;
  if (!needsLoad || allChunksLoaded.value) return;
  const a = adapter.value;
  if (!a?.index) return;
  chunkLoading.value = true;
  try {
    await a.ensureAllChunksLoaded();
    allChunksLoaded.value = true;
  } finally {
    chunkLoading.value = false;
  }
}

watch(filter, async (q) => {
  await ensureAllChunksForFilter(q.trim().length >= 2);
});

watch(sectionQuery, async () => {
  await ensureAllChunksForFilter(!!sectionQuery.value);
}, { immediate: true });

watch(selectedLang, async (lang) => {
  await ensureAllChunksForFilter(!!lang);
});

// Dense array: only loaded (non-undefined) entries
const loadedConcepts = computed(() => {
  const arr = adapter.value?.getConcepts();
  if (!arr) return [];
  return arr.filter((c): c is import('../adapters/types').ConceptSummary => c != null);
});

const filtered = computed(() => {
  const q = filter.value.trim().toLowerCase();
  const lang = selectedLang.value;
  const sec = sectionQuery.value;
  const closure = sectionClosure.value;
  return loadedConcepts.value.filter(c => {
    if (lang && !(lang in (c.designations ?? {}))) return false;
    if (sec && !conceptMatchesSection(c, sec.replace(/^section-/, ''), closure)) return false;
    if (!q) return true;
    return (c.eng || '').toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  });
});

const sectionClosure = computed<Set<string> | null>(() => {
  const q = sectionQuery.value;
  if (!q) return null;
  const prefix = q.replace(/^section-/, '');
  const tree = getSections();
  const closure = collectDescendantSectionIds(tree, prefix);
  return closure.size > 0 ? closure : null;
});

function conceptMatchesSection(concept: ConceptSummary, sectionId: string, closure: Set<string> | null): boolean {
  if (closure) {
    if (concept.groups?.some(g => closure.has(g))) return true;
    if (closure.has(sectionId)) {
      return concept.id.startsWith(sectionId + '.') || concept.id.startsWith(sectionId + '-');
    }
    return false;
  }
  if (concept.groups?.length && concept.groups.includes(sectionId)) return true;
  return concept.id.startsWith(sectionId + '.') || concept.id.startsWith(sectionId + '-');
}

function getSections(): SectionNode[] {
  if (!adapter.value) return [];
  return adapter.value.getSectionTree();
}

const sectionDisplayName = computed(() => {
  if (!sectionQuery.value) return '';
  const prefix = sectionQuery.value.replace(/^section-/, '');
  const found = findSectionNode(getSections(), prefix);
  if (!found) return prefix;
  return formatSectionLabel(found, locale.value);
});

// Alphabetical grouping
const alphabetGroups = computed(() => {
  if (viewMode.value !== 'alphabetical') return [];
  const groups = new Map<string, import('../adapters/types').ConceptSummary[]>();
  for (const c of filtered.value) {
    const letter = ((c.eng || c.id)[0] || '?').toUpperCase();
    if (!groups.has(letter)) groups.set(letter, []);
    groups.get(letter)!.push(c);
  }
  return [...groups.entries()].sort((a, b) => a[0].localeCompare(b[0]));
});

const perPage = 50;

// Check if the current page range is loaded in the index
const pageLoaded = computed(() => {
  if (!adapter.value) return false;
  const start = (page.value - 1) * perPage;
  return adapter.value.isRangeLoaded(start, perPage);
});

const isFiltering = computed(() =>
  filter.value.trim() || selectedLang.value || sectionQuery.value
);

const paged = computed(() => {
  if (isFiltering.value) {
    const start = (page.value - 1) * perPage;
    return filtered.value.slice(start, start + perPage);
  }
  const start = (page.value - 1) * perPage;
  const arr = adapter.value?.getConcepts();
  if (!arr) return [];
  return arr.slice(start, start + perPage).filter((c): c is import('../adapters/types').ConceptSummary => c != null);
});

const totalPages = computed(() => {
  if (isFiltering.value) {
    return Math.max(1, Math.ceil(filtered.value.length / perPage));
  }
  return Math.max(1, Math.ceil(totalConceptCount.value / perPage));
});

// Load chunks needed for current page
watch(page, async () => {
  if (!adapter.value || isFiltering.value) return;
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

function clearSection() {
  const r = { ...route };
  delete (r as any).query?.section;
  const q = { ...route.query };
  delete q.section;
  router.replace({ query: q });
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Breadcrumb -->
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
      <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors">{{ t('nav.home') }}</router-link>
      <span class="text-ink-200">/</span>
      <span class="text-ink-700">{{ localizedTitle }}</span>
    </nav>

    <!-- Header -->
    <div v-if="manifest" class="mb-8">
      <h1 class="font-serif text-3xl text-ink-800 mb-2">{{ localizedTitle }}</h1>
      <p class="text-ink-400 leading-relaxed max-w-2xl">{{ localizedDescription }}</p>
      <div class="flex flex-wrap gap-2 mt-4">
        <span class="badge" :style="{ backgroundColor: getStyle(registerId).light, color: getStyle(registerId).dark }">{{ manifest.conceptCount.toLocaleString() }} {{ t('dataset.concepts') }}</span>
        <span class="badge badge-gray">{{ manifest.languages.length }} {{ t('dataset.languages') }}</span>
        <span class="badge badge-green">{{ manifest.owner }}</span>
        <router-link :to="{ name: 'stats', params: { registerId } }" class="badge badge-blue hover:opacity-80 transition-opacity">
          {{ t('nav.stats') }}
        </router-link>
        <router-link :to="{ name: 'about', params: { registerId } }" class="badge badge-purple hover:opacity-80 transition-opacity">
          {{ t('nav.about') }}
        </router-link>
      </div>
    </div>

    <!-- Downloads -->
    <div v-if="bulkDownloads.length" class="card p-4 mb-6">
      <h3 class="text-xs font-semibold text-ink-400 uppercase tracking-wide mb-3">{{ t('dataset.download') }}</h3>
      <div class="flex flex-wrap gap-2">
        <a
          v-for="dl in bulkDownloads"
          :key="dl.file"
          :href="dl.url"
          download
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-ink-100 bg-surface-raised text-sm font-medium text-ink-700 hover:bg-ink-50 hover:border-ink-200 transition-colors"
        >
          <svg class="w-3.5 h-3.5 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
          </svg>
          {{ dl.label }}
          <span class="text-ink-300 text-xs">{{ dl.sizeLabel }}</span>
        </a>
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
        <p class="text-red-700 font-medium mb-1">{{ t('dataset.failedToLoad') }}</p>
        <p class="text-sm text-red-600/80 mb-4">{{ localError }}</p>
        <div class="flex gap-2 justify-center">
          <button @click="ensureLoaded" class="btn-primary">{{ t('dataset.retry') }}</button>
          <router-link :to="{ name: 'home' }" class="btn-secondary">{{ t('dataset.backToHome') }}</router-link>
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
            placeholder="Filter concepts..."
            class="pl-9 pr-3 py-2 text-sm bg-surface border border-ink-100 rounded-lg focus:ring-2 focus:ring-ink-200 focus:border-ink-400 outline-none placeholder:text-ink-300 transition-all w-full sm:w-64"
          />
          <svg class="absolute left-3 top-2.5 w-4 h-4 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
        <div v-if="getSections().length" class="flex items-center gap-1">
          <button
            @click="viewMode = 'systematic'"
            :class="viewMode === 'systematic' ? 'bg-ink-800 text-white' : 'bg-surface-raised text-ink-600 hover:bg-ink-50 border border-ink-100'"
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >{{ t('dataset.systematic') }}</button>
          <button
            @click="viewMode = 'alphabetical'"
            :class="viewMode === 'alphabetical' ? 'bg-ink-800 text-white' : 'bg-surface-raised text-ink-600 hover:bg-ink-50 border border-ink-100'"
            class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          >{{ t('dataset.alphabetical') }}</button>
        </div>
        <span class="text-sm text-ink-400">
          <template v-if="selectedLang">
            {{ filtered.length.toLocaleString() }} {{ t('dataset.of') }} {{ totalConceptCount.toLocaleString() }} {{ t('dataset.concepts') }} {{ t('dataset.in') }} {{ langName(selectedLang) }}
          </template>
          <template v-else-if="filter.trim()">
            {{ filtered.length.toLocaleString() }} {{ t('dataset.of') }} {{ totalConceptCount.toLocaleString() }} {{ t('dataset.concepts') }}
          </template>
          <template v-else-if="totalPages > 1">
            {{ ((page - 1) * perPage + 1).toLocaleString() }}–{{ Math.min(page * perPage, totalConceptCount).toLocaleString() }} {{ t('dataset.of') }} {{ totalConceptCount.toLocaleString() }} {{ t('dataset.concepts') }}
          </template>
          <template v-else>
            {{ totalConceptCount.toLocaleString() }} {{ t('dataset.concepts') }}
          </template>
        </span>
      </div>

      <!-- Section filter indicator -->
      <div v-if="sectionQuery" class="flex items-center gap-2 mb-4">
        <span class="text-sm text-ink-500">{{ t('dataset.sectionFilter') }}:</span>
        <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-50 text-amber-700 text-sm font-medium">
          {{ sectionDisplayName }}
          <button @click="clearSection" class="text-amber-400 hover:text-amber-600 transition-colors">
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </span>
        <span class="text-xs text-ink-400">{{ filtered.length.toLocaleString() }} {{ t('dataset.conceptsInSection') }}</span>
      </div>

      <!-- Language filter -->
      <div v-if="languageOptions.length > 1" class="flex flex-wrap gap-1.5 mb-5">
        <button
          @click="selectedLang = null"
          :class="[
            selectedLang === null
              ? 'bg-ink-800 text-white'
              : 'bg-surface-raised text-ink-600 hover:bg-ink-50 border border-ink-100'
          ]"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
        >
          {{ t('dataset.all') }} {{ totalConceptCount.toLocaleString() }}
        </button>
        <button
          v-for="lang in languageOptions"
          :key="lang.code"
          @click="selectedLang = selectedLang === lang.code ? null : lang.code"
          :class="[
            selectedLang === lang.code
              ? 'bg-ink-800 text-white'
              : 'bg-surface-raised text-ink-600 hover:bg-ink-50 border border-ink-100'
          ]"
          class="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5"
        >
          <span
            class="text-[10px] font-semibold px-1.5 py-0.5 rounded"
            :class="selectedLang === lang.code ? 'bg-ink-700 text-ink-200' : 'bg-ink-50 text-ink-500'"
          >{{ lang.label }}</span>
          {{ lang.name }}
          <span class="text-[10px] opacity-60">{{ lang.termCount }}</span>
        </button>
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
          :display-lang="selectedLang"
          class="animate-entrance"
          :style="{ animationDelay: `${Math.min(idx, 20) * 30}ms` }"
        />
      </div>

      <!-- Empty state -->
      <div v-else class="text-center py-20">
        <div class="text-ink-200 text-5xl mb-4 font-serif">&empty;</div>
        <template v-if="filter.trim()">
          <p class="text-ink-500 font-medium mb-1">{{ t('dataset.noMatch') }}</p>
          <button @click="filter = ''" class="text-sm concept-link mt-1">{{ t('dataset.clearFilter') }}</button>
        </template>
        <template v-else>
          <p class="text-ink-500 font-medium mb-1">{{ t('dataset.noConcepts') }}</p>
        </template>
      </div>

      <!-- Pagination -->
      <div v-if="totalPages > 1" class="flex items-center justify-center gap-1.5 mt-8 pt-6 border-t border-ink-100/60">
        <button
          :disabled="page <= 1"
          @click="goToPage(page - 1)"
          class="btn-secondary disabled:opacity-30 text-xs"
        >&larr; {{ t('dataset.prev') }}</button>
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
        >{{ t('dataset.next') }} &rarr;</button>
      </div>
    </template>
  </div>
</template>
