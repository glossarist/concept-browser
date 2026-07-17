<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useDatasetLoader } from '../composables/use-dataset-loader';
import { useDsStyle } from '../utils/dataset-style';
import { useI18n } from '../i18n';

const props = defineProps<{ registerId?: string }>();

const store = useVocabularyStore();
const { getColor } = useDsStyle();
const { loading, localError, ensureLoaded, resolvedId } = useDatasetLoader(() => props.registerId);
const { t } = useI18n();

const manifest = computed(() => store.manifests.get(resolvedId.value));

interface SourceEntry {
  ref: string;
  types: string[];
  conceptCount: number;
  conceptIds: string[];
}

const stats = ref<{ sources: SourceEntry[]; sourceCount: number; relationshipCount: number; relationshipTypes: Record<string, number> } | null>(null);
const expandedSource = ref<string | null>(null);
const filterText = ref('');

async function loadStats() {
  if (!resolvedId.value) return;
  const base = import.meta.env.BASE_URL;
  try {
    const resp = await fetch(`${base}data/${resolvedId.value}/stats.json`);
    if (resp.ok) {
      stats.value = await resp.json();
    }
  } catch (e) {
    console.warn('Failed to load stats:', e);
  }
}

watch(() => resolvedId.value, () => { loadStats(); }, { immediate: true });

const filteredSources = computed(() => {
  if (!stats.value?.sources) return [];
  const q = filterText.value.toLowerCase().trim();
  if (!q) return stats.value.sources;
  return stats.value.sources.filter(s =>
    s.ref.toLowerCase().includes(q) ||
    s.types.some(t => t.toLowerCase().includes(q))
  );
});

function sourceTypeBadge(type: string): string {
  if (type === 'authoritative') return 'badge-green';
  if (type === 'lineage') return 'badge-yellow';
  return 'badge-gray';
}
</script>

<template>
  <div class="max-w-4xl mx-auto">
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="skeleton h-8 w-64"></div>
    </div>

    <div v-else-if="localError" class="card p-8 text-center">
      <p class="text-red-600">{{ localError }}</p>
    </div>

    <template v-else-if="manifest">
      <div class="mb-6">
        <div class="text-xs text-ink-400 mb-2">
          <router-link :to="{ name: 'dataset', params: { registerId } }" class="hover:text-blue-600">{{ manifest.title }}</router-link>
          <span class="mx-1">›</span>
          <span>{{ t('nav.sources') }}</span>
        </div>
        <h1 class="font-serif text-3xl text-ink-800 dark:text-ink-100">{{ t('nav.sources') }}</h1>
        <p class="text-ink-400 mt-1" v-if="stats">{{ stats.sourceCount }} {{ t('dataset.sources') }} · {{ manifest.conceptCount.toLocaleString() }} {{ t('dataset.concepts') }}</p>
      </div>

      <div v-if="!stats" class="card p-8 text-center text-ink-400">
        Loading sources…
      </div>

      <template v-else>
        <div class="card p-3 mb-4">
          <input
            v-model="filterText"
            type="text"
            :placeholder="'Filter sources...'"
            class="w-full px-3 py-2 text-sm border border-ink-100 dark:border-ink-700 rounded-lg bg-surface-raised dark:bg-ink-800 text-ink-700 dark:text-ink-200 focus:outline-none focus:border-blue-400"
          />
        </div>

        <div class="space-y-2">
          <div v-for="src in filteredSources" :key="src.ref" class="card overflow-hidden">
            <button
              class="w-full text-left p-4 flex items-center gap-3 hover:bg-ink-50/50 dark:hover:bg-ink-800/30 transition-colors"
              @click="expandedSource = expandedSource === src.ref ? null : src.ref"
            >
              <span
                class="w-3 h-3 rounded-full flex-shrink-0"
                :style="{ backgroundColor: getColor(resolvedId) }"
              ></span>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-ink-800 dark:text-ink-100 truncate">{{ src.ref }}</div>
                <div class="flex items-center gap-1.5 mt-1">
                  <span v-for="tp in src.types" :key="tp" class="badge text-[9px]" :class="sourceTypeBadge(tp)">{{ tp }}</span>
                  <span class="text-xs text-ink-400">{{ src.conceptCount }} {{ t('dataset.concepts') }}</span>
                </div>
              </div>
              <svg class="w-4 h-4 text-ink-300 transition-transform flex-shrink-0" :class="{ 'rotate-180': expandedSource === src.ref }" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>

            <div v-if="expandedSource === src.ref" class="border-t border-ink-100/60 dark:border-ink-700/40 p-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                <router-link
                  v-for="cid in src.conceptIds"
                  :key="cid"
                  :to="{ name: 'concept', params: { registerId, conceptId: cid } }"
                  class="block px-2 py-1 rounded text-sm text-ink-600 dark:text-ink-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
                >
                  <code class="text-xs text-ink-400 font-mono mr-1">{{ cid }}</code>
                </router-link>
              </div>
            </div>
          </div>
        </div>
      </template>
    </template>
  </div>
</template>
