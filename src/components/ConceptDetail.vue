<script setup lang="ts">
import type { Concept, LocalizedConcept, Designation } from 'glossarist';
import type { Manifest, GraphEdge } from '../adapters/types';
import { computed, ref, nextTick, watch } from 'vue';
import { langName } from '../utils/lang';
import { renderContent } from '../utils/content-renderer';
import type { RenderOptions } from '../utils/content-renderer';
import { escapeAttr } from '../utils/escape';
import { entryStatusColor, conceptStatusColor, conceptStatusLabel, conceptStatusDefinition, entryStatusLabel, entryStatusDefinition, getPreferredTerm } from '../utils/concept-helpers';
import { sourceTypeInfo, sourceStatusInfo } from '../utils/designation-registry';
import { conceptUri } from '../adapters/model-bridge';
import { useRouter } from 'vue-router';
import { useVocabularyStore } from '../stores/vocabulary';
import { useDsStyle } from '../utils/dataset-style';
import { getFactory } from '../adapters/factory';
import { useRenderOptions } from '../composables/use-render-options';
import { useConceptEdges } from '../composables/use-concept-edges';
import { useConceptContent } from '../composables/use-concept-content';
import { relationshipLabel, INVERSE_RELATIONSHIPS } from '../utils/relationship-categories';
import { slugify } from '../utils/slugify';
import { useSiteConfig } from '../config/use-site-config';
import ConceptTimeline from './ConceptTimeline.vue';
import ConceptRdfView from './ConceptRdfView.vue';
import FormatDownloads from './FormatDownloads.vue';
import NonVerbalRepDisplay from './NonVerbalRepDisplay.vue';
import CitationDisplay from './CitationDisplay.vue';
import DesignationList from './DesignationList.vue';
import { useI18n } from '../i18n';

const { t, locale } = useI18n();

const props = defineProps<{
  concept: Concept;
  manifest: Manifest;
  edges: GraphEdge[];
  registerId: string;
  adjacent: { prev: string | null; next: string | null };
}>();

const router = useRouter();
const store = useVocabularyStore();
const { getColor } = useDsStyle();
const { config: siteConfig, localizedDatasetField } = useSiteConfig();

const activeTab = ref<'rdf' | 'definition' | 'history'>('definition');
const activeHistoryLang = ref('eng');

const conceptId = computed(() => props.concept.id);

const conceptPosition = computed(() => {
  const adapter = store.datasets.get(props.registerId);
  if (!adapter?.index) return null;
  const idx = adapter.getConceptPosition(conceptId.value);
  if (idx < 0) return null;
  return { index: idx + 1, total: adapter.getConceptCount() };
});

const conceptComputed = computed(() => props.concept);
const registerIdComputed = computed(() => props.registerId);
const manifestComputed = computed(() => props.manifest);
const edgesComputed = computed(() => props.edges);

const {
  conceptUriValue,
  outgoingEdges,
  incomingEdges,
  getEdgeDisplay,
  edgeBadgeColor,
  inverseEdgeType,
  conceptRelated,
  getResolvedRef,
  relatedLabel,
  navigateEdge,
  navigateRelated,
} = useConceptEdges(conceptComputed, registerIdComputed, manifestComputed, edgesComputed, router);

const hoveredEdgeDisplay = ref<{ designation: string; conceptId: string; tooltip: string } | null>(null);

const uriCopied = ref(false);
function copyUri() {
  const uri = conceptUri(props.concept, props.registerId, props.manifest.uriBase);
  navigator.clipboard.writeText(uri).then(() => {
    uriCopied.value = true;
    setTimeout(() => { uriCopied.value = false; }, 2000);
  });
}

const engConcept = computed((): LocalizedConcept | null => {
  return props.concept.localization('eng') ?? null;
});

const primaryTerm = computed(() => getPreferredTerm(engConcept.value, conceptId.value));
const renderedPrimaryTerm = computed(() => renderContent(primaryTerm.value));

const managedStatus = computed(() => props.concept.status);

const conceptRefDomains = computed(() => props.concept.domains);

const conceptDates = computed(() => props.concept.dates);

const conceptSources = computed(() => props.concept.sources);

const conceptTags = computed(() => props.concept.tags ?? []);

const factory = getFactory();
const { ensureBibLoaded, bibResolver, figResolver } = useRenderOptions(() => props.registerId);

