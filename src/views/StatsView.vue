<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useDsStyle } from '../utils/dataset-style';
import { useDatasetLoader } from '../composables/use-dataset-loader';
import { langName, langLabel } from '../utils/lang';
import { useI18n } from '../i18n';

const props = defineProps<{ registerId?: string }>();

const store = useVocabularyStore();
const { getColor } = useDsStyle();
const { loading, localError, ensureLoaded, resolvedId } = useDatasetLoader(() => props.registerId);
const { t } = useI18n();

const manifest = computed(() => store.manifests.get(resolvedId.value));

interface LangStat { lang: string; terms: number; definitions: number; }

const langStats = computed(() => {
  const m = manifest.value;
  if (!m) return { langs: [], total: 0 };
  const adapter = store.datasets.get(resolvedId.value);
  const conceptCounts: Record<string, number> = {};
  if (adapter) {
    for (const c of adapter.getConcepts()) {
      if (!c) continue;
      for (const lang of Object.keys(c.designations)) {
        conceptCounts[lang] = (conceptCounts[lang] || 0) + 1;
      }
    }
  }
  const ls = m.languageStats || {};
  const allLangs = new Set([...Object.keys(conceptCounts), ...m.languages]);
  const langs: LangStat[] = [...allLangs].map(lang => ({
    lang,
    terms: ls[lang]?.terms ?? conceptCounts[lang] ?? 0,
    definitions: ls[lang]?.definitions ?? conceptCounts[lang] ?? 0,
  }));
  langs.sort((a, b) => {
    if (a.lang === 'eng') return -1;
    if (b.lang === 'eng') return 1;
    return b.terms - a.terms;
  });
  return { langs, total: m.conceptCount };
});

const maxTerms = computed(() => Math.max(...langStats.value.langs.map(l => l.terms), 1));

function coverageColor(ratio: number): string {
  if (ratio >= 0.8) return 'bg-emerald-500';
  if (ratio >= 0.5) return 'bg-blue-500';
  if (ratio >= 0.25) return 'bg-amber-500';
  return 'bg-red-400';
}

interface StatsData {
  sourceCount: number;
  sources: Array<{ ref: string; types: string[]; conceptCount: number }>;
  relationshipCount: number;
  relationshipTypes: Record<string, number>;
}

const statsData = ref<StatsData | null>(null);

async function loadStats() {
  if (!resolvedId.value) return;
  const base = import.meta.env.BASE_URL;
  try {
    const resp = await fetch(`${base}data/${resolvedId.value}/stats.json`);
    if (resp.ok) statsData.value = await resp.json();
  } catch {}
}

watch(() => resolvedId.value, () => { loadStats(); }, { immediate: true });

const relEntries = computed(() => {
  if (!statsData.value?.relationshipTypes) return [];
  return Object.entries(statsData.value.relationshipTypes)
    .sort(([, a], [, b]) => b - a);
});

const maxRel = computed(() => Math.max(...relEntries.value.map(([, n]) => n), 1));

const topSources = computed(() => {
  if (!statsData.value?.sources) return [];
  return statsData.value.sources.slice(0, 10);
});

