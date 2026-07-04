<script setup lang="ts">
import { computed, ref, defineAsyncComponent } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useUiStore } from '../stores/ui';
import { useRoute, useRouter } from 'vue-router';
import { useDsStyle } from '../utils/dataset-style';
import { useSiteConfig } from '../config/use-site-config';
import NavIcon from './NavIcon.vue';
import { useI18n, locale } from '../i18n';
import type { SectionNode } from '../adapters/types';
import { toSectionTree } from '../utils/section-tree';
import { formatSectionLabel, sectionName as sectionLocalized } from '../utils/section-display';

const OntologySidebarSection = defineAsyncComponent(() => import('./OntologySidebarSection.vue'));
import { resolveGroupKind } from '../config/group-types';
import type { DatasetGroupKind } from '../config/types';
import { useDatasetSeries } from '../composables/useDatasetSeries';
const useDatasetSeriesRef = () => useDatasetSeries().series;

const store = useVocabularyStore();
const ui = useUiStore();
const router = useRouter();
const route = useRoute();
const { getColor } = useDsStyle();
const { globalPages, datasetPages, config: siteConfig, localizedTitle, localizedDatasetField, datasetGroups } = useSiteConfig();
const { t } = useI18n();

const currentDataset = computed(() => route.params.registerId as string ?? '');

const isOntologyRoute = computed(() =>
  ['ontology', 'ontology-class', 'ontology-taxonomy', 'ontology-shape', 'ontology-property'].includes(route.name as string)
);

const datasetEntries = computed(() => {
  const entries: { id: string; title: string; ref?: string; loaded: boolean; conceptCount: number }[] = [];
  for (const [id, adapter] of store.datasets) {
    const m = store.manifests.get(id);
    entries.push({
      id,
      title: m?.title ?? id.toUpperCase(),
      ref: m?.ref,
      loaded: !!m,
      conceptCount: m?.conceptCount ?? 0,
    });
  }
  return entries;
});

const datasetIds = computed(() => new Set(datasetEntries.value.map(d => d.id)));

const hasGroups = computed(() => (datasetGroups.value?.length ?? 0) > 0);

interface SidebarGroup {
  id: string;
  label: string;
  description?: string;
  color?: string | { light: string; dark: string };
  kind: DatasetGroupKind;
  entries: { id: string; title: string; ref?: string; loaded: boolean; conceptCount: number; year?: number; status?: string; isCurrent?: boolean }[];
}

const groupedDatasetEntries = computed<SidebarGroup[]>(() => {
  const groups = datasetGroups.value;
  if (!groups?.length) return [];

  const entryMap = new Map(datasetEntries.value.map(e => [e.id, e]));
  const assigned = new Set<string>();
  const result: SidebarGroup[] = [];

  /* Build a quick lookup of series metadata (year, status) from manifests */
  const seriesMeta = new Map<string, { year?: number; status?: string; isCurrent?: boolean }>();
  for (const s of seriesList.value) {
    for (const m of s.members) {
      seriesMeta.set(m.id, { year: m.year, status: m.status, isCurrent: m.isCurrent });
    }
  }

  for (const g of groups) {
    const kind = resolveGroupKind(g);
    const entries = g.datasets
      .map(id => {
        const e = entryMap.get(id);
        if (!e) return null;
        const meta = seriesMeta.get(id);
        return {
          ...e,
          year: meta?.year,
          status: meta?.status,
          isCurrent: meta?.isCurrent,
        };
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);
    for (const e of entries) assigned.add(e.id);
    const trLabel = g.translations?.[locale.value]?.label;
    result.push({
      id: g.id,
      label: trLabel || g.label,
      description: g.description,
      color: g.color,
      kind,
      entries,
    });
  }

  const ungrouped = datasetEntries.value.filter(e => !assigned.has(e.id));
  if (ungrouped.length) {
    result.push({ id: '__ungrouped__', label: '', kind: 'default', entries: ungrouped });
  }

  return result;
});

/* Auto-derive series list from useDatasetSeries — used to enrich entries */
const seriesList = useDatasetSeriesRef();

const collapsedGroups = ref<Set<string>>(new Set());

function toggleGroup(groupId: string) {
  const s = new Set(collapsedGroups.value);
  if (s.has(groupId)) s.delete(groupId);
  else s.add(groupId);
  collapsedGroups.value = s;
}

function isGroupExpanded(groupId: string): boolean {
  return !collapsedGroups.value.has(groupId);
}

// Hide dataset-prefixed pages (e.g. "viml-about") from global nav
const filteredGlobalPages = computed(() =>
  globalPages.value.filter(p => {
    const r = p.route || '';
    return !Array.from(datasetIds.value).some(dsId => r.startsWith(dsId + '-'));
  })
);

// Show only standard dataset pages (Concepts, Statistics, About)
const filteredDatasetPages = computed(() =>
  datasetPages.value.filter(p => ['', 'stats', 'about'].includes(p.route || ''))
);

const currentManifest = computed(() => store.manifests.get(currentDataset.value));
const showDatasetNav = computed(() => !!currentManifest.value || !!siteConfig.value?.defaultDataset);

const provenance = computed(() => {
  const manifest = currentManifest.value;
  return {
    owner: manifest?.owner || siteConfig.value?.branding?.ownerName,
    ownerUrl: siteConfig.value?.branding?.ownerUrl,
    ref: manifest?.ref,
    status: manifest?.status,
    lastUpdated: manifest?.lastUpdated,
    conceptCount: manifest?.conceptCount,
    languageCount: manifest?.languages?.length,
    sourceRepo: manifest?.sourceRepo,
  };
});

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
  const target = pageRoute(page);
  if (route.path === target) return true;
  if (page.datasetScoped) return route.name === page.route;
  // Non-dataset-scoped page: only match if we're NOT inside a dataset route
  const inDataset = 'registerId' in route.params;
  if (inDataset) return false;
  return route.name === page.route || route.name === `${page.route}-global`;
}

