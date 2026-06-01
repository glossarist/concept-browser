<script setup lang="ts">
import { computed, ref } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useRouter } from 'vue-router';
import { useDsStyle } from '../utils/dataset-style';
import { useSiteConfig } from '../config/use-site-config';
import { useI18n } from '../i18n';

const store = useVocabularyStore();
const router = useRouter();
const { getStyle } = useDsStyle();
const { config: siteConfig, localizedTitle, localizedSubtitle, localizedDescription } = useSiteConfig();
const { t } = useI18n();
const exploring = ref(false);

async function exploreRandom() {
  exploring.value = true;
  try {
    if (!store.initialized) await store.discoverDatasets();
    const loaded = [...store.datasets.values()].filter(a => a.index);
    if (!loaded.length) {
      const first = filteredDatasets.value[0];
      if (first) await store.loadDataset(first.id);
    }
    const result = await store.getRandomConcept();
    if (result) {
      await store.viewConcept(result.registerId, result.conceptId);
      router.push({ name: 'concept', params: { registerId: result.registerId, conceptId: result.conceptId } });
    }
  } finally {
    exploring.value = false;
  }
}

const filteredDatasets = computed(() => {
  if (!siteConfig.value) return store.datasetList;
  const allowed = new Set(siteConfig.value.datasets);
  return store.datasetList.filter(ds => allowed.has(ds.id));
});

const totalConcepts = computed(() =>
  filteredDatasets.value.reduce((sum, ds) => sum + ds.manifest.conceptCount, 0)
);

const totalLanguages = computed(() => {
  const langs = new Set<string>();
  for (const ds of filteredDatasets.value) {
    for (const l of ds.manifest.languages) langs.add(l);
  }
  return langs.size;
});

