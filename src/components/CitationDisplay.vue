<script setup lang="ts">
import type { Citation } from 'glossarist';
import type { CitationClassification, CiteResolution } from '../adapters/types';
import { computed, ref } from 'vue';
import { getFactory } from '../adapters/factory';
import { useRouter } from 'vue-router';
import { useVocabularyStore } from '../stores/vocabulary';

const props = defineProps<{
  citation: Citation;
  registerId?: string;
}>();

const router = useRouter();
const store = useVocabularyStore();
const factory = getFactory();

// ── Single source of truth for citation resolution ────────────────────────
// Both classification and navigation target come from the same resolveCite()
// call, so they can never disagree.

const citeResolution = computed<CiteResolution>(() =>
  factory.resolver.resolveCite(props.citation, props.registerId),
);

const classification = computed<CitationClassification>(() =>
  citeResolution.value.classification,
);

const resolvedTarget = computed(() => citeResolution.value.resolved);

const isCrossDataset = computed(() =>
  resolvedTarget.value != null && resolvedTarget.value.registerId !== props.registerId,
);

// ── Navigation ────────────────────────────────────────────────────────────

async function navigateToCitation() {
  if (!resolvedTarget.value) return;
  const { registerId, conceptId } = resolvedTarget.value;
  await store.viewConcept(registerId, conceptId);
  router.push({ name: 'concept', params: { registerId, conceptId } });
}

// ── Wrapper element determined by classification ──────────────────────────
// Internal → button (navigates to concept)
// Self-contained with link → anchor (external link)
// Everything else → span (plain text)

const sourceTag = computed(() => {
  if (classification.value === 'internal-citation') return 'button';
  if (classification.value === 'self-contained-citation' && props.citation.link) return 'a';
  return 'span';
});

const sourceAttrs = computed(() => {
  if (sourceTag.value === 'button') {
    return { class: 'concept-link font-medium inline-flex items-center gap-0.5' };
  }
  if (sourceTag.value === 'a') {
    return { href: props.citation.link!, target: '_blank', rel: 'noopener', class: 'concept-link font-medium' };
  }
  return { class: 'font-medium' };
});

const sourceEvents = computed(() => {
  if (sourceTag.value !== 'button') return {};
  return {
    onClick: navigateToCitation,
    onMouseenter: schedulePreview,
  };
});

// ── Hover preview ─────────────────────────────────────────────────────────

const triggerEl = ref<HTMLElement | null>(null);
const preview = ref<{ designation: string; definition: string } | null>(null);
const previewVisible = ref(false);
let previewTimer: ReturnType<typeof setTimeout> | null = null;