const renderOpts = computed<RenderOptions>(() => ({
  xrefResolver: (uri, term) => {
    const resolution = factory.resolve(uri, props.registerId);
    if (resolution.type === 'internal') {
      return `<a href="#" class="xref-link" data-register="${escapeAttr(resolution.registerId)}" data-concept="${escapeAttr(resolution.conceptId)}">${escapeAttr(term)}</a>`;
    }
    if (resolution.type === 'site') {
      return `<a href="${escapeAttr(resolution.baseUrl)}/resolve/${escapeAttr(encodeURIComponent(uri))}" target="_blank" rel="noopener" class="xref-link xref-external">${escapeAttr(term)}</a>`;
    }
    if (resolution.type === 'url') {
      return `<a href="${escapeAttr(resolution.url)}" target="_blank" rel="noopener" class="xref-link xref-external">${escapeAttr(term)}</a>`;
    }
    return escapeAttr(term);
  },
  conceptRefResolver: (conceptId, term) => {
    const adapter = factory.getAdapter(props.registerId);
    const resolvedId = adapter?.lookupByDesignation(conceptId) ?? conceptId;
    return `<a href="#" class="xref-link" data-register="${escapeAttr(props.registerId)}" data-concept="${escapeAttr(resolvedId)}">${escapeAttr(term)}</a>`;
  },
  bibResolver,
  figResolver,
}));

watch(() => props.registerId, () => { ensureBibLoaded(); }, { immediate: true });

function handleContentClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('.xref-link') as HTMLElement | null;
  if (!target) return;
  e.preventDefault();
  const registerId = target.dataset.register;
  const conceptId = target.dataset.concept;
  if (registerId && conceptId) {
    router.push({ name: 'concept', params: { registerId, conceptId } });
  }
}

const {
  languages,
  allLangContent,
  langContentMap,
  hasContent,
  collapsedLangs,
  allCollapsed,
  toggleLang,
  toggleAll,
  plainTruncate,
  orderedDesignations,
} = useConceptContent(conceptComputed, manifestComputed, renderOpts);

