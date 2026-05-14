<script setup lang="ts">
import type { ConceptDocument, LocalizedConcept, GraphEdge } from '../adapters/types';
import type { Manifest } from '../adapters/types';
import { computed, ref, nextTick, watch } from 'vue';
import { langName, langLabel } from '../utils/lang';
import { renderMath, cleanContent } from '../utils/math';
import type { RenderOptions } from '../utils/math';
import { escapeAttr } from '../utils/escape';
import { entryStatusColor, designationTypeLabel, designationTypeColor, getPreferredTerm } from '../utils/concept-helpers';
import { useRouter } from 'vue-router';
import { useVocabularyStore } from '../stores/vocabulary';
import { useDsStyle } from '../utils/dataset-style';
import { getFactory } from '../adapters/factory';
import { useRenderOptions } from '../composables/use-render-options';
import ConceptTimeline from './ConceptTimeline.vue';
import FormatDownloads from './FormatDownloads.vue';

const props = defineProps<{
  concept: ConceptDocument;
  manifest: Manifest;
  edges: GraphEdge[];
  registerId: string;
  adjacent: { prev: string | null; next: string | null };
}>();

const router = useRouter();
const store = useVocabularyStore();
const { getColor } = useDsStyle();
const factory = getFactory();

const activeTab = ref<'definition' | 'history'>('definition');
const activeHistoryLang = ref('eng');

const conceptId = computed(() => props.concept['gl:identifier']);

const conceptPosition = computed(() => {
  const adapter = store.datasets.get(props.registerId);
  if (!adapter?.index) return null;
  const idx = adapter.getConceptPosition(conceptId.value);
  if (idx < 0) return null;
  return { index: idx + 1, total: adapter.getConceptCount() };
});

const uriCopied = ref(false);
function copyUri() {
  navigator.clipboard.writeText(props.concept['@id']).then(() => {
    uriCopied.value = true;
    setTimeout(() => { uriCopied.value = false; }, 2000);
  });
}

const languages = computed(() => {
  const order = props.manifest.languageOrder;
  const keys = Object.keys(props.concept['gl:localizedConcept'] || {});
  if (!order) {
    return keys.sort((a, b) => {
      if (a === 'eng') return -1;
      if (b === 'eng') return 1;
      return a.localeCompare(b);
    });
  }
  const orderIndex = new Map(order.map((lang, i) => [lang, i]));
  return keys.sort((a, b) => {
    const ai = orderIndex.get(a) ?? order.length;
    const bi = orderIndex.get(b) ?? order.length;
    if (ai !== bi) return ai - bi;
    return a.localeCompare(b);
  });
});

// Collapsible language sections — auto-collapse non-eng when 6+ languages
const collapsedLangs = ref(new Set<string>());

function initCollapsed(langs: string[]) {
  if (langs.length >= 6) {
    collapsedLangs.value = new Set(langs.filter(l => l !== 'eng'));
  }
}

watch(languages, (langs) => { initCollapsed(langs); }, { immediate: true });

const engConcept = computed((): LocalizedConcept | null => {
  return props.concept['gl:localizedConcept']?.['eng'] ?? null;
});

const primaryTerm = computed(() => getPreferredTerm(engConcept.value, conceptId.value));

// Cross-reference resolver: generates clickable links for inline refs

const { ensureBibLoaded, bibResolver, figResolver } = useRenderOptions(() => props.registerId);

const renderOpts: RenderOptions = {
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
  bibResolver,
  figResolver,
};

watch(() => props.registerId, () => { ensureBibLoaded(); }, { immediate: true });

// Handle clicks on cross-reference links via event delegation
function handleContentClick(e: MouseEvent) {
  const target = (e.target as HTMLElement).closest('.xref-link') as HTMLElement | null;
  if (!target) return;
  e.preventDefault();
  const registerId = target.dataset.register;
  const conceptId = target.dataset.concept;
  if (registerId && conceptId) {
    store.viewConcept(registerId, conceptId);
    router.push({ name: 'concept', params: { registerId, conceptId } });
  }
}

