<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import GraphPanel from '../components/GraphPanel.vue';
import { useI18n } from '../i18n';

const store = useVocabularyStore();
const { t } = useI18n();
const graphLoading = ref(true);

// Depend on graphVersion so computed re-evaluates when edges are added
const graphNodes = computed(() => {
  store.graphVersion; // reactivity dependency
  return store.graph.getAllNodes();
});
const graphEdges = computed(() => {
  store.graphVersion; // reactivity dependency
  return store.graph.getEdges();
});

const registers = computed(() =>
  store.datasetList.map(ds => ({
    id: ds.id,
    title: ds.manifest.title,
  }))
);

const totalEdges = computed(() => {
  let sum = 0;
  for (const s of Object.values(store.edgeStatus)) {
    sum += s.count;
  }
  return sum;
});

onMounted(async () => {
  try {
    await store.loadAllGraphData();
  } finally {
    graphLoading.value = false;
  }
});
</script>

<template>
  <div class="flex flex-col" style="height: calc(100vh - 56px)">
    <div class="px-4 sm:px-6 py-3 border-b border-ink-100/60 bg-surface-raised flex items-center gap-3 flex-shrink-0">
      <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400">
        <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors">{{ t('nav.home') }}</router-link>
        <span class="text-ink-200">/</span>
        <span class="text-ink-700">{{ t('nav.graph') }}</span>
      </nav>
      <span class="text-xs text-ink-300 ml-1">
        {{ graphEdges.length.toLocaleString() }} {{ t('graph.edges') }}
      </span>
    </div>
    <div class="flex-1 min-h-0">
      <div v-if="graphLoading" class="flex items-center justify-center h-full">
        <div class="text-center">
          <div class="w-8 h-8 border-2 border-ink-200 border-t-ink-600 rounded-full animate-spin mx-auto mb-3"></div>
          <p class="text-sm text-ink-400">{{ t('graph.loading') }}</p>
        </div>
      </div>
      <GraphPanel v-else :nodes="graphNodes" :edges="graphEdges" :registers="registers" />
    </div>
  </div>
</template>