const previewStyle = computed(() => {
  if (!triggerEl.value) return {};
  const rect = triggerEl.value.getBoundingClientRect();
  return {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(8, Math.min(rect.left, window.innerWidth - 336))}px`,
  };
});

async function loadPreview() {
  if (!resolvedTarget.value || preview.value) return;
  const { registerId, conceptId } = resolvedTarget.value;
  const adapter = factory.getAdapter(registerId);
  if (!adapter) return;

  try {
    const entry = adapter.getIndexEntry(conceptId);
    if (entry && !preview.value) {
      preview.value = {
        designation: entry.designations?.eng || entry.eng || conceptId,
        definition: '',
      };
    }

    const concept = await adapter.fetchConcept(conceptId);
    const lc = concept.localization('eng');
    const def = lc?.definitions?.[0]?.content || concept.definition('eng');
    const term = lc?.terms?.[0]?.designation || concept.primaryDesignation('eng');
    preview.value = {
      designation: String(term || entry?.designations?.eng || conceptId),
      definition: typeof def === 'string' ? def.slice(0, 200) : '',
    };
  } catch {
    // Concept not available — preview stays with index data or empty
  }
}

function schedulePreview(e: MouseEvent) {
  triggerEl.value = e.currentTarget as HTMLElement;
  previewVisible.value = true;
  previewTimer = setTimeout(loadPreview, 400);
}

function hidePreview() {
  if (previewTimer) { clearTimeout(previewTimer); previewTimer = null; }
  previewVisible.value = false;
}

// ── Locality formatting ───────────────────────────────────────────────────

function formatLocality(loc: NonNullable<Citation['locality']>): string {
  const parts: string[] = [];
  const lType = (loc as unknown as Record<string, unknown>).type as string | null;
  const from = (loc as unknown as Record<string, unknown>).referenceFrom ?? (loc as unknown as Record<string, unknown>).reference_from;
  const to = (loc as unknown as Record<string, unknown>).referenceTo ?? (loc as unknown as Record<string, unknown>).reference_to;
  if (lType) parts.push(`, ${lType}`);
  if (from) parts.push(to ? ` ${from}–${to}` : ` ${from}`);
  return parts.join('');
}
</script>

<template>
  <span class="inline" @mouseleave="hidePreview">
    <!-- Source reference: dynamic wrapper (button/a/span) -->
    <template v-if="citation.ref?.source">
      <component
        :is="sourceTag"
        v-bind="sourceAttrs"
        v-on="sourceEvents"
      >
        {{ citation.ref.source }}
        <span v-if="isCrossDataset" class="text-[10px] opacity-60 leading-none">↗</span>
      </component>
      <span v-if="citation.ref.id"> {{ citation.ref.id }}</span>
      <span v-if="citation.ref.version" class="text-ink-400"> ({{ citation.ref.version }})</span>
    </template>

    <!-- Locality: same formatting across all classifications -->
    <template v-if="citation.locality">
      <button
        v-if="classification === 'internal-citation'"
        @click="navigateToCitation"
        @mouseenter="schedulePreview"
        class="concept-link"
      >
        {{ formatLocality(citation.locality) }}
      </button>
      <span v-else class="text-ink-400">
        {{ formatLocality(citation.locality) }}
      </span>
    </template>

    <!-- External link badge (only for non-self-contained citations that have a link) -->
    <a
      v-if="citation.link && classification !== 'self-contained-citation'"
      :href="citation.link"
      target="_blank"
      rel="noopener"
      class="concept-link ml-1"
    >[link]</a>

    <span v-if="citation.original" class="text-xs text-ink-300 ml-1">(orig: {{ citation.original }})</span>
    <span v-if="resolvedTarget" class="text-[9px] text-ink-300 ml-1">→ {{ resolvedTarget.registerId }}/{{ resolvedTarget.conceptId }}</span>

    <!-- Hover preview tooltip -->
    <Teleport to="body">
      <div
        v-if="previewVisible && preview"
        class="citation-preview"
        @mouseenter="previewVisible = true"
        @mouseleave="hidePreview"
        :style="previewStyle"
      >
        <div class="citation-preview-title">{{ preview.designation }}</div>
        <div v-if="preview.definition" class="citation-preview-def">{{ preview.definition }}</div>
        <div v-if="resolvedTarget" class="citation-preview-dataset">{{ resolvedTarget.registerId }}</div>
      </div>
    </Teleport>
  </span>
</template>

<style scoped>
.citation-preview {
  position: fixed;
  z-index: 50;
  max-width: 320px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  line-height: 1.4;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  pointer-events: auto;
  background: var(--color-bg, #fff);
  color: var(--color-ink, #1a1a1a);
  border: 1px solid var(--color-border, #e5e5e5);
}
:global(.dark) .citation-preview {
  background: var(--color-bg, #1a1a2e);
  color: var(--color-ink, #e5e5e5);
  border-color: var(--color-border, #333);
}
.citation-preview-title {
  font-weight: 600;
  margin-bottom: 4px;
}
.citation-preview-def {
  color: var(--color-ink-600, #555);
  font-size: 12px;
}
:global(.dark) .citation-preview-def {
  color: var(--color-ink-400, #999);
}
.citation-preview-dataset {
  margin-top: 4px;
  font-size: 11px;
  color: var(--brand-primary);
  opacity: 0.8;
}
</style>
