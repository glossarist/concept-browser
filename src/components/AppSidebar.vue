<script setup lang="ts">
import { computed } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useUiStore } from '../stores/ui';
import { useRoute, useRouter } from 'vue-router';
import { useDsStyle } from '../utils/dataset-style';
import { useSiteConfig } from '../config/use-site-config';

const store = useVocabularyStore();
const ui = useUiStore();
const router = useRouter();
const route = useRoute();
const { getColor } = useDsStyle();
const { config: siteConfig } = useSiteConfig();

const currentDataset = computed(() => (route.params as any).registerId ?? '');

const datasetEntries = computed(() => {
  const entries: { id: string; title: string; loaded: boolean; conceptCount: number }[] = [];
  for (const [id, adapter] of store.datasets) {
    const m = store.manifests.get(id);
    entries.push({
      id,
      title: m?.title ?? id.toUpperCase(),
      loaded: !!m,
      conceptCount: m?.conceptCount ?? 0,
    });
  }
  return entries;
});

const currentManifest = computed(() => store.manifests.get(currentDataset.value));

function closeMobile() { ui.sidebarOpen = false; }

function goToDataset(id: string) {
  router.push({ name: 'dataset', params: { registerId: id } });
  closeMobile();
}
function goHome() { router.push({ name: 'home' }); closeMobile(); }
function goSearch() { router.push({ name: 'search' }); closeMobile(); }
function goGraph() { router.push({ name: 'graph' }); closeMobile(); }
function goNews() { router.push({ name: 'news' }); closeMobile(); }
</script>

<template>
  <!-- Mobile backdrop -->
  <div v-if="ui.sidebarOpen" @click="closeMobile" class="lg:hidden fixed inset-0 bg-ink-800/30 z-40"></div>

  <!-- Sidebar -->
  <aside
    :class="ui.sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'"
    class="fixed lg:static inset-y-0 left-0 z-50 w-60 bg-surface-raised border-r border-ink-100/80 overflow-y-auto flex-shrink-0 transition-transform duration-200 lg:transition-none"
    style="top: 56px;"
  >
    <div class="p-4">
      <!-- Navigation -->
      <div class="section-label">Navigation</div>
      <nav class="space-y-0.5 mb-6">
        <button @click="goHome" :class="route.name === 'home' ? 'active' : ''" class="btn-ghost w-full text-left flex items-center gap-2">
          <svg class="w-4 h-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"/></svg>
          Home
        </button>
        <button @click="goSearch" :class="route.name === 'search' ? 'active' : ''" class="btn-ghost w-full text-left flex items-center gap-2">
          <svg class="w-4 h-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
          Search
        </button>
        <button @click="goGraph" :class="route.name === 'graph' ? 'active' : ''" class="btn-ghost w-full text-left flex items-center gap-2">
          <svg class="w-4 h-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"/></svg>
          Graph
        </button>
        <button v-if="siteConfig?.features?.news" @click="goNews" :class="route.name === 'news' ? 'active' : ''" class="btn-ghost w-full text-left flex items-center gap-2">
          <svg class="w-4 h-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"/></svg>
          News
        </button>
      </nav>

      <!-- Dataset-level navigation (shown when viewing a dataset) -->
      <div v-if="currentManifest" class="mb-6">
        <div class="section-label">{{ currentManifest.title }}</div>
        <nav class="space-y-0.5">
          <router-link
            :to="{ name: 'dataset', params: { registerId: currentDataset } }"
            class="btn-ghost w-full text-left flex items-center gap-2"
            :class="route.name === 'dataset' ? 'active' : ''"
            @click="closeMobile"
          >
            <svg class="w-4 h-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 10h16M4 14h16M4 18h16"/></svg>
            Concepts
          </router-link>
          <router-link
            :to="{ name: 'stats', params: { registerId: currentDataset } }"
            class="btn-ghost w-full text-left flex items-center gap-2"
            :class="route.name === 'stats' ? 'active' : ''"
            @click="closeMobile"
          >
            <svg class="w-4 h-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
            Statistics
          </router-link>
          <router-link
            :to="{ name: 'about', params: { registerId: currentDataset } }"
            class="btn-ghost w-full text-left flex items-center gap-2"
            :class="route.name === 'about' ? 'active' : ''"
            @click="closeMobile"
          >
            <svg class="w-4 h-4 text-ink-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
            About
          </router-link>
        </nav>
      </div>

      <!-- Datasets -->
      <div class="section-label">Datasets</div>
      <nav class="space-y-1">
        <button
          v-for="ds in datasetEntries"
          :key="ds.id"
          @click="goToDataset(ds.id)"
          class="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all duration-150 border-l-2"
          :class="[
            currentDataset === ds.id
              ? 'bg-surface text-ink-800'
              : 'border-transparent text-ink-600 hover:bg-ink-50 hover:text-ink-800'
          ]"
          :style="currentDataset === ds.id ? { borderLeftColor: getColor(ds.id), borderLeftWidth: '2px' } : {}"
        >
          <div class="font-medium truncate leading-snug">{{ ds.title }}</div>
          <div v-if="ds.loaded" class="text-xs mt-0.5" :class="currentDataset === ds.id ? 'text-ink-400' : 'text-ink-300'">
            {{ ds.conceptCount.toLocaleString() }} concepts
          </div>
        </button>
      </nav>

      <!-- Graph stats -->
      <div class="mt-6 pt-4 border-t border-ink-100/60">
        <div class="text-[11px] text-ink-300 space-y-0.5">
          <div>{{ store.graph.nodeCount.toLocaleString() }} graph nodes</div>
          <div>{{ store.graph.edgeCount.toLocaleString() }} edges</div>
        </div>
      </div>
    </div>
  </aside>
</template>
