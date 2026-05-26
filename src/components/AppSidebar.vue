<script setup lang="ts">
import { computed } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useUiStore } from '../stores/ui';
import { useRoute, useRouter } from 'vue-router';
import { useDsStyle } from '../utils/dataset-style';
import { useSiteConfig } from '../config/use-site-config';
import { useOntologyNav, compactToSlug } from '../composables/use-ontology-nav';
import NavIcon from './NavIcon.vue';

const store = useVocabularyStore();
const ui = useUiStore();
const router = useRouter();
const route = useRoute();
const { getColor } = useDsStyle();
const { globalPages, datasetPages, config: siteConfig } = useSiteConfig();

const currentDataset = computed(() => route.params.registerId as string ?? '');

const {
  expandedClasses,
  taxonomyKeys,
  taxonomyLabels,
  treeRoots,
  toggleExpand,
  childClasses,
  hasChildren,
} = useOntologyNav();

const isOntologyRoute = computed(() =>
  route.name === 'ontology' || route.name === 'ontology-class' || route.name === 'ontology-taxonomy'
);

const activeClassId = computed(() => {
  if (route.name !== 'ontology-class') return null;
  const slug = route.params.classId as string;
  return slug.replace(/-/g, ':');
});

const activeTaxonomy = computed(() => {
  if (route.name !== 'ontology-taxonomy') return null;
  return route.params.taxonomyKey as string;
});

const isOverview = computed(() => route.name === 'ontology');

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
const showDatasetNav = computed(() => !!currentManifest.value || !!siteConfig.value?.defaultDataset);

function closeMobile() { ui.sidebarOpen = false; }

function goToDataset(id: string) {
  router.push({ name: 'dataset', params: { registerId: id } });
  closeMobile();
}

function pageRoute(page: { route: string; datasetScoped?: boolean }): string {
  if (!page.route) return '/';
  if (page.datasetScoped) {
    const dsId = currentDataset.value || siteConfig.value?.defaultDataset || '';
    return `/dataset/${dsId}/${page.route}`;
  }
  return `/${page.route}`;
}

function isActive(page: { route: string; datasetScoped?: boolean }): boolean {
  if (!page.route) {
    if (page.datasetScoped) return route.name === 'dataset' || route.name === 'concept';
    return route.name === 'home';
  }
  return route.name === page.route;
}

function selectClass(id: string) {
  router.push(`/ontology/class/${compactToSlug(id)}`);
}

function selectTaxonomy(key: string) {
  router.push(`/ontology/taxonomy/${key}`);
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
        <template v-for="page in globalPages" :key="page.route || 'home'">
          <router-link
            :to="pageRoute(page)"
            class="btn-ghost w-full text-left flex items-center gap-2"
            :class="isActive(page) ? 'active' : ''"
            @click="closeMobile"
          >
            <NavIcon :name="page.icon" />
            {{ page.title }}
          </router-link>

          <!-- Ontology class tree nested under Ontology nav item -->
          <div v-if="page.route === 'ontology' && isOntologyRoute" class="ml-4 mt-1 mb-2 space-y-0.5">
            <!-- Overview -->
            <router-link to="/ontology"
              class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors"
              :class="isOverview ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-600 hover:bg-ink-50'"
            >
              <span class="w-3 text-ink-200">·</span>
              <span class="flex-1 text-left">Overview</span>
            </router-link>

            <div class="text-[10px] uppercase tracking-wide text-ink-300 mt-2 mb-1 px-2">Classes</div>
            <template v-for="root in treeRoots" :key="root.compact">
              <button @click="selectClass(root.compact); toggleExpand(root)"
                class="w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs transition-colors"
                :class="activeClassId === root.compact && !activeTaxonomy ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-600 hover:bg-ink-50'"
              >
                <span v-if="hasChildren(root)" class="text-[10px] text-ink-300 w-3">{{ expandedClasses.has(root.compact) ? '▾' : '▸' }}</span>
                <span v-else class="w-3 text-ink-200">·</span>
                <span class="flex-1 text-left">{{ root.label }}</span>
              </button>
              <!-- Children -->
              <div v-if="expandedClasses.has(root.compact) && hasChildren(root)" class="ml-3">
                <template v-for="child in childClasses(root.compact)" :key="child.compact">
                  <button @click="selectClass(child.compact); toggleExpand(child)"
                    class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
                    :class="activeClassId === child.compact && !activeTaxonomy ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-500 hover:bg-ink-50'"
                  >
                    <span v-if="hasChildren(child)" class="text-[10px] text-ink-300 w-3">{{ expandedClasses.has(child.compact) ? '▾' : '▸' }}</span>
                    <span v-else class="w-3 text-ink-200">·</span>
                    <span class="flex-1 text-left">{{ child.label }}</span>
                  </button>
                  <!-- Grandchildren -->
                  <div v-if="expandedClasses.has(child.compact) && hasChildren(child)" class="ml-3">
                    <button v-for="gc in childClasses(child.compact)" :key="gc.compact"
                      @click="selectClass(gc.compact)"
                      class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
                      :class="activeClassId === gc.compact && !activeTaxonomy ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-400 hover:bg-ink-50'"
                    >
                      <span class="w-3 text-ink-200">·</span>
                      <span class="flex-1 text-left">{{ gc.label }}</span>
                    </button>
                  </div>
                </template>
              </div>
            </template>

            <!-- SKOS Taxonomies -->
            <div class="mt-2 pt-2 border-t border-ink-100/40">
              <div class="text-[10px] uppercase tracking-wide text-ink-300 mb-1 px-2">Taxonomies</div>
              <button v-for="tk in taxonomyKeys" :key="tk"
                @click="selectTaxonomy(tk)"
                class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
                :class="activeTaxonomy === tk ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-400 hover:bg-ink-50'"
              >
                <span class="w-3 text-ink-200">·</span>
                <span class="flex-1 text-left">{{ taxonomyLabels[tk] }}</span>
              </button>
            </div>
          </div>
        </template>
      </nav>

      <!-- Dataset-level navigation (shown when viewing a dataset) -->
      <div v-if="showDatasetNav" class="mb-6">
        <div class="section-label">{{ currentManifest?.title || siteConfig?.title || 'Dataset' }}</div>
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

      <!-- Powered by -->
      <div class="mt-6 pt-4 border-t border-ink-100/60">
        <div class="text-[11px] text-ink-300">
          <a
            :href="(siteConfig?.features?.poweredBy as any)?.url || 'https://github.com/glossarist/concept-browser'"
            target="_blank"
            rel="noopener"
            class="concept-link"
          >{{ (siteConfig?.features?.poweredBy as any)?.message || 'Built with the Glossarist Concept Browser' }}</a>
        </div>
      </div>
    </div>
  </aside>
</template>