function scrollToLang(lang: string) {
  if (collapsedLangs.value.has(lang)) {
    const s = new Set(collapsedLangs.value);
    s.delete(lang);
    collapsedLangs.value = s;
  }
  activeTab.value = 'definition';
  nextTick(() => {
    document.getElementById(`lang-${lang}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

function navigateDomain(domain: { slug: string; conceptId?: string }) {
  const sectionId = domain.conceptId || domain.slug;
  router.push({ name: 'dataset', params: { registerId: props.manifest.id }, query: { section: sectionId } });
}

function getTermForLang(lang: string): string {
  const lc = props.concept.localization(lang);
  return getPreferredTerm(lc);
}

function getDesignationsForLang(lang: string): Designation[] {
  const lc = props.concept.localization(lang);
  return lc?.terms ?? [];
}

function hasDefinition(lang: string): boolean {
  const lc = props.concept.localization(lang);
  if (!lc) return false;
  return lc.definitions.some(d => d.content);
}

function goAdjacent(id: string) {
  router.push({ name: 'concept', params: { registerId: props.registerId, conceptId: id } });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

const conceptDomains = computed(() => {
  const domainMap = new Map<string, { slug: string; label: string; langs: string[]; conceptId?: string }>();

  for (const ref of conceptRefDomains.value) {
    const id = ref.conceptId ?? '';
    const label = id || ref.urn || '';
    if (label) {
      const slug = slugify(label);
      domainMap.set(slug, { slug, label, langs: [], conceptId: id });
    }
  }

  for (const lang of props.concept.languages) {
    const lc = props.concept.localization(lang);
    const domain = lc?.domain;
    if (domain) {
      const slug = slugify(domain);
      const existing = domainMap.get(slug);
      if (existing) {
        if (!existing.langs.includes(lang)) existing.langs.push(lang);
      } else {
        domainMap.set(slug, { slug, label: domain, langs: [lang] });
      }
    }
  }
  return [...domainMap.values()].sort((a, b) => b.langs.length - a.langs.length);
});

const nonVerbalReps = computed(() => {
  const reps: typeof import('glossarist').NonVerbRep.prototype[] = [];
  for (const lang of props.concept.languages) {
    const lc = props.concept.localization(lang);
    if (lc?.nonVerbalRep?.length) {
      reps.push(...lc.nonVerbalRep);
    }
  }
  return reps;
});
</script>

<template>
  <div v-math class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="mb-6">
      <!-- Breadcrumb + nav row -->
      <div class="flex items-start gap-2 mb-3">
        <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 min-w-0 flex-1 flex-wrap">
          <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors whitespace-nowrap">{{ t('nav.home') }}</router-link>
          <span class="text-ink-200">/</span>
          <router-link :to="{ name: 'dataset', params: { registerId: manifest.id }}" class="hover:text-ink-700 transition-colors truncate max-w-[180px]">
            {{ localizedDatasetField(manifest.id, 'title', manifest.title) }}
          </router-link>
          <span class="text-ink-200">/</span>
          <span class="text-ink-600 font-mono text-xs">{{ conceptId }}</span>
          <span v-if="conceptPosition" class="text-[10px] text-ink-300 tabular-nums ml-1 whitespace-nowrap">({{ conceptPosition.index }} {{ t('concept.of') }} {{ conceptPosition.total.toLocaleString() }})</span>
        </nav>
        <!-- Prev/Next navigation -->
        <div v-if="adjacent.prev || adjacent.next" class="flex items-center gap-1 flex-shrink-0">
          <button
            v-if="adjacent.prev"
            @click="goAdjacent(adjacent.prev)"
            class="p-2.5 rounded-lg text-ink-300 hover:text-ink-600 hover:bg-ink-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            :title="t('concept.previous') + ' (←)'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button
            v-if="adjacent.next"
            @click="goAdjacent(adjacent.next)"
            class="p-2.5 rounded-lg text-ink-300 hover:text-ink-600 hover:bg-ink-50 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            :title="t('concept.next') + ' (→)'"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
      <h1 class="font-serif text-2xl sm:text-3xl text-ink-800 leading-snug mb-3" v-html="renderedPrimaryTerm"></h1>
      <div class="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:flex-wrap sm:overflow-visible sm:mx-0 sm:pb-0 scrollbar-none">
        <span class="badge badge-blue font-mono">{{ conceptId }}</span>
        <span
          v-if="managedStatus"
          class="badge text-[10px]"
          :class="conceptStatusColor(managedStatus)"
          :title="conceptStatusDefinition(managedStatus) ?? ''"
        >
          {{ conceptStatusLabel(managedStatus) }}
        </span>
        <span class="badge" :class="entryStatusColor(engConcept?.entryStatus ?? '')" v-if="engConcept?.entryStatus" :title="entryStatusDefinition(engConcept.entryStatus) ?? ''">
          {{ entryStatusLabel(engConcept.entryStatus) }}
        </span>
        <span class="badge badge-gray" v-if="manifest.owner">{{ manifest.owner }}</span>
        <span class="badge badge-purple">{{ languages.length }} {{ t('concept.languages') }}</span>
      </div>
    </div>

    <!-- Tab navigation: segmented control on mobile, underline on desktop -->
    <div role="tablist"
      class="grid grid-cols-3 rounded-xl bg-surface-alt p-1 mb-6 md:bg-transparent md:p-0 md:flex md:border-b md:border-ink-100/60 md:rounded-none">
      <button
        role="tab"
        :aria-selected="activeTab === 'definition'"
        @click="activeTab = 'definition'"
        class="py-3 text-sm font-medium rounded-lg transition-colors md:rounded-none md:border-b-2 md:-mb-px md:px-5 md:py-3"
        :class="activeTab === 'definition'
          ? 'bg-blue-600 text-white shadow-sm md:bg-transparent md:text-blue-600 md:border-blue-500 md:shadow-none'
          : 'text-ink-500 hover:text-ink-700 md:text-ink-400 md:border-transparent md:hover:text-ink-600'"
      >
        {{ t('concept.definition') }}
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'rdf'"
        @click="activeTab = 'rdf'"
        class="py-3 text-sm font-medium rounded-lg transition-colors md:rounded-none md:border-b-2 md:-mb-px md:px-5 md:py-3"
        :class="activeTab === 'rdf'
          ? 'bg-blue-600 text-white shadow-sm md:bg-transparent md:text-blue-600 md:border-blue-500 md:shadow-none'
          : 'text-ink-500 hover:text-ink-700 md:text-ink-400 md:border-transparent md:hover:text-ink-600'"
      >
        {{ t('concept.rdf') }}
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'history'"
        @click="activeTab = 'history'"
        class="py-3 text-sm font-medium rounded-lg transition-colors md:rounded-none md:border-b-2 md:-mb-px md:px-5 md:py-3"
        :class="activeTab === 'history'
          ? 'bg-blue-600 text-white shadow-sm md:bg-transparent md:text-blue-600 md:border-blue-500 md:shadow-none'
          : 'text-ink-500 hover:text-ink-700 md:text-ink-400 md:border-transparent md:hover:text-ink-600'"
      >
        {{ t('concept.history') }}
      </button>
    </div>

    <!-- Tab: Definition -->
    <div v-if="activeTab === 'definition'" role="tabpanel">
      <!-- Expand/Collapse all toggle -->
      <div v-if="allLangContent.length > 1" class="flex items-center justify-between mb-3">
        <span class="text-xs text-ink-400">{{ languages.length }} {{ t('concept.languages') }}</span>
        <button @click="toggleAll" class="text-xs text-ink-400 hover:text-ink-600 transition-colors px-3 py-2">
          {{ allCollapsed ? t('concept.expandAll') : t('concept.collapseAll') }}
        </button>
      </div>
      <div class="lg:flex lg:gap-8">
        <!-- Left: all language content -->
        <div class="flex-1 min-w-0 space-y-2" @click="handleContentClick">
          <!-- Per-language collapsible blocks -->
          <div v-for="lc in allLangContent" :key="lc.lang" :id="`lang-${lc.lang}`" class="border border-ink-100/80 rounded-lg overflow-hidden">
            <!-- Collapsible header -->
            <button
              v-if="hasContent(lc)"
              @click="toggleLang(lc.lang)"
              class="w-full flex items-center gap-2.5 px-3 sm:px-4 py-3 text-left hover:bg-ink-50/50 transition-colors"
            >
              <svg
                class="w-3.5 h-3.5 text-ink-300 transition-transform duration-200 flex-shrink-0"
                :class="collapsedLangs.has(lc.lang) ? '' : 'rotate-90'"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
              </svg>
              <span class="text-xs font-semibold text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ langName(lc.lang) }}</span>
              <span class="font-medium text-ink-800 text-sm" v-html="lc.renderedTerm"></span>
              <span v-if="lc.entryStatus" class="badge text-[10px] ml-auto" :class="entryStatusColor(lc.entryStatus)" :title="entryStatusDefinition(lc.entryStatus) ?? ''">{{ entryStatusLabel(lc.entryStatus) }}</span>
            </button>
            <!-- Non-collapsible header (designation only) -->
            <div v-else class="w-full flex items-center gap-2.5 px-3 sm:px-4 py-3">
              <span class="text-xs font-semibold text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ langName(lc.lang) }}</span>
              <span class="font-medium text-ink-800 text-sm" v-html="lc.renderedTerm"></span>
              <span class="text-xs text-ink-200 ml-2 italic">{{ t('concept.designationOnly') }}</span>
              <span v-if="lc.entryStatus" class="badge text-[10px] ml-auto" :class="entryStatusColor(lc.entryStatus)" :title="entryStatusDefinition(lc.entryStatus) ?? ''">{{ entryStatusLabel(lc.entryStatus) }}</span>
            </div>
            <!-- Collapsed preview -->
            <div v-if="hasContent(lc) && collapsedLangs.has(lc.lang)" class="px-3 sm:px-4 pb-3 -mt-0.5">
              <p v-if="lc.definition" class="text-xs text-ink-300 leading-relaxed pl-[22px]">{{ plainTruncate(lc.definition) }}</p>
              <p v-else class="text-xs text-ink-200 leading-relaxed pl-[22px]">
                <template v-if="lc.annotations.length">{{ lc.annotations.length }} annotation{{ lc.annotations.length > 1 ? 's' : '' }}</template>
                <template v-if="lc.annotations.length && lc.notes.length"> &middot; </template>
                <template v-if="lc.notes.length">{{ lc.notes.length }} note{{ lc.notes.length > 1 ? 's' : '' }}</template>
                <template v-if="(lc.annotations.length || lc.notes.length) && lc.examples.length"> &middot; </template>
                <template v-if="lc.examples.length">{{ lc.examples.length }} example{{ lc.examples.length > 1 ? 's' : '' }}</template>
              </p>
            </div>

            <!-- Expandable content -->
            <div v-if="hasContent(lc)" v-show="!collapsedLangs.has(lc.lang)" class="lang-content px-3 sm:px-4 pb-4 space-y-3">
              <!-- Designations -->
              <DesignationList
                :designations="orderedDesignations(lc.lang)"
                :rendered-designations="lc.renderedDesignations"
                :lang="lc.lang"
                :register-id="registerId"
                @navigate-related="(ref) => navigateRelated(ref)"
              />

              <!-- Definition -->
              <div v-if="lc.definition" class="p-4 rounded-lg bg-surface border-l-2" :style="{ borderLeftColor: getColor(manifest.id) }">
                <div class="text-ink-800 leading-relaxed" v-html="lc.renderedDefinition"></div>
              </div>

              <!-- Annotations -->
              <div v-if="lc.annotations.length" class="space-y-2">
                <div v-for="(_, i) in lc.annotations" :key="'ann-'+i" class="text-ink-500 text-sm leading-relaxed italic pl-3 border-l-2 border-ink-200">
                  <span class="font-medium text-ink-400 text-xs uppercase tracking-wide not-italic">{{ t('concept.annotation') }}</span>
                  <div class="mt-1 not-italic" v-html="lc.renderedAnnotations[i]"></div>
                </div>
              </div>

              <!-- Notes -->
              <div v-if="lc.notes.length" class="space-y-2">
                <div v-for="(_, i) in lc.notes" :key="i" class="text-ink-600 text-sm leading-relaxed">
                  <span class="font-medium text-ink-400 text-xs uppercase tracking-wide">{{ t('concept.note') }} {{ i + 1 }}</span>
                  <div class="mt-1" v-html="lc.renderedNotes[i]"></div>
                </div>
              </div>

              <!-- Examples -->
              <div v-if="lc.examples.length" class="space-y-2">
                <div v-for="(_, i) in lc.examples" :key="i" class="text-ink-600 text-sm leading-relaxed">
                  <span class="font-medium text-ink-400 text-xs uppercase tracking-wide">{{ t('concept.example') }} {{ i + 1 }}</span>
                  <div class="mt-1" v-html="lc.renderedExamples[i]"></div>
                </div>
              </div>

              <!-- Non-verbal representations -->
              <NonVerbalRepDisplay v-if="lc.lc.nonVerbalRep?.length" :reps="lc.lc.nonVerbalRep" />

              <!-- Sources -->
              <div v-if="lc.sources.length" class="space-y-2">
                <div v-for="(src, i) in lc.sources" :key="i" class="text-sm">
                  <div class="flex items-center gap-1.5 flex-wrap mb-1">
                    <span v-if="src.type" class="badge text-[10px]" :class="sourceTypeInfo(src.type).color" :title="sourceTypeInfo(src.type).definition ?? ''">{{ sourceTypeInfo(src.type).label }}</span>
                    <span v-if="src.status" class="badge text-[10px]" :title="sourceStatusInfo(src.status).definition ?? ''" :class="sourceStatusInfo(src.status).color">{{ sourceStatusInfo(src.status).label }}</span>
                  </div>
                  <div class="text-ink-700">
                    <CitationDisplay v-if="src.origin" :citation="src.origin" />
                    <span v-if="!src.origin && src.modification" class="text-ink-400">{{ src.modification }}</span>
                  </div>
                  <div v-if="src.modification" class="text-xs text-ink-300 mt-1">{{ src.modification }}</div>
                </div>
              </div>

              <!-- Ontological metadata -->
              <div v-if="lc.classification || lc.reviewType || lc.release || lc.lineageSourceSimilarity != null || lc.lcScript || lc.lcSystem" class="border-t border-ink-100/60 pt-2 mt-2">
                <div class="text-[10px] uppercase tracking-wide text-ink-300 font-medium mb-1.5">{{ t('concept.ontologicalMetadata') }}</div>
                <dl class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <template v-if="lc.classification">
                    <dt class="text-ink-300">{{ t('concept.classificationLabel') }}</dt>
                    <dd class="text-ink-700">{{ lc.classification }}</dd>
                  </template>
                  <template v-if="lc.reviewType">
                    <dt class="text-ink-300">{{ t('concept.reviewType') }}</dt>
                    <dd class="text-ink-700">{{ lc.reviewType }}</dd>
                  </template>
                  <template v-if="lc.release">
                    <dt class="text-ink-300">{{ t('concept.release') }}</dt>
                    <dd class="text-ink-700">{{ lc.release }}</dd>
                  </template>
                  <template v-if="lc.lineageSourceSimilarity != null">
                    <dt class="text-ink-300">{{ t('concept.lineageSimilarity') }}</dt>
                    <dd class="text-ink-700">{{ lc.lineageSourceSimilarity }}%</dd>
                  </template>
                  <template v-if="lc.lcScript">
                    <dt class="text-ink-300">{{ t('concept.script') }}</dt>
                    <dd class="text-ink-700 font-mono">{{ lc.lcScript }}</dd>
                  </template>
                  <template v-if="lc.lcSystem">
                    <dt class="text-ink-300">{{ t('concept.conversionSystem') }}</dt>
                    <dd class="text-ink-700 font-mono">{{ lc.lcSystem }}</dd>
                  </template>
                </dl>
              </div>
            </div>
          </div>

          <!-- Non-verbal reps (concept-level) -->
          <NonVerbalRepDisplay v-if="nonVerbalReps.length" :reps="nonVerbalReps" />
        </div>

        <!-- Right sidebar -->
        <div class="w-full lg:w-64 flex-shrink-0 space-y-4 mt-6 lg:mt-0">
          <!-- Relations -->
          <div v-if="outgoingEdges.length || incomingEdges.length" class="card p-5">
            <div class="section-label">{{ t('concept.relations') }}</div>

            <!-- Outgoing -->
            <div v-if="outgoingEdges.length" class="mt-3">
              <div class="text-xs text-ink-300 mb-1.5">{{ t('concept.outgoing') }} ({{ outgoingEdges.length }})</div>
              <div class="space-y-0.5 max-h-56 overflow-y-auto pr-1 -mr-1">
                <button
                  v-for="edge in outgoingEdges"
                  :key="edge.target + edge.type"
                  @click="navigateEdge(edge)"
                  @mouseenter="hoveredEdgeDisplay = getEdgeDisplay(edge.target)"
                  @mouseleave="hoveredEdgeDisplay = null"
                  @focus="hoveredEdgeDisplay = getEdgeDisplay(edge.target)"
                  class="concept-link block w-full text-left rounded-md px-1.5 py-1 hover:bg-ink-50 transition-colors"
                  :class="getEdgeDisplay(edge.target).isLocal ? '' : 'xref-external'"
                >
                  <div class="flex items-center gap-1 mb-0.5">
                    <span class="badge text-[9px] flex-shrink-0" :class="edgeBadgeColor(edge.type, 'out')">{{ relationshipLabel(edge.type) }} →</span>
                    <span v-if="getEdgeDisplay(edge.target).badge" class="badge badge-gray text-[9px] flex-shrink-0 truncate">{{ getEdgeDisplay(edge.target).badge!.title }}</span>
                  </div>
                  <div class="text-sm text-ink-700 leading-snug line-clamp-2">{{ getEdgeDisplay(edge.target).designation || edge.label || getEdgeDisplay(edge.target).conceptId }}</div>
                </button>
              </div>
            </div>

            <!-- Incoming -->
            <div v-if="incomingEdges.length" class="mt-3 pt-3 border-t border-ink-100/60">
              <div class="text-xs text-ink-300 mb-1.5">{{ t('concept.incoming') }} ({{ incomingEdges.length }})</div>
              <div class="space-y-0.5 max-h-40 overflow-y-auto pr-1 -mr-1">
                <button
                  v-for="edge in incomingEdges"
                  :key="edge.source + edge.type"
                  @click="navigateEdge(edge)"
                  @mouseenter="hoveredEdgeDisplay = getEdgeDisplay(edge.source)"
                  @mouseleave="hoveredEdgeDisplay = null"
                  @focus="hoveredEdgeDisplay = getEdgeDisplay(edge.source)"
                  class="concept-link block w-full text-left rounded-md px-1.5 py-1 hover:bg-ink-50 transition-colors"
                  :class="getEdgeDisplay(edge.source).isLocal ? '' : 'xref-external'"
                >
                  <div class="flex items-center gap-1 mb-0.5">
                    <span class="badge text-[9px] flex-shrink-0" :class="edgeBadgeColor(edge.type, 'in')">← {{ relationshipLabel(inverseEdgeType(edge.type)) }}</span>
                    <span v-if="getEdgeDisplay(edge.source).badge" class="badge badge-gray text-[9px] flex-shrink-0 truncate">{{ getEdgeDisplay(edge.source).badge!.title }}</span>
                  </div>
                  <div class="text-sm text-ink-700 leading-snug line-clamp-2">{{ getEdgeDisplay(edge.source).designation || edge.label || getEdgeDisplay(edge.source).conceptId }}</div>
                </button>
              </div>
            </div>

            <!-- Hover detail strip (fixed area at bottom of card) -->
            <Transition name="fade">
              <div
                v-if="hoveredEdgeDisplay"
                class="mt-3 pt-3 border-t border-ink-100/60"
              >
                <div class="text-xs text-ink-300 mb-0.5">{{ t('concept.identifier') || 'Identifier' }}</div>
                <div class="font-mono text-[10px] text-ink-500 break-all leading-tight">{{ hoveredEdgeDisplay.conceptId }}</div>
              </div>
            </Transition>
          </div>

          <!-- Domains -->
          <div v-if="conceptDomains.length" class="card p-5">
            <div class="section-label">{{ t('concept.domains') }}</div>
            <div class="space-y-1 mt-3">
              <button
                v-for="domain in conceptDomains"
                :key="domain.slug"
                @click="navigateDomain(domain)"
                class="flex items-center gap-1.5 text-sm concept-link w-full text-left"
              >
                <span class="w-2 h-1.5 rounded inline-block flex-shrink-0" style="background: #8b5cf6;"></span>
                <span class="font-medium text-ink-700">{{ domain.label }}</span>
                <span v-if="domain.conceptId" class="text-[10px] text-ink-300 font-mono">{{ domain.conceptId }}</span>
                <span v-if="domain.langs.length > 0" class="text-[10px] text-ink-300 ml-1">
                  ({{ domain.langs.map(l => l.toUpperCase()).join(', ') }})
                </span>
              </button>
            </div>
          </div>

          <!-- Tags -->
          <div v-if="conceptTags.length" class="card p-5">
            <div class="section-label">{{ t('concept.tags') }}</div>
            <div class="flex flex-wrap gap-1.5 mt-3">
              <span v-for="tag in conceptTags" :key="tag" class="badge badge-gray text-[10px]">{{ tag }}</span>
            </div>
          </div>

          <!-- Managed concept dates -->
          <div v-if="conceptDates.length" class="card p-5">
            <div class="section-label">{{ t('concept.lifecycleDates') }}</div>
            <dl class="mt-3 space-y-1.5 text-xs">
              <div v-for="(d, i) in conceptDates" :key="i" class="flex gap-2">
                <dt class="text-ink-300 min-w-[70px]">{{ d.type }}</dt>
                <dd class="text-ink-700">{{ d.date }}</dd>
              </div>
            </dl>
          </div>

          <!-- Managed concept sources -->
          <div v-if="conceptSources.length" class="card p-5">
            <div class="section-label">{{ t('concept.conceptSources') }}</div>
            <div class="space-y-2 mt-3">
              <div v-for="(src, i) in conceptSources" :key="i" class="text-xs">
                <div class="flex items-center gap-1.5 flex-wrap mb-0.5">
                  <span v-if="src.type" class="badge text-[10px]" :class="sourceTypeInfo(src.type).color" :title="sourceTypeInfo(src.type).definition ?? ''">{{ sourceTypeInfo(src.type).label }}</span>
                  <span v-if="src.status" class="badge text-[10px]" :title="sourceStatusInfo(src.status).definition ?? ''" :class="sourceStatusInfo(src.status).color">{{ sourceStatusInfo(src.status).label }}</span>
                </div>
                <div class="text-ink-700">
                  <CitationDisplay v-if="src.origin" :citation="src.origin" />
                </div>
                <div v-if="src.modification" class="text-ink-300 mt-0.5">{{ src.modification }}</div>
              </div>
            </div>
          </div>

          <!-- Language quick-jump -->
          <div class="card p-5">
            <div class="section-label">{{ t('concept.languagesSidebar', { count: String(languages.length) }) }}</div>
            <div class="space-y-1 mt-3 max-h-80 overflow-y-auto">
              <button
                v-for="lang in languages"
                :key="lang"
                @click="scrollToLang(lang)"
                class="w-full text-left group rounded-md px-2 py-1.5 -mx-2 hover:bg-ink-50 transition-colors"
              >
                <div class="flex items-center gap-1.5">
                  <span class="text-xs font-semibold text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ langName(lang) }}</span>
                  <span
                    class="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    :class="hasDefinition(lang) ? 'bg-emerald-400' : 'bg-ink-200'"
                    :title="hasDefinition(lang) ? t('concept.hasDefinition') : t('concept.designationOnlyTitle')"
                  ></span>
                  <span class="text-sm font-medium text-ink-800 group-hover:text-ink-900 transition-colors" v-html="langContentMap.get(lang)?.renderedTerm ?? getTermForLang(lang)"></span>
                </div>
                <div v-if="getDesignationsForLang(lang).length > 1" class="ml-5 mt-0.5 flex flex-wrap gap-1">
                  <span
                    v-for="d in getDesignationsForLang(lang)"
                    :key="d.designation"
                    :class="d.type === 'symbol' ? 'badge-purple' : 'badge-gray'"
                    class="badge text-[10px]"
                  >
                    {{ d.designation }}
                  </span>
                </div>
              </button>
            </div>
          </div>

          <!-- Metadata -->
          <div class="card p-5">
            <div class="section-label">{{ t('concept.metadata') }}</div>
            <dl class="space-y-2 text-xs mt-3">
              <div v-if="managedStatus">
                <dt class="text-ink-300">{{ t('concept.status') }}</dt>
                <dd class="mt-0.5">
                  <span class="badge text-[10px]" :class="conceptStatusColor(managedStatus)" :title="conceptStatusDefinition(managedStatus) ?? ''">{{ conceptStatusLabel(managedStatus) }}</span>
                </dd>
              </div>
              <div v-if="engConcept?.reviewDate">
                <dt class="text-ink-300">{{ t('concept.reviewDate') }}</dt>
                <dd class="text-ink-700 mt-0.5">{{ engConcept.reviewDate.slice(0, 10) }}</dd>
              </div>
              <div v-if="engConcept?.reviewDecisionEvent">
                <dt class="text-ink-300">{{ t('concept.decision') }}</dt>
                <dd class="text-ink-700 mt-0.5">{{ engConcept.reviewDecisionEvent }}</dd>
              </div>
              <div>
                <dt class="text-ink-300">{{ t('concept.uri') }}</dt>
                <dd class="font-mono text-ink-600 break-all mt-0.5 text-[11px] flex items-start gap-1.5">
                  <span class="break-all">{{ conceptUriValue }}</span>
                  <button @click="copyUri" class="flex-shrink-0 p-0.5 rounded text-ink-300 hover:text-ink-600 hover:bg-ink-50 transition-colors" :title="uriCopied ? t('concept.uriCopied') : t('concept.copyUri')" :aria-label="uriCopied ? t('concept.uriCopied') : t('concept.copyUri')">
                    <svg v-if="!uriCopied" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10a2 2 0 01-2-2v-1m6 4v-3a2 2 0 00-2-2H8"/></svg>
                    <svg v-else class="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>
                  </button>
                </dd>
              </div>
            </dl>
          </div>

          <FormatDownloads
            :register-id="manifest.id"
            :concept-id="conceptId"
            :formats="manifest.availableFormats || []"
          />
        </div>
      </div>
    </div>

    <!-- Tab: History -->
    <!-- Tab: RDF -->
    <div v-if="activeTab === 'rdf'" role="tabpanel">
      <ConceptRdfView
        :concept="concept"
        :register-id="registerId"
        :concept-uri-value="conceptUriValue"
      />
    </div>

    <div v-if="activeTab === 'history'" role="tabpanel">
      <ConceptTimeline
        :concept="concept"
        :language-order="manifest.languageOrder"
        v-model:active-lang="activeHistoryLang"
      />
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
