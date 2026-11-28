<script setup lang="ts">
/**
 * BrowseView — register-level tree/facet navigation (issue #261).
 *
 * Renders the build-time navigation.json ({register}/navigation.json):
 * left pane = collapsible concept/section/clause tree, right pane =
 * facet filters (language, status, source standard) plus a concept list
 * respecting the active facets. Every row deep-links to its concept
 * page. Registers without hierarchical data show the tree pane's
 * honest note; facets reflect only what the build emitted.
 *
 * Concept rows reuse the chunked index adapter (the concepts list's
 * loading mechanism); large result sets page in via incremental reveal.
 */
import { computed, ref, watch } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useDatasetLoader } from '../composables/use-dataset-loader';
import { useNavigation } from '../composables/use-navigation';
import { langName } from '../utils/lang';
import { useI18n } from '../i18n';
import NavigationTree from '../components/NavigationTree.vue';
import {
  sectionClosureIds,
  subtreeIds,
  conceptInSections,
  treeKindLabelKey,
} from '../utils/navigation-tree';
import type { ConceptSummary } from '../adapters/types';
import type { NavigationNode } from '../adapters/navigation-index';

const props = defineProps<{ registerId?: string }>();

const store = useVocabularyStore();
const { loading, localError, ensureLoaded, resolvedId } = useDatasetLoader(() => props.registerId);
const { navigation, missing, error: navigationError, reload: reloadNavigation } = useNavigation(resolvedId);
const { t } = useI18n();

const manifest = computed(() => store.manifests.get(resolvedId.value));
const adapter = computed(() => store.datasets.get(resolvedId.value));
const chunkLoading = ref(false);
const allChunksLoaded = ref(false);

// ── Facet / tree state ──
const activeLangs = ref<Set<string>>(new Set());
const activeStatus = ref<Set<string>>(new Set());
const activeStandards = ref<Set<string>>(new Set());
const selectedNodeId = ref<string>('');
const filterText = ref('');

function toggleIn(set: Set<string>, key: string): Set<string> {
  const next = new Set(set);
  if (next.has(key)) next.delete(key);
  else next.add(key);
  return next;
}

function clearFilters() {
  activeLangs.value = new Set();
  activeStatus.value = new Set();
  activeStandards.value = new Set();
  selectedNodeId.value = '';
  filterText.value = '';
}

const hasActiveFilters = computed(() =>
  activeLangs.value.size > 0
  || activeStatus.value.size > 0
  || activeStandards.value.size > 0
  || !!selectedNodeId.value
  || !!filterText.value.trim());

// ── Tree selection → concept-id constraint ──
const selectedNode = computed(() => {
  if (!selectedNodeId.value || !navigation.value) return null;
  const find = (nodes: typeof navigation.value.tree.roots): any => {
    for (const node of nodes) {
      if (node.id === selectedNodeId.value) return node;
      const inChild = find(node.children ?? []);
      if (inChild) return inChild;
    }
    return null;
  };
  return find(navigation.value.tree.roots);
});

const selectedSectionClosure = computed<ReadonlySet<string> | null>(() => {
  const kind = navigation.value?.tree.kind;
  if (!selectedNode.value || (kind !== 'sections' && kind !== 'clauses')) return null;
  return sectionClosureIds(selectedNode.value);
});

const selectedSubtreeIds = computed<Set<string> | null>(() => {
  if (!selectedNode.value || navigation.value?.tree.kind !== 'hierarchy') return null;
  return new Set(subtreeIds(selectedNode.value));
});

function matchesTree(concept: ConceptSummary): boolean {
  if (selectedSubtreeIds.value) return selectedSubtreeIds.value.has(concept.id);
  if (selectedSectionClosure.value) return conceptInSections(concept, selectedSectionClosure.value);
  return true;
}

function facetAny(ids: Record<string, string[]>, active: Set<string>, conceptId: string): boolean {
  if (active.size === 0) return true;
  return [...active].some(key => ids[key]?.includes(conceptId));
}

