<script setup lang="ts">
/**
 * ConceptEditionRail — sidebar card showing a concept's supersession chain
 * across vocabulary editions. Rendered INSIDE ConceptDetail's right sidebar
 * (between Relations and other cards), styled identically to its neighbors.
 *
 * Reads `supersedes` edges from the graph engine and walks the full chain
 * in both directions. Filter out malformed URIs that sometimes appear in
 * stub-data scenarios.
 */
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { useVocabularyStore } from '../stores/vocabulary';
import { useDatasetSeries, type DatasetSeriesMember } from '../composables/useDatasetSeries';
import { useI18n } from '../i18n';
import { UriRouter } from '../adapters/UriRouter';

const { t } = useI18n();

const props = defineProps<{
  conceptUri: string;
  registerId: string;
  conceptId: string;
}>();

const emit = defineEmits<{
  (e: 'compare', target: { registerId: string; conceptId: string; label: string }): void;
}>();

const store = useVocabularyStore();
const router = useRouter();

const { seriesForActive } = useDatasetSeries(() => props.registerId);
const series = computed(() => seriesForActive.value);

interface EditionEntry {
  member: DatasetSeriesMember;
  conceptUri: string;
  conceptId: string;
  edgeType: 'self' | 'supersedes' | 'superseded_by';
  hops: number;
  isCurrentEdition: boolean;  // newest valid edition in the series
}

/** Resolve a concept URI via the project's UriRouter SSOT. Returns null for
 *  malformed or non-concept URIs (URN-form refs, external IRIs, stub data). */
function parseStrict(uri: string): { registerId: string; conceptId: string } | null {
  return UriRouter.parseUri(uri);
}

/** Bidirectional BFS through supersedes edges from the start URI. */
function walkChain(startUri: string): Map<string, { type: 'supersedes' | 'superseded_by'; hops: number }> {
  const out = new Map<string, { type: 'supersedes' | 'superseded_by'; hops: number }>();

  /* Forward (concepts THIS supersedes — older editions it replaced) */
  const forwardQueue: Array<{ uri: string; hops: number }> = [{ uri: startUri, hops: 0 }];
  const forwardSeen = new Set<string>([startUri]);
  while (forwardQueue.length > 0) {
    const { uri, hops } = forwardQueue.shift()!;
    for (const e of store.graph.getEdges(uri)) {
      if (e.type === 'supersedes' && !forwardSeen.has(e.target)) {
        forwardSeen.add(e.target);
        out.set(e.target, { type: 'supersedes', hops: hops + 1 });
        forwardQueue.push({ uri: e.target, hops: hops + 1 });
      }
    }
  }

  /* Backward (concepts that SUPERSEDED this — newer editions) */
  const backwardQueue: Array<{ uri: string; hops: number }> = [{ uri: startUri, hops: 0 }];
  const backwardSeen = new Set<string>([startUri]);
  while (backwardQueue.length > 0) {
    const { uri, hops } = backwardQueue.shift()!;
    for (const e of store.graph.getIncomingEdges(uri)) {
      if (e.type === 'supersedes' && !backwardSeen.has(e.source)) {
        backwardSeen.add(e.source);
        out.set(e.source, { type: 'superseded_by', hops: hops + 1 });
        backwardQueue.push({ uri: e.source, hops: hops + 1 });
      }
    }
  }

  return out;
}

const editionChain = computed<EditionEntry[]>(() => {
  const s = series.value;
  const entries: EditionEntry[] = [];

  /* Always include self — use props directly so we don't depend on URI parsing. */
  const selfMember: DatasetSeriesMember = s?.members.find(m => m.id === props.registerId) ?? {
    id: props.registerId,
    ref: props.registerId,
    year: undefined,
    status: 'valid',
    isCurrent: false,
    isActive: true,
    conceptCount: undefined,
    registerId: props.registerId,
  };
  entries.push({
    member: selfMember,
    conceptUri: props.conceptUri,
    conceptId: props.conceptId,
    edgeType: 'self',
    hops: 0,
    isCurrentEdition: !!selfMember.isCurrent,
  });

  /* Walk the chain. Drop malformed URIs (no real concept id). */
  const chain = walkChain(props.conceptUri);
  for (const [uri, info] of chain) {
    if (uri === props.conceptUri) continue;
    const parsed = parseStrict(uri);
    if (!parsed) continue;
    if (entries.some(e => e.conceptUri === uri)) continue;

    const member = s?.members.find(m => m.id === parsed.registerId) ?? {
      id: parsed.registerId,
      ref: parsed.registerId,
      year: undefined,
      status: 'unknown',
      isCurrent: false,
      isActive: false,
      conceptCount: undefined,
      registerId: parsed.registerId,
    };

    entries.push({
      member,
      conceptUri: uri,
      conceptId: parsed.conceptId,
      edgeType: info.type,
      hops: info.hops,
      isCurrentEdition: !!member.isCurrent,
    });
  }

  /* Sort by year ascending (oldest first). */
  entries.sort((a, b) => (a.member.year ?? 9999) - (b.member.year ?? 9999));

  return entries;
});

