<script setup lang="ts">
import { computed } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useUiStore } from '../stores/ui';
import { useRoute, useRouter } from 'vue-router';
import { useDsStyle } from '../utils/dataset-style';
import { useSiteConfig } from '../config/use-site-config';
import NavIcon from './NavIcon.vue';

const store = useVocabularyStore();
const ui = useUiStore();
const router = useRouter();
const route = useRoute();
const { getColor } = useDsStyle();
const { globalPages, datasetPages } = useSiteConfig();

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

function pageRoute(page: { route: string; datasetScoped?: boolean }): string {
  if (!page.route) return '/';
  if (page.datasetScoped) {
    return `/dataset/${currentDataset.value}/${page.route}`;
  }
  return `/${page.route}`;
}

function isActive(page: { route: string; datasetScoped?: boolean }): boolean {
  if (!page.route) return route.name === 'home';
  if (page.datasetScoped) return route.name === page.route;
  return route.name === page.route;
}
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
        <router-link
          v-for="page in globalPages"
          :key="page.route || 'home'"
          :to="pageRoute(page)"
          class="btn-ghost w-full text-left flex items-center gap-2"
          :class="isActive(page) ? 'active' : ''"
          @click="closeMobile"
        >
          <NavIcon :name="page.icon" />
          {{ page.title }}
        </router-link>
      </nav>

      <!-- Dataset-level navigation (shown when viewing a dataset) -->
      <div v-if="currentManifest" class="mb-6">
        <div class="section-label">{{ currentManifest.title }}</div>
        <nav class="space-y-0.5">
          <router-link
            v-for="page in datasetPages"
            :key="page.route || 'concepts'"
            :to="pageRoute(page)"
            class="btn-ghost w-full text-left flex items-center gap-2"
            :class="isActive(page) ? 'active' : ''"
            @click="closeMobile"
          >
            <NavIcon :name="page.icon" />
            {{ page.title }}
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