function navTitle(page: { route: string; title?: string }): string {
  const route = page.route || 'home';
  const key = `nav.${route}`;
  const translated = t(key);
  return translated === key ? (page.title ?? route) : translated;
}

const expandedSectionNodes = ref<Set<string>>(new Set());

function toggleSectionNode(id: string) {
  const s = new Set(expandedSectionNodes.value);
  if (s.has(id)) s.delete(id);
  else s.add(id);
  expandedSectionNodes.value = s;
}

function getDatasetSections(dsId: string): SectionNode[] {
  const m = store.manifests.get(dsId);
  if (!m?.sections?.length) return [];
  return toSectionTree(m.sections);
}

function sectionLabel(section: SectionNode): string {
  return sectionLocalized(section, locale.value);
}

function sectionDisplay(section: SectionNode): string {
  return formatSectionLabel(section, locale.value);
}

function goToSection(dsId: string, sectionId: string) {
  router.push({ name: 'dataset', params: { registerId: dsId }, query: { section: sectionId } });
  closeMobile();
}

function clearSectionFilter() {
  router.push({ name: 'dataset', params: { registerId: currentDataset.value } });
  closeMobile();
}

const activeSectionId = computed(() => {
  return (route.query.section as string) || null;
});
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
      <div class="section-label">{{ t('nav.navigation') }}</div>
      <nav class="space-y-0.5 mb-6">
        <template v-for="page in filteredGlobalPages" :key="page.route || 'home'">
          <router-link
            :to="pageRoute(page)"
            class="btn-ghost w-full text-left flex items-center gap-2"
            :class="isActive(page) ? 'active' : ''"
            @click="closeMobile"
          >
            <NavIcon :name="page.icon" />
            {{ navTitle(page) }}
          </router-link>

          <!-- Ontology entity sections (lazy-loaded) -->
          <div v-if="page.route === 'ontology' && isOntologyRoute" class="ml-3 mt-1 mb-2">
            <Suspense>
              <OntologySidebarSection />
            </Suspense>
          </div>
        </template>
      </nav>

      <!-- Datasets -->
      <div class="section-label">{{ t('nav.datasets') }}</div>

      <!-- Grouped datasets -->
      <template v-if="hasGroups">
        <div v-for="group in groupedDatasetEntries" :key="group.id" class="mb-2">
          <!-- Group header (skip for ungrouped) -->
          <button
            v-if="group.label"
            @click="toggleGroup(group.id)"
            class="sidebar-group-label w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs font-semibold transition-colors hover:bg-ink-50 dark:hover:bg-ink-700/60"
          >
            <span class="w-3 text-[10px] mt-0.5 flex-shrink-0 text-ink-300 dark:text-ink-400">{{ isGroupExpanded(group.id) ? '▾' : '▸' }}</span>
            <span class="flex-1 text-left leading-snug text-ink-700 dark:text-ink-200 font-serif">{{ group.label }}</span>
          </button>

          <!-- Group entries -->
          <div v-if="isGroupExpanded(group.id)" class="space-y-1" :class="group.label ? 'ml-1' : ''">
            <!-- LINEAGE series: timeline-style entries -->
            <template v-if="group.kind === 'lineage'">
              <div class="series-timeline">
                <button
                  v-for="ds in group.entries"
                  :key="ds.id"
                  @click="goToDataset(ds.id)"
                  class="series-entry w-full text-left flex items-center gap-2 pl-6 pr-3 py-1.5 rounded-md text-sm border-l-2 transition-all duration-150"
                  :class="currentDataset === ds.id
                    ? 'bg-amber-50/70 dark:bg-amber-400/10 border-l-[3px] text-ink-900 dark:text-ink-50 font-semibold'
                    : 'border-transparent text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-700/40 hover:text-ink-900 dark:hover:text-ink-50'"
                  :style="currentDataset === ds.id ? { borderLeftColor: 'var(--gold-accent, #B8935A)' } : {}"
                >
                  <span class="flex-1 truncate text-[13.5px] font-medium leading-snug">{{ ds.ref || ds.title || ds.id }}</span>
                  <span
                    v-if="ds.status && ds.status !== 'valid'"
                    class="text-[9px] uppercase tracking-wide italic text-ink-400 dark:text-ink-400"
                  >{{ ds.status }}</span>
                  <span
                    v-if="ds.isCurrent"
                    class="current-star flex-shrink-0"
                    title="Current edition"
                  >✦</span>
                </button>
              </div>
            </template>

            <!-- REGULAR group: original entry style with expansion -->
            <template v-else>
              <div
                v-for="ds in group.entries"
                :key="ds.id"
                class="rounded-lg transition-all duration-150"
                :class="currentDataset === ds.id ? 'bg-surface' : ''"
              >
                <button
                  @click="goToDataset(ds.id)"
                  class="w-full text-left px-3 py-2 rounded-lg text-sm border-l-2"
                  :class="[
                    currentDataset === ds.id
                      ? 'text-ink-800 dark:text-ink-50'
                      : 'border-transparent text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-700 hover:text-ink-800 dark:hover:text-ink-50'
                  ]"
                  :style="currentDataset === ds.id ? { borderLeftColor: getColor(ds.id), borderLeftWidth: '2px' } : {}"
                >
                  <div class="font-medium truncate leading-snug">{{ localizedDatasetField(ds.id, 'title', ds.title) }}</div>
                  <div v-if="ds.loaded" class="text-xs mt-0.5" :class="currentDataset === ds.id ? 'text-ink-400 dark:text-ink-300' : 'text-ink-300 dark:text-ink-400'">
                    {{ ds.conceptCount.toLocaleString() }} {{ t('home.concepts').toLowerCase() }}
                  </div>
                </button>

                <!-- Expanded dataset: sub-pages + sections + provenance -->
                <div v-if="currentDataset === ds.id && (filteredDatasetPages.length || provenance.owner)" class="px-2 pb-2">
                  <nav v-if="filteredDatasetPages.length" class="space-y-0.5 mt-1">
                    <router-link
                      v-for="page in filteredDatasetPages"
                      :key="page.route || 'concepts'"
                      :to="pageRoute(page)"
                      class="btn-ghost w-full text-left flex items-center gap-2 text-sm"
                      :class="isActive(page) ? 'active' : ''"
                      @click="closeMobile"
                    >
                      <NavIcon :name="page.icon" />
                      {{ navTitle(page) }}
                    </router-link>
                  </nav>

                  <!-- Sections tree -->
                  <div v-if="getDatasetSections(ds.id).length" class="mt-2 pt-2 border-t border-ink-100/60">
                    <button @click="toggleSectionNode(ds.id + '-sections')"
                      class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] uppercase tracking-wide text-ink-400 hover:text-ink-600 hover:bg-ink-50 transition-colors"
                    >
                      <span class="w-3 text-[10px]">{{ expandedSectionNodes.has(ds.id + '-sections') ? '▾' : '▸' }}</span>
                      <span class="flex-1 text-left">{{ t('nav.sections') }}</span>
                      <span class="badge text-[9px] bg-amber-50 text-amber-600 px-1 py-0.5">{{ getDatasetSections(ds.id).length }}</span>
                    </button>
                    <div v-if="expandedSectionNodes.has(ds.id + '-sections')" class="mt-0.5 max-h-64 overflow-y-auto">
                      <button
                        @click="clearSectionFilter()"
                        class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
                        :class="!activeSectionId ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-500 hover:bg-ink-50'"
                      >
                        <span class="w-3 text-ink-200">&#183;</span>
                        <span class="flex-1 text-left">{{ t('dataset.all') }}</span>
                      </button>
                      <template v-for="section in getDatasetSections(ds.id)" :key="section.id">
                        <button @click="goToSection(ds.id, 'section-' + section.id)"
                          class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
                          :class="activeSectionId === 'section-' + section.id ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-500 hover:bg-ink-50'"
                        >
                          <span v-if="section.children?.length" class="text-[10px] text-ink-300 w-3 cursor-pointer" @click.stop="toggleSectionNode(ds.id + '-s-' + section.id)">{{ expandedSectionNodes.has(ds.id + '-s-' + section.id) ? '▾' : '▸' }}</span>
                          <span v-else class="w-3 text-ink-200">&#183;</span>
                          <span class="flex-1 text-left truncate">{{ sectionDisplay(section) }}</span>
                        </button>
                        <div v-if="section.children?.length && expandedSectionNodes.has(ds.id + '-s-' + section.id)" class="ml-3">
                          <button v-for="child in section.children" :key="child.id"
                            @click="goToSection(ds.id, 'section-' + child.id)"
                            class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
                            :class="activeSectionId === 'section-' + child.id ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-400 hover:bg-ink-50'"
                          >
                            <span class="w-3 text-ink-200">&#183;</span>
                            <span class="flex-1 text-left truncate">{{ sectionDisplay(child) }}</span>
                          </button>
                        </div>
                      </template>
                    </div>
                  </div>

                  <div v-if="provenance.owner" class="mt-3 pt-3 border-t border-ink-100/60">
                    <div class="text-[11px] text-ink-300 space-y-1.5 px-1">
                      <div v-if="provenance.ref" class="text-xs font-semibold text-ink-700">
                        {{ provenance.ref }}
                      </div>
                      <div class="flex items-center gap-1">
                        <span class="text-ink-400">{{ t('sidebar.publishedBy') }}</span>
                        <a v-if="provenance.ownerUrl" :href="provenance.ownerUrl" target="_blank" rel="noopener" class="concept-link font-medium">{{ provenance.owner }}</a>
                        <span v-else class="text-ink-600 font-medium">{{ provenance.owner }}</span>
                      </div>
                      <div v-if="provenance.sourceRepo">
                        <a :href="provenance.sourceRepo" target="_blank" rel="noopener" class="concept-link">{{ t('sidebar.viewSource') }}</a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </template>

      <!-- Flat dataset list (fallback when no groups) -->
      <nav v-else class="space-y-1">
        <div
          v-for="ds in datasetEntries"
          :key="ds.id"
          class="rounded-lg transition-all duration-150"
          :class="currentDataset === ds.id ? 'bg-surface' : ''"
        >
          <button
            @click="goToDataset(ds.id)"
            class="w-full text-left px-3 py-2.5 rounded-lg text-sm border-l-2"
            :class="[
              currentDataset === ds.id
                ? 'text-ink-800 dark:text-ink-50'
                : 'border-transparent text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-700 hover:text-ink-800 dark:hover:text-ink-50'
            ]"
            :style="currentDataset === ds.id ? { borderLeftColor: getColor(ds.id), borderLeftWidth: '2px' } : {}"
          >
            <div class="font-medium truncate leading-snug">{{ localizedDatasetField(ds.id, 'title', ds.title) }}</div>
            <div v-if="ds.loaded" class="text-xs mt-0.5" :class="currentDataset === ds.id ? 'text-ink-400 dark:text-ink-300' : 'text-ink-300 dark:text-ink-400'">
              {{ ds.conceptCount.toLocaleString() }} {{ t('home.concepts').toLowerCase() }}
            </div>
          </button>

          <!-- Expanded dataset: sub-pages + provenance -->
          <div v-if="currentDataset === ds.id && (filteredDatasetPages.length || provenance.owner)" class="px-2 pb-2">
            <!-- Sub-pages -->
            <nav v-if="filteredDatasetPages.length" class="space-y-0.5 mt-1">
              <router-link
                v-for="page in filteredDatasetPages"
                :key="page.route || 'concepts'"
                :to="pageRoute(page)"
                class="btn-ghost w-full text-left flex items-center gap-2 text-sm"
                :class="isActive(page) ? 'active' : ''"
                @click="closeMobile"
              >
                <NavIcon :name="page.icon" />
                {{ navTitle(page) }}
              </router-link>
            </nav>

            <!-- Sections tree -->
            <div v-if="getDatasetSections(ds.id).length" class="mt-2 pt-2 border-t border-ink-100/60">
              <button @click="toggleSectionNode(ds.id + '-sections')"
                class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] uppercase tracking-wide text-ink-400 hover:text-ink-600 hover:bg-ink-50 transition-colors"
              >
                <span class="w-3 text-[10px]">{{ expandedSectionNodes.has(ds.id + '-sections') ? '▾' : '▸' }}</span>
                <span class="flex-1 text-left">{{ t('nav.sections') }}</span>
                <span class="badge text-[9px] bg-amber-50 text-amber-600 px-1 py-0.5">{{ getDatasetSections(ds.id).length }}</span>
              </button>
              <div v-if="expandedSectionNodes.has(ds.id + '-sections')" class="mt-0.5 max-h-64 overflow-y-auto">
                <button
                  @click="clearSectionFilter()"
                  class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
                  :class="!activeSectionId ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-500 hover:bg-ink-50'"
                >
                  <span class="w-3 text-ink-200">&#183;</span>
                  <span class="flex-1 text-left">{{ t('dataset.all') }}</span>
                </button>
                <template v-for="section in getDatasetSections(ds.id)" :key="section.id">
                  <button @click="goToSection(ds.id, 'section-' + section.id)"
                    class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
                    :class="activeSectionId === 'section-' + section.id ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-500 hover:bg-ink-50'"
                  >
                    <span v-if="section.children?.length" class="text-[10px] text-ink-300 w-3 cursor-pointer" @click.stop="toggleSectionNode(ds.id + '-s-' + section.id)">{{ expandedSectionNodes.has(ds.id + '-s-' + section.id) ? '▾' : '▸' }}</span>
                    <span v-else class="w-3 text-ink-200">&#183;</span>
                    <span class="flex-1 text-left">{{ sectionLabel(section) }}</span>
                  </button>
                  <div v-if="section.children?.length && expandedSectionNodes.has(ds.id + '-s-' + section.id)" class="ml-3">
                    <button v-for="child in section.children" :key="child.id"
                      @click="goToSection(ds.id, 'section-' + child.id)"
                      class="w-full flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] transition-colors"
                      :class="activeSectionId === 'section-' + child.id ? 'bg-ink-800/8 text-blue-700 font-medium' : 'text-ink-400 hover:bg-ink-50'"
                    >
                      <span class="w-3 text-ink-200">&#183;</span>
                      <span class="flex-1 text-left">{{ sectionLabel(child) }}</span>
                    </button>
                  </div>
                </template>
              </div>
            </div>

            <!-- Provenance -->
            <div v-if="provenance.owner" class="mt-3 pt-3 border-t border-ink-100/60">
              <div class="text-[11px] text-ink-300 space-y-1.5 px-1">
                <div v-if="provenance.ref" class="text-xs font-semibold text-ink-700">
                  {{ provenance.ref }}
                </div>
                <div class="flex items-center gap-1">
                  <span class="text-ink-400">{{ t('sidebar.publishedBy') }}</span>
                  <a v-if="provenance.ownerUrl" :href="provenance.ownerUrl" target="_blank" rel="noopener" class="concept-link font-medium">{{ provenance.owner }}</a>
                  <span v-else class="text-ink-600 font-medium">{{ provenance.owner }}</span>
                </div>
                <div v-if="provenance.sourceRepo">
                  <a :href="provenance.sourceRepo" target="_blank" rel="noopener" class="concept-link">{{ t('sidebar.viewSource') }}</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>
    </div>
  </aside>
</template>

<style scoped>
/* Series timeline entries — used when a dataset group has `series: true`.
   Renders editions as compact year-tagged rows instead of the full dataset
   entry, since within a series the year IS the identity. */
.series-timeline {
  position: relative;
  padding-left: 0;
  margin-top: 4px;
}
/* No vertical rail line — the star indicator is enough cue. */

.series-entry {
  position: relative;
  /* All visual states (bg, text color, border) are inline Tailwind classes
     so dark: variants apply with reliable specificity. */
}

/* Star (✦ U+2726, four-pointed) indicates ONE thing only: "is this the
   current/newest valid edition?" Data property — never reflects viewing
   state. Sits at the right edge of the entry so the ref text aligns to
   the left consistently across current and non-current editions. */
.current-star {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  color: var(--gold-accent, #B8935A);
  filter: drop-shadow(0 0 4px rgba(184, 147, 90, 0.45));
}
:global(.dark) .current-star {
  color: var(--gold-accent, #D4AF6E);
  filter: drop-shadow(0 0 4px rgba(212, 175, 110, 0.55));
}

</style>