const hasChain = computed(() => editionChain.value.length > 1);

function navigate(entry: EditionEntry) {
  if (entry.edgeType === 'self') return;
  router.push({
    name: 'concept',
    params: { registerId: entry.member.id, conceptId: entry.conceptId },
  });
}

function compare(entry: EditionEntry) {
  if (entry.edgeType === 'self') return;
  emit('compare', {
    registerId: entry.member.id,
    conceptId: entry.conceptId,
    label: entry.member.ref || entry.member.id,
  });
}

function edgeLabel(entry: EditionEntry): string {
  switch (entry.edgeType) {
    case 'supersedes':     return t('edge.supersedes');
    case 'superseded_by':  return t('edge.superseded_by');
    default:               return '';
  }
}
</script>

<template>
  <div v-if="series" class="card p-5">
    <div class="section-label">{{ t('concept.editionSeries') }}</div>
    <div class="mt-1 text-xs text-ink-400 italic">{{ series.title }}</div>

    <div class="mt-3 space-y-1">
      <div
        v-for="entry in editionChain"
        :key="entry.conceptUri"
        class="rounded-md transition-colors group"
        :class="entry.edgeType === 'self'
          ? 'bg-blue-50 dark:bg-blue-900/20'
          : 'hover:bg-ink-50 dark:hover:bg-ink-700/40'"
      >
        <button
          type="button"
          class="concept-link block w-full text-left px-1.5 py-1.5"
          :disabled="entry.edgeType === 'self'"
          @click="navigate(entry)"
        >
          <div class="flex items-center gap-1 mb-0.5">
            <span
              v-if="entry.isCurrentEdition"
              class="badge text-[9px] flex-shrink-0"
              :class="entry.edgeType === 'self' ? 'badge-blue' : 'badge-gray'"
              style="background: rgba(184, 147, 90, 0.18); color: #8C6A3A; border: 1px solid rgba(184, 147, 90, 0.35);"
              :title="t('concept.currentEdition')"
            >✦ {{ t('concept.currentEdition') }}</span>
            <span
              v-if="entry.edgeType !== 'self'"
              class="badge text-[9px] flex-shrink-0 badge-gray"
            >{{ edgeLabel(entry) }}</span>
            <span
              v-if="entry.edgeType === 'self'"
              class="badge text-[9px] flex-shrink-0 badge-blue"
            >{{ t('concept.viewing') }}</span>
          </div>
          <div class="flex items-baseline gap-2">
            <span class="font-mono text-xs text-ink-500 dark:text-ink-400 flex-shrink-0">
              {{ entry.member.year ?? '—' }}
            </span>
            <span class="text-sm text-ink-700 dark:text-ink-200 leading-snug truncate">
              {{ entry.member.ref }}
            </span>
          </div>
          <div
            v-if="entry.edgeType !== 'self' || entry.conceptId !== props.conceptId"
            class="font-mono text-[10px] text-ink-300 dark:text-ink-500 mt-0.5 leading-tight"
          >
            {{ entry.member.id }} · {{ entry.conceptId }}
          </div>
        </button>
        <button
          v-if="entry.edgeType !== 'self'"
          type="button"
          class="block w-full text-left px-1.5 pb-1.5 text-[10px] text-blue-600 dark:text-blue-400 hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
          @click="compare(entry)"
        >
          ⟷ {{ t('concept.compareWith') || 'Compare with this edition' }}
        </button>
      </div>
    </div>

    <div v-if="!hasChain" class="mt-3 pt-3 border-t border-ink-100/60 dark:border-ink-700/40">
      <div class="text-xs text-ink-400 italic">
        {{ t('concept.noChain') }}
      </div>
    </div>
  </div>
</template>

<style scoped>
/* No scoped styles — uses global `card`, `section-label`, `badge`, `concept-link` classes
   to match the rest of ConceptDetail's sidebar. */
</style>