function facetAnyStandard(
  standards: Record<string, { label: string; ids: string[] }>,
  active: Set<string>,
  conceptId: string,
): boolean {
  if (active.size === 0) return true;
  return [...active].some(key => standards[key]?.ids.includes(conceptId));
}

// ── Concept rows (chunked index, as in DatasetView) ──
const loadedConcepts = computed<ConceptSummary[]>(() => {
  const arr = adapter.value?.getConcepts();
  if (!arr) return [];
  return arr.filter((c): c is ConceptSummary => c != null);
});

const filtered = computed(() => {
  const nav = navigation.value;
  if (!nav) return [];
  const q = filterText.value.trim().toLowerCase();
  return loadedConcepts.value.filter(c => {
    if (!facetAny(nav.facets.languages, activeLangs.value, c.id)) return false;
    if (!facetAny(nav.facets.status, activeStatus.value, c.id)) return false;
    if (!facetAnyStandard(nav.facets.standards, activeStandards.value, c.id)) return false;
    if (hasTreeConstraint.value && !matchesTree(c)) return false;
    if (!q) return true;
    return (c.eng || '').toLowerCase().includes(q) || c.id.toLowerCase().includes(q);
  });
});

const hasTreeConstraint = computed(() => !!selectedNode.value);
const treeKindLabel = computed(() => treeKindLabelKey(navigation.value?.tree.kind ?? 'none'));

// Concept-row chunks load exactly as lazily as the concepts list does:
// an active constraint needs the full index; the unfiltered default only
// needs the range currently revealed.
async function ensureAllChunksForFilter(needsLoad: boolean) {
  if (!needsLoad || allChunksLoaded.value) return;
  const a = adapter.value;
  if (!a?.index) return;
  chunkLoading.value = true;
  try {
    await a.ensureAllChunksLoaded();
    allChunksLoaded.value = true;
  } catch (e) {
    localError.value = e instanceof Error ? e.message : String(e);
  } finally {
    chunkLoading.value = false;
  }
}

async function ensureRange(start: number, count: number) {
  const a = adapter.value;
  if (!a?.index || a.isRangeLoaded?.(start, count)) return;
  chunkLoading.value = true;
  try {
    await a.ensureChunksForRange(start, count);
  } catch (e) {
    localError.value = e instanceof Error ? e.message : String(e);
  } finally {
    chunkLoading.value = false;
  }
}

// ── Incremental reveal (concepts list convention) ──
const PAGE = 100;
const revealed = ref(PAGE);
watch([activeLangs, activeStatus, activeStandards, selectedNodeId, filterText], () => {
  revealed.value = PAGE;
});

watch([hasActiveFilters, revealed], ([active, n]) => {
  if (active) {
    ensureAllChunksForFilter(true);
  } else {
    ensureRange(0, n);
  }
}, { immediate: true });

const visibleConcepts = computed(() => filtered.value.slice(0, revealed.value));
function revealMore() {
  revealed.value += PAGE;
}

// With a constraint, "more" is bounded by the filtered result; without
// one it is bounded by the register total (chunks load per range).
const moreRemaining = computed(() =>
  hasActiveFilters.value ? filtered.value.length - revealed.value : totalConceptCount.value - revealed.value);
const hasMore = computed(() => moreRemaining.value > 0);

// Honest result line: with no constraint the slice limit is a lazy-load
// boundary, not a filter outcome — report the register's real total.
const totalConceptCount = computed(() =>
  adapter.value?.getConceptCount() ?? navigation.value?.conceptCount ?? 0);
const resultCount = computed(() => hasActiveFilters.value ? filtered.value.length : totalConceptCount.value);

// ── Facet option lists (only what exists) ──
const languageFacets = computed(() => {
  const langs = navigation.value?.facets.languages ?? {};
  return Object.keys(langs).sort().map(code => ({
    code,
    name: langName(code),
    count: langs[code].length,
  }));
});
const statusFacets = computed(() => {
  const statuses = navigation.value?.facets.status ?? {};
  return Object.keys(statuses).sort().map(status => ({
    status,
    count: statuses[status].length,
  }));
});
const standardFacets = computed(() => {
  const standards = navigation.value?.facets.standards ?? {};
  return Object.keys(standards).sort().map(key => ({
    key,
    label: standards[key].label,
    count: standards[key].ids.length,
  }));
});