// Pre-computed content for all languages (sorted eng first)
interface LangContent {
  lang: string;
  definition: string;
  notes: string[];
  examples: string[];
  sources: any[];
  designations: any[];
  entryStatus: string;
}

const allLangContent = computed(() => {
  const result: LangContent[] = [];
  for (const lang of languages.value) {
    const lc = props.concept['gl:localizedConcept']?.[lang];
    if (!lc) continue;

    const defs = lc['gl:definition'];
    const definition = defs?.length
      ? defs.map(d => d['gl:content']).filter(Boolean).join('\n\n')
      : '';

    result.push({
      lang,
      definition,
      notes: lc['gl:notes']?.map((n: any) => n['gl:content']).filter(Boolean) ?? [],
      examples: lc['gl:examples']?.map((e: any) => e['gl:content']).filter(Boolean) ?? [],
      sources: lc['gl:source'] ?? [],
      designations: lc['gl:designation'] ?? [],
      entryStatus: lc['gl:entryStatus'] ?? '',
    });
  }
  return result;
});

function hasContent(lc: LangContent): boolean {
  return !!(lc.definition || lc.notes.length || lc.examples.length || lc.sources.length);
}

const allCollapsed = computed(() => collapsedLangs.value.size === allLangContent.value.length);

function toggleLang(lang: string) {
  const s = new Set(collapsedLangs.value);
  if (s.has(lang)) s.delete(lang); else s.add(lang);
  collapsedLangs.value = s;
}

function toggleAll() {
  if (allCollapsed.value) {
    collapsedLangs.value = new Set();
  } else {
    collapsedLangs.value = new Set(allLangContent.value.map(lc => lc.lang));
  }
}