function sourceTypeBadge(type: string): string {
  if (type === 'authoritative') return 'badge-green';
  if (type === 'lineage') return 'badge-yellow';
  return 'badge-gray';
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
      <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors">{{ t('nav.home') }}</router-link>
      <span class="text-ink-200">/</span>
      <router-link :to="{ name: 'dataset', params: { registerId: resolvedId } }" class="hover:text-ink-700 transition-colors">{{ manifest?.title || resolvedId }}</router-link>
      <span class="text-ink-200">/</span>
      <span class="text-ink-700">{{ t('stats.title') }}</span>
    </nav>

    <template v-if="loading">
      <div class="animate-pulse space-y-6">
        <div class="h-8 bg-ink-100 rounded w-32"></div>
        <div class="h-4 bg-ink-100 rounded w-64"></div>
        <div class="card overflow-hidden"><div class="h-80 bg-ink-50"></div></div>
      </div>
    </template>
    <template v-else-if="localError">
      <div class="card p-8 border-red-200 bg-red-50/50 text-center">
        <p class="text-red-700 font-medium mb-1">{{ t('stats.failedToLoad') }}</p>
        <p class="text-sm text-red-600/80 mb-4">{{ localError }}</p>
        <button @click="ensureLoaded" class="btn-primary">{{ t('stats.retry') }}</button>
      </div>
    </template>
    <template v-else-if="manifest">
      <h1 class="font-serif text-3xl text-ink-800 mb-2">{{ t('stats.title') }}</h1>
      <p class="text-ink-400 mb-8">
        {{ t('stats.summary', { count: langStats.total.toLocaleString(), langCount: String(manifest.languages.length) }) }}
      </p>

      <div v-if="statsData" class="flex flex-wrap gap-2 mb-8">
        <span class="badge badge-purple">{{ statsData.sourceCount }} {{ t('dataset.sources') }}</span>
        <span class="badge badge-yellow">{{ statsData.relationshipCount.toLocaleString() }} {{ t('dataset.relationships') }}</span>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h2 class="section-label mb-3">{{ t('stats.language') }}</h2>
          <div class="card overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-ink-100/60 bg-ink-50">
                  <th class="text-left px-4 py-2.5 text-ink-600 font-medium text-xs uppercase tracking-wide">{{ t('stats.language') }}</th>
                  <th class="text-right px-4 py-2.5 text-ink-600 font-medium text-xs uppercase tracking-wide">{{ t('stats.terms') }}</th>
                  <th class="text-right px-4 py-2.5 text-ink-600 font-medium text-xs uppercase tracking-wide">{{ t('stats.definitions') }}</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in langStats.langs" :key="s.lang" class="border-b border-ink-50 last:border-0">
                  <td class="px-4 py-2.5">
                    <span class="text-xs font-semibold text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ langLabel(s.lang) }}</span>
                    <span class="ml-2 font-medium text-ink-800">{{ langName(s.lang) }}</span>
                  </td>
                  <td class="text-right px-4 py-2.5 font-mono text-ink-700">{{ s.terms.toLocaleString() }}</td>
                  <td class="text-right px-4 py-2.5 font-mono text-ink-700">{{ s.definitions.toLocaleString() }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div v-if="relEntries.length">
          <h2 class="section-label mb-3">{{ t('dataset.relationships') }}</h2>
          <div class="card p-4 space-y-3">
            <div v-for="[type, count] in relEntries" :key="type">
              <div class="flex items-center justify-between mb-1">
                <span class="text-sm font-medium text-ink-700">{{ type }}</span>
                <span class="text-sm font-mono text-ink-500">{{ count.toLocaleString() }}</span>
              </div>
              <div class="h-2 rounded-full bg-ink-50 overflow-hidden">
                <div class="h-full rounded-full bg-blue-500 transition-all duration-500" :style="{ width: (count / maxRel * 100) + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div v-if="topSources.length" class="mt-8">
        <div class="flex items-center justify-between mb-3">
          <h2 class="section-label">{{ t('dataset.sources') }}</h2>
          <router-link :to="{ name: 'sources', params: { registerId: resolvedId } }" class="text-xs text-blue-600 hover:underline">
            View all {{ statsData?.sourceCount }} →
          </router-link>
        </div>
        <div class="card overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-ink-100/60 bg-ink-50">
                <th class="text-left px-4 py-2.5 text-ink-600 font-medium text-xs uppercase tracking-wide">Source</th>
                <th class="text-left px-4 py-2.5 text-ink-600 font-medium text-xs uppercase tracking-wide">Type</th>
                <th class="text-right px-4 py-2.5 text-ink-600 font-medium text-xs uppercase tracking-wide">Concepts</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="src in topSources" :key="src.ref" class="border-b border-ink-50 last:border-0">
                <td class="px-4 py-2.5 font-medium text-ink-800">{{ src.ref }}</td>
                <td class="px-4 py-2.5">
                  <span v-for="tp in src.types" :key="tp" class="badge text-[9px] mr-1" :class="sourceTypeBadge(tp)">{{ tp }}</span>
                </td>
                <td class="text-right px-4 py-2.5 font-mono text-ink-700">{{ src.conceptCount.toLocaleString() }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </template>
  </div>
</template>