const treeRoots = computed<NavigationNode[]>(() => navigation.value?.tree.roots ?? []);

const treeNote = computed(() => {
  const kind = navigation.value?.tree.kind;
  if (!kind || kind === 'hierarchy') return '';
  if (kind === 'none') return t('browse.tree.noteNone');
  return t('browse.tree.noteFallback');
});

async function reloadAll() {
  await ensureLoaded();
  reloadNavigation();
}
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
      <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors">{{ t('nav.home') }}</router-link>
      <span class="text-ink-200">/</span>
      <router-link :to="{ name: 'dataset', params: { registerId: resolvedId } }" class="hover:text-ink-700 transition-colors">{{ manifest?.title || resolvedId }}</router-link>
      <span class="text-ink-200">/</span>
      <span class="text-ink-700">{{ t('browse.title') }}</span>
    </nav>

    <template v-if="loading">
      <div class="animate-pulse space-y-6">
        <div class="h-8 bg-ink-100 rounded w-40"></div>
        <div class="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6">
          <div class="card h-64 bg-ink-50"></div>
          <div class="card h-64 bg-ink-50"></div>
        </div>
      </div>
    </template>
    <template v-else-if="localError">
      <div class="card p-8 border-red-200 bg-red-50/50 text-center">
        <p class="text-red-700 font-medium mb-1">{{ t('browse.failedToLoad') }}</p>
        <p class="text-sm text-red-600/80 mb-4">{{ localError }}</p>
        <button @click="reloadAll" class="btn-primary">{{ t('curation.retry') }}</button>
      </div>
    </template>
    <template v-else-if="manifest">
      <h1 class="font-serif text-3xl text-ink-800 mb-2">{{ t('browse.title') }}</h1>
      <p class="text-ink-400 mb-4">{{ t('browse.summary', { title: manifest.title }) }}</p>

      <div v-if="navigation" class="flex flex-wrap gap-2 mb-4">
        <span class="badge badge-gray" data-testid="browse-concept-count">{{ navigation.conceptCount.toLocaleString() }} {{ t('dataset.concepts') }}</span>
        <span class="badge badge-blue">{{ t(treeKindLabel) }}</span>
        <router-link :to="{ name: 'dataset', params: { registerId: resolvedId } }" class="text-xs text-blue-600 hover:underline self-center">
          {{ t('nav.concepts') }} →
        </router-link>
      </div>

      <p v-if="treeNote" class="text-sm text-ink-500 dark:text-ink-300 mb-4" data-testid="browse-tree-note">
        {{ treeNote }}
      </p>

      <div v-if="!navigation && missing" class="card p-8 text-center">
        <p class="text-ink-500 dark:text-ink-300 text-sm">{{ t('browse.noData') }}</p>
      </div>
      <div v-else-if="!navigation && navigationError" class="card p-8 border-red-200 bg-red-50/50 text-center">
        <p class="text-red-700 font-medium mb-1 text-sm">{{ t('curation.loadFailed') }} {{ navigationError }}</p>
        <button @click="reloadNavigation" class="btn-primary mt-3">{{ t('curation.retry') }}</button>
      </div>

      <div v-if="navigation" class="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-6 items-start">
        <!-- Left pane: tree -->
        <section :aria-label="t(treeKindLabel)">
          <NavigationTree
            :kind="navigation.tree.kind"
            :roots="treeRoots"
            :selected-id="selectedNodeId || null"
            @select="id => { selectedNodeId = id; }"
          />
        </section>

        <!-- Right pane: facets + concept list -->
        <section>
          <div class="flex flex-wrap items-center gap-3 mb-3">
            <label class="sr-only" for="browse-filter">{{ t('browse.filter') }}</label>
            <input
              id="browse-filter"
              v-model="filterText"
              type="search"
              :placeholder="t('browse.filter')"
              class="w-full max-w-xs px-3 py-2 text-sm rounded-lg border border-ink-100 dark:border-ink-700 bg-surface-raised dark:bg-ink-800 text-ink-800 dark:text-ink-100 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
            />
            <span class="text-sm text-ink-400" data-testid="browse-result-count">
              {{ resultCount.toLocaleString() }} {{ t('dataset.of') }} {{ navigation.conceptCount.toLocaleString() }} {{ t('dataset.concepts') }}
            </span>
            <button v-if="hasActiveFilters" class="text-xs text-blue-600 hover:underline" @click="clearFilters">
              {{ t('browse.clearFilters') }}
            </button>
          </div>

          <div class="flex flex-wrap gap-4 mb-4">
            <fieldset v-if="languageFacets.length" class="min-w-[10rem]">
              <legend class="section-label mb-1">{{ t('browse.facets.language') }}</legend>
              <label
                v-for="lang in languageFacets"
                :key="lang.code"
                class="flex items-center gap-1.5 text-sm py-0.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  class="accent-blue-600"
                  :data-testid="`facet-lang-${lang.code}`"
                  :checked="activeLangs.has(lang.code)"
                  @change="activeLangs = toggleIn(activeLangs, lang.code)"
                />
                <span class="text-ink-700 dark:text-ink-200">{{ lang.name }}</span>
                <span class="text-xs text-ink-400">{{ lang.count.toLocaleString() }}</span>
              </label>
            </fieldset>

            <fieldset v-if="statusFacets.length">
              <legend class="section-label mb-1">{{ t('browse.facets.status') }}</legend>
              <label
                v-for="s in statusFacets"
                :key="s.status"
                class="flex items-center gap-1.5 text-sm py-0.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  class="accent-blue-600"
                  :data-testid="`facet-status-${s.status}`"
                  :checked="activeStatus.has(s.status)"
                  @change="activeStatus = toggleIn(activeStatus, s.status)"
                />
                <span class="text-ink-700 dark:text-ink-200">{{ s.status }}</span>
                <span class="text-xs text-ink-400">{{ s.count.toLocaleString() }}</span>
              </label>
            </fieldset>

            <fieldset v-if="standardFacets.length" class="max-w-xs">
              <legend class="section-label mb-1">{{ t('browse.facets.source') }}</legend>
              <label
                v-for="s in standardFacets"
                :key="s.key"
                class="flex items-center gap-1.5 text-sm py-0.5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  class="accent-blue-600"
                  :data-testid="`facet-standard-${s.key}`"
                  :checked="activeStandards.has(s.key)"
                  @change="activeStandards = toggleIn(activeStandards, s.key)"
                />
                <span class="text-ink-700 dark:text-ink-200 truncate" :title="s.label">{{ s.label }}</span>
                <span class="text-xs text-ink-400">{{ s.count.toLocaleString() }}</span>
              </label>
            </fieldset>
          </div>

          <div v-if="chunkLoading" class="card divide-y divide-ink-50 dark:divide-ink-700/60">
            <div v-for="i in 5" :key="i" class="skeleton h-8"></div>
          </div>
          <ul v-else-if="visibleConcepts.length" class="card divide-y divide-ink-50 dark:divide-ink-700/60" data-testid="browse-list">
            <li v-for="c in visibleConcepts" :key="c.id">
              <router-link
                :to="{ name: 'concept', params: { registerId: resolvedId, conceptId: c.id } }"
                class="flex items-baseline gap-3 px-4 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
              >
                <span class="text-sm font-medium text-ink-800 dark:text-ink-100">{{ c.eng || c.id }}</span>
                <span class="text-xs text-ink-300 dark:text-ink-400 font-mono">{{ c.id }}</span>
                <span v-if="c.status" class="ml-auto badge badge-gray text-[10px]">{{ c.status }}</span>
              </router-link>
            </li>
          </ul>
          <div v-else class="card p-8 text-center text-sm text-ink-500 dark:text-ink-300" data-testid="browse-empty">
            {{ t('browse.noMatch') }}
          </div>
          <div v-if="hasMore" class="text-center mt-3">
            <button class="btn-secondary text-sm" data-testid="browse-show-more" @click="revealMore">
              {{ t('curation.showMore', { count: String(Math.min(PAGE, moreRemaining)) }) }}
            </button>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