function scrollToLang(lang: string) {
  // Expand if collapsed
  if (collapsedLangs.value.has(lang)) {
    const s = new Set(collapsedLangs.value);
    s.delete(lang);
    collapsedLangs.value = s;
  }
  // Switch to definition tab if needed
  activeTab.value = 'definition';
  nextTick(() => {
    document.getElementById(`lang-${lang}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
}

const outgoingEdges = computed(() => props.edges.filter(e => e.source === props.concept['@id']));
const incomingEdges = computed(() => props.edges.filter(e => e.target === props.concept['@id']));

function isLocalRef(uri: string): boolean {
  const resolution = factory.resolve(uri, props.registerId);
  return resolution.type === 'internal' && resolution.registerId === props.registerId;
}

function edgeConceptId(uri: string): string {
  const m = uri.match(/\/concept\/([^/]+)$/);
  return m ? m[1] : uri.split('/').pop() || uri;
}

function edgeNodeData(uri: string) {
  return store.graph.getNode(uri);
}

function edgeTooltip(uri: string): string {
  const node = edgeNodeData(uri);
  const lines: string[] = [uri];
  if (node) {
    for (const [lang, designation] of Object.entries(node.designations)) {
      lines.push(`${langLabel(lang)}: ${designation}`);
    }
  }
  return lines.join('\n');
}

function edgeDatasetBadge(uri: string): { id: string; title: string } | null {
  const resolution = factory.resolve(uri, props.registerId);
  if (resolution.type === 'internal' && resolution.registerId !== props.registerId) {
    const m = store.manifests.get(resolution.registerId);
    return { id: resolution.registerId, title: m?.shortname || m?.title || resolution.registerId };
  }
  if (resolution.type === 'site') return { id: '', title: resolution.label };
  if (resolution.type === 'url') return { id: '', title: resolution.label };
  return null;
}

async function navigateEdge(edge: GraphEdge) {
  const uri = edge.source === props.concept['@id'] ? edge.target : edge.source;
  const resolution = factory.resolve(uri);

  if (resolution.type === 'internal') {
    await store.viewConcept(resolution.registerId, resolution.conceptId);
    router.push({ name: 'concept', params: { registerId: resolution.registerId, conceptId: resolution.conceptId } });
  } else if (resolution.type === 'site') {
    window.open(`${resolution.baseUrl}/resolve/${encodeURIComponent(uri)}`, '_blank', 'noopener');
  } else if (resolution.type === 'url') {
    window.open(resolution.url, '_blank', 'noopener');
  }
}

function getTermForLang(lang: string): string {
  const lc = props.concept['gl:localizedConcept']?.[lang];
  return getPreferredTerm(lc);
}

function getDesignationsForLang(lang: string) {
  const lc = props.concept['gl:localizedConcept']?.[lang];
  return lc?.['gl:designation'] ?? [];
}

function orderedDesignations(lang: string) {
  const desigs = getDesignationsForLang(lang);
  const preferred = desigs.filter(d => d['gl:normativeStatus'] === 'preferred');
  const admitted = desigs.filter(d => d['gl:normativeStatus'] === 'admitted' || d['gl:normativeStatus'] === 'deprecated');
  const rest = desigs.filter(d => d['gl:normativeStatus'] !== 'preferred' && d['gl:normativeStatus'] !== 'admitted' && d['gl:normativeStatus'] !== 'deprecated');
  return [...preferred, ...admitted, ...rest];
}

function hasDefinition(lang: string): boolean {
  const lc = props.concept['gl:localizedConcept']?.[lang];
  if (!lc) return false;
  return lc['gl:definition']?.some((d: any) => d['gl:content']) ?? false;
}

function goAdjacent(id: string) {
  router.push({ name: 'concept', params: { registerId: props.registerId, conceptId: id } });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function plainTruncate(html: string, max: number = 120): string {
  const text = cleanContent(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return text.length <= max ? text : text.slice(0, max).trimEnd() + '\u2026';
}

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s/]+/g, '-');
}

const conceptDomains = computed(() => {
  const domainMap = new Map<string, { slug: string; label: string; langs: string[] }>();
  for (const [lang, lc] of Object.entries(props.concept['gl:localizedConcept'] || {})) {
    const domain = lc['gl:domain'];
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
</script>

<template>
  <div v-math class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Header -->
    <div class="mb-6">
      <!-- Breadcrumb + nav row -->
      <div class="flex items-start gap-2 mb-3">
        <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 min-w-0 flex-1 flex-wrap">
          <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors whitespace-nowrap">Home</router-link>
          <span class="text-ink-200">/</span>
          <router-link :to="{ name: 'dataset', params: { registerId: manifest.id }}" class="hover:text-ink-700 transition-colors truncate max-w-[180px]">
            {{ manifest.title }}
          </router-link>
          <span class="text-ink-200">/</span>
          <span class="text-ink-600 font-mono text-xs">{{ conceptId }}</span>
          <span v-if="conceptPosition" class="text-[10px] text-ink-300 tabular-nums ml-1 whitespace-nowrap">({{ conceptPosition.index }} of {{ conceptPosition.total.toLocaleString() }})</span>
        </nav>
        <!-- Prev/Next navigation -->
        <div v-if="adjacent.prev || adjacent.next" class="flex items-center gap-1 flex-shrink-0">
          <button
            v-if="adjacent.prev"
            @click="goAdjacent(adjacent.prev)"
            class="p-1.5 rounded-md text-ink-300 hover:text-ink-600 hover:bg-ink-50 transition-colors"
            title="Previous concept (←)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          </button>
          <button
            v-if="adjacent.next"
            @click="goAdjacent(adjacent.next)"
            class="p-1.5 rounded-md text-ink-300 hover:text-ink-600 hover:bg-ink-50 transition-colors"
            title="Next concept (→)"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
      <h1 class="font-serif text-2xl sm:text-3xl text-ink-800 leading-snug mb-3" v-html="renderMath(primaryTerm)"></h1>
      <div class="flex flex-wrap gap-2">
        <span class="badge badge-blue font-mono">{{ conceptId }}</span>
        <span class="badge" :class="entryStatusColor(engConcept?.['gl:entryStatus'] ?? '')" v-if="engConcept?.['gl:entryStatus']">
          {{ engConcept['gl:entryStatus'] }}
        </span>
        <span class="badge badge-gray" v-if="manifest.owner">{{ manifest.owner }}</span>
        <span class="badge badge-purple">{{ languages.length }} languages</span>
      </div>
    </div>

    <!-- Tab navigation -->
    <div role="tablist" class="flex border-b border-ink-100/60 mb-6">
      <button
        role="tab"
        :aria-selected="activeTab === 'definition'"
        @click="activeTab = 'definition'"
        :class="activeTab === 'definition' ? 'border-ink-800 text-ink-800' : 'border-transparent text-ink-400 hover:text-ink-600'"
        class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px"
      >
        Definition
      </button>
      <button
        role="tab"
        :aria-selected="activeTab === 'history'"
        @click="activeTab = 'history'"
        :class="activeTab === 'history' ? 'border-ink-800 text-ink-800' : 'border-transparent text-ink-400 hover:text-ink-600'"
        class="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px"
      >
        History
      </button>
      <!-- Expand/Collapse all toggle (definition tab only) -->
      <button
        v-if="activeTab === 'definition'"
        @click="toggleAll"
        class="ml-auto px-3 py-2 text-xs text-ink-400 hover:text-ink-600 transition-colors"
      >
        {{ allCollapsed ? 'Expand all' : 'Collapse all' }}
        <span class="text-ink-300 ml-0.5">({{ languages.length }})</span>
      </button>
    </div>

    <!-- Tab: Definition -->
    <div v-if="activeTab === 'definition'" role="tabpanel">
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
              <span class="font-medium text-ink-800 text-sm" v-html="renderMath(getTermForLang(lc.lang))"></span>
              <span v-if="lc.entryStatus" class="badge text-[10px] ml-auto" :class="entryStatusColor(lc.entryStatus)">{{ lc.entryStatus }}</span>
            </button>
            <!-- Non-collapsible header (designation only) -->
            <div v-else class="w-full flex items-center gap-2.5 px-3 sm:px-4 py-3">
              <span class="text-xs font-semibold text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ langName(lc.lang) }}</span>
              <span class="font-medium text-ink-800 text-sm" v-html="renderMath(getTermForLang(lc.lang))"></span>
              <span class="text-xs text-ink-200 ml-2 italic">designation only</span>
              <span v-if="lc.entryStatus" class="badge text-[10px] ml-auto" :class="entryStatusColor(lc.entryStatus)">{{ lc.entryStatus }}</span>
            </div>
            <!-- Collapsed preview -->
            <div v-if="hasContent(lc) && collapsedLangs.has(lc.lang)" class="px-3 sm:px-4 pb-3 -mt-0.5">
              <p v-if="lc.definition" class="text-xs text-ink-300 leading-relaxed pl-[22px]">{{ plainTruncate(lc.definition) }}</p>
              <p v-else class="text-xs text-ink-200 leading-relaxed pl-[22px]">
                <template v-if="lc.notes.length">{{ lc.notes.length }} note{{ lc.notes.length > 1 ? 's' : '' }}</template>
                <template v-if="lc.notes.length && lc.examples.length"> &middot; </template>
                <template v-if="lc.examples.length">{{ lc.examples.length }} example{{ lc.examples.length > 1 ? 's' : '' }}</template>
              </p>
            </div>

            <!-- Expandable content -->
            <div v-if="hasContent(lc)" v-show="!collapsedLangs.has(lc.lang)" class="lang-content px-3 sm:px-4 pb-4 space-y-3">
              <!-- Designations -->
              <div v-if="lc.designations.length > 1" class="space-y-1 pl-[22px]">
                <div v-for="(d, i) in orderedDesignations(lc.lang)" :key="i" class="flex items-center gap-2 text-sm">
                  <span :class="d['gl:normativeStatus'] === 'preferred' ? 'font-bold text-ink-800' : 'font-normal text-ink-700'" v-html="renderMath(d['gl:term'])"></span>
                  <span class="badge text-[10px] flex-shrink-0" :class="designationTypeColor(d['@type'])">{{ designationTypeLabel(d['@type']) }}</span>
                  <span v-if="d['gl:normativeStatus'] && d['gl:normativeStatus'] !== 'preferred'" class="badge badge-yellow text-[10px] flex-shrink-0">{{ d['gl:normativeStatus'] }}</span>
                </div>
              </div>

              <!-- Definition -->
              <div v-if="lc.definition" class="p-4 rounded-lg bg-surface border-l-2" :style="{ borderLeftColor: getColor(manifest.id) }">
                <div class="text-ink-800 leading-relaxed" v-html="renderMath(lc.definition, renderOpts)"></div>
              </div>

              <!-- Notes -->
              <div v-if="lc.notes.length" class="space-y-2">
                <div v-for="(note, i) in lc.notes" :key="i" class="text-ink-600 text-sm leading-relaxed">
                  <span class="font-medium text-ink-400 text-xs uppercase tracking-wide">Note {{ i + 1 }}</span>
                  <div class="mt-1" v-html="renderMath(note, renderOpts)"></div>
                </div>
              </div>

              <!-- Examples -->
              <div v-if="lc.examples.length" class="space-y-2">
                <div v-for="(ex, i) in lc.examples" :key="i" class="text-ink-600 text-sm leading-relaxed">
                  <span class="font-medium text-ink-400 text-xs uppercase tracking-wide">Example {{ i + 1 }}</span>
                  <div class="mt-1" v-html="renderMath(ex, renderOpts)"></div>
                </div>
              </div>

              <!-- Sources -->
              <div v-if="lc.sources.length" class="space-y-2">
                <div v-for="(src, i) in lc.sources" :key="i" class="text-sm">
                  <div class="flex items-center gap-1.5 flex-wrap mb-1">
                    <span v-if="src['gl:sourceType']" class="badge text-[10px]"
                      :class="src['gl:sourceType'] === 'authoritative' ? 'badge-purple' : 'badge-blue'">
                      {{ src['gl:sourceType'] }}
                    </span>
                    <span v-if="src['gl:sourceStatus']" class="badge badge-gray text-[10px]">{{ src['gl:sourceStatus'] }}</span>
                  </div>
                  <div class="text-ink-700">
                    <span v-if="src['gl:origin']?.['gl:ref']" class="font-medium"
                      :class="src['gl:sourceType'] === 'authoritative' ? 'text-ink-900' : ''"
                    >{{ src['gl:origin']['gl:ref'] }}</span>
                    <span v-if="src['gl:origin']?.['gl:clause']">, {{ src['gl:origin']['gl:clause'] }}</span>
                    <a v-if="src['gl:origin']?.['gl:link']" :href="src['gl:origin']['gl:link']" target="_blank" class="concept-link ml-1">[link]</a>
                  </div>
                  <div v-if="src['gl:modification']" class="text-xs text-ink-300 mt-1">{{ src['gl:modification'] }}</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right sidebar -->
        <div class="w-full lg:w-64 flex-shrink-0 space-y-4 mt-6 lg:mt-0">
          <!-- Relations -->
          <div v-if="outgoingEdges.length || incomingEdges.length" class="card p-5">
            <div class="section-label">Relations</div>
            <div v-if="outgoingEdges.length" class="mt-3">
              <div class="text-xs text-ink-300 mb-2">References ({{ outgoingEdges.length }})</div>
              <div class="space-y-1 max-h-48 overflow-y-auto">
                <button
                  v-for="edge in outgoingEdges"
                  :key="edge.target"
                  @click="navigateEdge(edge)"
                  :title="edgeTooltip(edge.target)"
                  class="text-sm concept-link block truncate w-full text-left flex items-center gap-1.5"
                  :class="isLocalRef(edge.target) ? '' : 'xref-external'"
                >
                  {{ edgeConceptId(edge.target) }}
                  <span v-if="edgeDatasetBadge(edge.target)" class="badge badge-gray text-[9px] flex-shrink-0 truncate max-w-[100px]">{{ edgeDatasetBadge(edge.target)!.title }}</span>
                  <span v-if="isLocalRef(edge.target)" class="text-[9px] text-ink-200 flex-shrink-0">local</span>
                  <span v-else class="text-[9px] text-amber-500 flex-shrink-0">external</span>
                </button>
              </div>
            </div>
            <div v-if="incomingEdges.length" class="mt-3 pt-3 border-t border-ink-100/60">
              <div class="text-xs text-ink-300 mb-2">Referenced by ({{ incomingEdges.length }})</div>
              <div class="space-y-1 max-h-48 overflow-y-auto">
                <button
                  v-for="edge in incomingEdges"
                  :key="edge.source"
                  @click="navigateEdge(edge)"
                  :title="edgeTooltip(edge.source)"
                  class="text-sm concept-link block truncate w-full text-left flex items-center gap-1.5"
                  :class="isLocalRef(edge.source) ? '' : 'xref-external'"
                >
                  {{ edgeConceptId(edge.source) }}
                  <span v-if="edgeDatasetBadge(edge.source)" class="badge badge-gray text-[9px] flex-shrink-0 truncate max-w-[100px]">{{ edgeDatasetBadge(edge.source)!.title }}</span>
                  <span v-if="isLocalRef(edge.source)" class="text-[9px] text-ink-200 flex-shrink-0">local</span>
                  <span v-else class="text-[9px] text-amber-500 flex-shrink-0">external</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Domains -->
          <div v-if="conceptDomains.length" class="card p-5">
            <div class="section-label">Domains</div>
            <div class="space-y-1 mt-3">
              <div v-for="domain in conceptDomains" :key="domain.slug" class="flex items-center gap-1.5 text-sm">
                <span class="w-2 h-1.5 rounded inline-block flex-shrink-0" style="background: #8b5cf6;"></span>
                <span class="font-medium text-ink-700">{{ domain.label }}</span>
                <span v-if="domain.langs.length > 1" class="text-[10px] text-ink-300 ml-1">
                  ({{ domain.langs.map(l => l.toUpperCase()).join(', ') }})
                </span>
              </div>
            </div>
          </div>

          <!-- Language quick-jump -->
          <div class="card p-5">
            <div class="section-label">Languages ({{ languages.length }})</div>
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
                    :title="hasDefinition(lang) ? 'Has definition' : 'Designation only'"
                  ></span>
                  <span class="text-sm font-medium text-ink-800 group-hover:text-ink-900 transition-colors" v-html="renderMath(getTermForLang(lang))"></span>
                </div>
                <div v-if="getDesignationsForLang(lang).length > 1" class="ml-5 mt-0.5 flex flex-wrap gap-1">
                  <span
                    v-for="d in getDesignationsForLang(lang)"
                    :key="d['gl:term']"
                    :class="d['@type'] === 'gl:Symbol' ? 'badge-purple' : 'badge-gray'"
                    class="badge text-[10px]"
                  >
                    {{ d['gl:term'] }}
                  </span>
                </div>
              </button>
            </div>
          </div>

          <!-- Metadata -->
          <div class="card p-5">
            <div class="section-label">Metadata</div>
            <dl class="space-y-2 text-xs mt-3">
              <div v-if="engConcept?.['gl:reviewDate']">
                <dt class="text-ink-300">Review Date</dt>
                <dd class="text-ink-700 mt-0.5">{{ engConcept['gl:reviewDate'].slice(0, 10) }}</dd>
              </div>
              <div v-if="engConcept?.['gl:reviewDecisionEvent']">
                <dt class="text-ink-300">Decision</dt>
                <dd class="text-ink-700 mt-0.5">{{ engConcept['gl:reviewDecisionEvent'] }}</dd>
              </div>
              <div>
                <dt class="text-ink-300">URI</dt>
                <dd class="font-mono text-ink-600 break-all mt-0.5 text-[11px] flex items-start gap-1.5">
                  <span class="break-all">{{ concept['@id'] }}</span>
                  <button @click="copyUri" class="flex-shrink-0 p-0.5 rounded text-ink-300 hover:text-ink-600 hover:bg-ink-50 transition-colors" :title="uriCopied ? 'Copied!' : 'Copy URI'" :aria-label="uriCopied ? 'URI copied' : 'Copy URI to clipboard'">
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
    <div v-if="activeTab === 'history'" role="tabpanel">
      <ConceptTimeline
        :localized-concepts="concept['gl:localizedConcept'] || {}"
        :language-order="manifest.languageOrder"
        v-model:active-lang="activeHistoryLang"
      />
    </div>
  </div>
</template>
