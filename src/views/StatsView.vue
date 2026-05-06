<script setup lang="ts">
import { computed } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useDsStyle } from '../utils/dataset-style';
import { useDatasetLoader } from '../composables/use-dataset-loader';
import { langName, langLabel } from '../utils/lang';

const props = defineProps<{ registerId: string }>();

const store = useVocabularyStore();
const { getColor } = useDsStyle();
const { loading, localError, ensureLoaded } = useDatasetLoader(() => props.registerId);

const manifest = computed(() => store.manifests.get(props.registerId));

interface LangStat {
  lang: string;
  terms: number;
  definitions: number;
}

const stats = computed(() => {
  const m = manifest.value;
  if (!m) return { langs: [], total: 0 };

  const ls = m.languageStats || {};
  const langs: LangStat[] = m.languages.map(lang => ({
    lang,
    terms: ls[lang]?.terms ?? 0,
    definitions: ls[lang]?.definitions ?? 0,
  }));

  // Sort: eng first, then by term count descending
  langs.sort((a, b) => {
    if (a.lang === 'eng') return -1;
    if (b.lang === 'eng') return 1;
    return b.terms - a.terms;
  });

  return { langs, total: m.conceptCount };
});

const maxTerms = computed(() => Math.max(...stats.value.langs.map(l => l.terms), 1));
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Breadcrumb -->
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
      <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors">Home</router-link>
      <span class="text-ink-200">/</span>
      <router-link :to="{ name: 'dataset', params: { registerId } }" class="hover:text-ink-700 transition-colors">{{ manifest?.title || registerId }}</router-link>
      <span class="text-ink-200">/</span>
      <span class="text-ink-700">Statistics</span>
    </nav>

    <template v-if="loading">
      <div class="animate-pulse space-y-6">
        <div class="h-8 bg-ink-100 rounded w-32"></div>
        <div class="h-4 bg-ink-100 rounded w-64"></div>
        <div class="card overflow-hidden">
          <div class="h-80 bg-ink-50"></div>
        </div>
      </div>
    </template>
    <template v-else-if="localError">
      <div class="card p-8 border-red-200 bg-red-50/50 text-center">
        <p class="text-red-700 font-medium mb-1">Failed to load statistics</p>
        <p class="text-sm text-red-600/80 mb-4">{{ localError }}</p>
        <button @click="ensureLoaded" class="btn-primary">Retry</button>
      </div>
    </template>
    <template v-else-if="manifest">
      <h1 class="font-serif text-3xl text-ink-800 mb-2">Statistics</h1>
      <p class="text-ink-400 mb-8">
        {{ stats.total.toLocaleString() }} concepts across {{ manifest.languages.length }} languages.
      </p>

      <!-- Language stats table -->
      <div class="card -mx-4 sm:mx-0 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-ink-100/60 bg-ink-50/50">
              <th class="text-left px-5 py-3 text-ink-500 font-medium">Language</th>
              <th class="text-right px-5 py-3 text-ink-500 font-medium">Terms</th>
              <th class="text-right px-5 py-3 text-ink-500 font-medium">Definitions</th>
              <th class="px-5 py-3 text-ink-500 font-medium w-40"></th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="s in stats.langs" :key="s.lang" class="border-b border-ink-50 last:border-0">
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <span class="text-xs font-semibold text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ langLabel(s.lang) }}</span>
                  <span class="font-medium text-ink-800">{{ langName(s.lang) }}</span>
                  <span class="text-ink-300 text-xs">({{ s.lang }})</span>
                </div>
              </td>
              <td class="text-right px-5 py-3 font-mono text-ink-700">{{ s.terms.toLocaleString() }}</td>
              <td class="text-right px-5 py-3 font-mono text-ink-700">{{ s.definitions.toLocaleString() }}</td>
              <td class="px-5 py-3">
                <div class="flex items-center gap-2">
                  <div class="h-2 rounded-full bg-ink-50 overflow-hidden flex-1">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :style="{
                        width: (s.terms / maxTerms * 100) + '%',
                        backgroundColor: getColor(registerId),
                      }"
                    ></div>
                  </div>
                  <span class="text-xs text-ink-300 w-10 text-right tabular-nums">{{ Math.round(s.terms / maxTerms * 100) }}%</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </div>
</template>