function goToDataset(id: string) {
  router.push({ name: 'dataset', params: { registerId: id } });
}
function goToSearch() { router.push({ name: 'search' }); }
function goToGraph() { router.push({ name: 'graph' }); }
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10">
    <!-- Hero -->
    <div class="mb-10 sm:mb-14">
      <div class="flex items-center gap-2 mb-4">
        <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-300">{{ siteConfig?.branding?.ownerName || 'Glossarist' }}</span>
        <template v-if="siteConfig?.subtitle">
          <span class="w-4 sm:w-6 h-px bg-ink-200"></span>
          <span class="text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-300 hidden sm:inline">{{ localizedSubtitle }}</span>
        </template>
      </div>
      <h1 class="font-serif text-[2rem] sm:text-[2.75rem] text-ink-800 leading-[1.1] mb-4 tracking-tight">
        {{ localizedTitle }}
        <template v-if="localizedSubtitle"><br class="hidden sm:block" /> {{ localizedSubtitle }}</template>
      </h1>
      <p class="text-base text-ink-400 max-w-lg leading-relaxed">
        {{ localizedDescription || 'Explore standardized terminology datasets from ISO and IEC technical committees. Browse concepts, definitions, and cross-references across multilingual vocabularies.' }}
      </p>
      <div class="flex flex-wrap gap-3 mt-7">
        <button @click="goToSearch" class="btn-primary flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          {{ t('home.search') }}
        </button>
        <button @click="goToGraph" class="btn-secondary flex items-center gap-2">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
          {{ t('home.graphView') }}
        </button>
        <button @click="exploreRandom" :disabled="exploring" class="btn-secondary flex items-center gap-2">
          <svg v-if="!exploring" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
          <svg v-else class="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
          {{ exploring ? t('home.exploring') : t('home.surpriseMe') }}
        </button>
      </div>
    </div>

    <!-- Stats -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-px bg-ink-100/60 rounded-xl overflow-hidden mb-10 sm:mb-14">
      <div class="bg-surface-raised px-4 sm:px-6 py-5 animate-entrance" style="animation-delay: 80ms">
        <div class="text-3xl font-serif text-ink-800 tabular-nums">{{ filteredDatasets.length }}</div>
        <div class="text-sm text-ink-400 mt-1">{{ t('home.datasets') }}</div>
      </div>
      <div class="bg-surface-raised px-6 py-5 animate-entrance" style="animation-delay: 140ms">
        <div class="text-3xl font-serif text-ink-800 tabular-nums">{{ totalConcepts.toLocaleString() }}</div>
        <div class="text-sm text-ink-400 mt-1">{{ t('home.concepts') }}</div>
      </div>
      <div class="bg-surface-raised px-6 py-5 animate-entrance" style="animation-delay: 200ms">
        <div class="text-3xl font-serif text-ink-800 tabular-nums">{{ totalLanguages }}</div>
        <div class="text-sm text-ink-400 mt-1">{{ t('home.languages') }}</div>
      </div>
    </div>

    <!-- Dataset section -->
    <template v-if="filteredDatasets.length === 1">
      <button
        @click="goToDataset(filteredDatasets[0].id)"
        class="card-hover p-8 text-left group animate-entrance max-w-md"
        :style="{ borderLeft: `3px solid ${getStyle(filteredDatasets[0].id).color}` }"
      >
        <div class="flex items-center gap-3 mb-3">
          <span class="w-3 h-3 rounded-full flex-shrink-0" :style="{ backgroundColor: getStyle(filteredDatasets[0].id).color }"></span>
          <h2 class="font-serif text-xl text-ink-800 group-hover:text-ink-900 transition-colors">
            {{ filteredDatasets[0].manifest.title }}
          </h2>
        </div>
        <p v-if="filteredDatasets[0].manifest.description" class="text-sm text-ink-400 mb-4 line-clamp-2 leading-relaxed pl-6">
          {{ filteredDatasets[0].manifest.description }}
        </p>
        <div class="flex items-center gap-3 pl-6 mb-4">
          <span :style="{ color: getStyle(filteredDatasets[0].id).color }" class="text-sm font-semibold tabular-nums">{{ filteredDatasets[0].manifest.conceptCount.toLocaleString() }}</span>
          <span class="text-xs text-ink-300">{{ t('home.concepts').toLowerCase() }}</span>
          <span class="text-ink-200 text-xs">&middot;</span>
          <span class="text-sm text-ink-500 tabular-nums">{{ filteredDatasets[0].manifest.languages.length }}</span>
          <span class="text-xs text-ink-300">{{ t('home.languages').toLowerCase() }}</span>
        </div>
        <div class="pl-6">
          <span class="btn-primary inline-flex items-center gap-2">
            {{ t('home.browseConcepts') }}
            <svg class="w-4 h-4 group-hover:translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </span>
        </div>
      </button>
    </template>
    <template v-else-if="filteredDatasets.length > 1">
      <div class="flex items-center justify-between mb-5">
        <div class="section-label mb-0">{{ t('home.availableDatasets') }}</div>
        <span class="text-xs text-ink-300">{{ t('home.clickToBrowse') }}</span>
      </div>
      <div :class="[
        filteredDatasets.length === 2 ? 'max-w-3xl' : '',
        'grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      ]">
        <button
          v-for="(ds, idx) in filteredDatasets"
          :key="ds.id"
          @click="goToDataset(ds.id)"
          class="card-hover p-6 text-left group animate-entrance"
          :style="{ borderLeft: `3px solid ${getStyle(ds.id).color}`, animationDelay: `${idx * 60}ms` }"
        >
          <div class="flex items-start gap-3 mb-4">
            <span class="w-2.5 h-2.5 rounded-full mt-1.5 flex-shrink-0" :style="{ backgroundColor: getStyle(ds.id).color }"></span>
            <div class="min-w-0">
              <h2 class="font-serif text-xl text-ink-800 leading-snug group-hover:text-ink-900 transition-colors">
                {{ ds.manifest.title }}
              </h2>
            </div>
          </div>

          <p class="text-sm text-ink-400 mb-5 line-clamp-2 leading-relaxed pl-[22px]">
            {{ ds.manifest.description }}
          </p>

          <div class="flex items-center gap-3 pl-[22px] mb-3">
            <span :style="{ color: getStyle(ds.id).color }" class="text-sm font-semibold tabular-nums">{{ ds.manifest.conceptCount.toLocaleString() }}</span>
            <span class="text-xs text-ink-300">{{ t('home.concepts').toLowerCase() }}</span>
            <span class="text-ink-200 text-xs">&middot;</span>
            <span class="text-sm text-ink-500 tabular-nums">{{ ds.manifest.languages.length }}</span>
            <span class="text-xs text-ink-300">{{ t('home.languages').toLowerCase() }}</span>
          </div>

          <div class="flex flex-wrap gap-1.5 pl-[22px] mb-3">
            <span v-for="tag in (ds.manifest.tags ?? []).slice(0, 3)" :key="tag" class="badge text-[10px]" :style="{ backgroundColor: getStyle(ds.id).light, color: getStyle(ds.id).dark }">
              {{ tag }}
            </span>
          </div>

          <div class="flex items-center justify-between pl-[22px]">
            <span class="text-[11px] text-ink-300">{{ ds.manifest.owner }}</span>
            <svg class="w-4 h-4 text-ink-200 group-hover:text-ink-400 group-hover:translate-x-0.5 transition-all" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
            </svg>
          </div>
        </button>
      </div>
    </template>
  </div>
</template>
