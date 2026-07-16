<template>
  <div class="concept-diff-island">
    <!-- Edition selector -->
    <div v-if="editions.length > 1" class="mb-4">
      <label class="text-sm font-semibold text-ink-500 uppercase tracking-wider mr-2">Compare with:</label>
      <select v-model="compareEdition" class="text-sm border border-ink-200 dark:border-ink-700 rounded px-2 py-1 bg-surface dark:bg-ink-800 text-ink-600 dark:text-ink-300">
        <option value="">Select edition...</option>
        <option v-for="ed in otherEditions" :key="ed.id" :value="ed.id">
          {{ ed.title }} ({{ ed.year ?? '?' }})
        </option>
      </select>
    </div>

    <!-- Diff rendering -->
    <div v-if="diffResult && compareEdition" class="space-y-4">
      <!-- Similarity score -->
      <div v-if="diffResult.similarity != null" class="flex items-center gap-3">
        <div class="text-sm text-ink-500">Similarity:</div>
        <div class="flex-1 max-w-xs bg-ink-100 dark:bg-ink-800 rounded-full h-3 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="similarityColor(diffResult.similarity)"
            :style="{ width: `${Math.round(diffResult.similarity * 100)}%` }"
          />
        </div>
        <div class="text-sm font-medium" :class="similarityTextColor(diffResult.similarity)">
          {{ Math.round(diffResult.similarity * 100) }}%
        </div>
      </div>

      <!-- Per-field diffs -->
      <div v-for="(section, field) in sections" :key="field" class="card p-4">
        <h3 class="text-sm font-semibold text-ink-500 uppercase tracking-wider mb-3">{{ fieldLabel(field) }}</h3>
        <div v-if="section.type === 'added'" class="text-emerald-600 dark:text-emerald-400">
          <span class="text-xs font-medium bg-emerald-100 dark:bg-emerald-900/30 px-1.5 py-0.5 rounded mr-2">ADDED</span>
          <span dir="auto">{{ section.value }}</span>
        </div>
        <div v-else-if="section.type === 'removed'" class="text-red-500 dark:text-red-400 line-through opacity-70">
          <span class="text-xs font-medium bg-red-100 dark:bg-red-900/30 px-1.5 py-0.5 rounded mr-2 no-underline">REMOVED</span>
          <span dir="auto">{{ section.value }}</span>
        </div>
        <div v-else-if="section.type === 'changed'" class="space-y-1">
          <div class="text-red-500 dark:text-red-400 line-through opacity-70" dir="auto">{{ section.oldValue }}</div>
          <div class="text-emerald-600 dark:text-emerald-400" dir="auto">{{ section.newValue }}</div>
        </div>
        <div v-else-if="section.hunks" class="font-mono text-xs space-y-0.5">
          <span
            v-for="(hunk, i) in section.hunks"
            :key="i"
            :class="{
              'bg-emerald-100 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300': hunk.type === 'added',
              'bg-red-100 dark:bg-red-900/20 text-red-700 dark:text-red-300 line-through': hunk.type === 'removed',
              'text-ink-500': hunk.type === 'equal',
            }"
            dir="auto"
          >{{ hunk.text }}</span>
        </div>
        <div v-else class="text-xs text-ink-400 italic">No changes</div>
      </div>
    </div>

    <!-- No changes -->
    <div v-else-if="diffResult && diffResult.hasChanges === false" class="text-center py-8">
      <p class="text-ink-400">No differences between these editions.</p>
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="text-center py-8">
      <div class="inline-block w-8 h-8 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-2"></div>
      <p class="text-ink-400 text-sm">Comparing editions...</p>
    </div>

    <!-- Hint -->
    <div v-else-if="!compareEdition" class="text-center py-4">
      <p class="text-sm text-ink-400">Select an edition above to see what changed.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { diffConcepts } from 'glossarist/diff';
import type { ConceptDiff } from 'glossarist/diff';

const props = defineProps<{
  currentConcept: any;
  registerId: string;
  editions: Array<{
    id: string;
    title: string;
    year?: number;
    conceptData?: any;
  }>;
}>();

const compareEdition = ref('');
const diffResult = ref<ConceptDiff | null>(null);
const loading = ref(false);

const otherEditions = computed(() =>
  props.editions.filter(e => e.id !== props.registerId)
);

watch(compareEdition, async (edId) => {
  if (!edId) {
    diffResult.value = null;
    return;
  }
  const edition = props.editions.find(e => e.id === edId);
  if (!edition?.conceptData) {
    diffResult.value = null;
    return;
  }
  loading.value = true;
  try {
    const oldConcept = toConceptLike(edition.conceptData, edId);
    const newConcept = toConceptLike(props.currentConcept, props.registerId);
    diffResult.value = diffConcepts(oldConcept, newConcept);
  } catch (e) {
    console.error('Diff failed:', e);
    diffResult.value = null;
  } finally {
    loading.value = false;
  }
});

function toConceptLike(data: any, registerId: string) {
  const langs = data.languages ?? (data.localizations ? Object.keys(data.localizations) : []);
  return {
    id: data.conceptId ?? data.id,
    termid: String(data.conceptId ?? data.id),
    status: data.status,
    languages: langs,
    localization(lang: string) {
      const loc = (data.localizations ?? {})[lang];
      if (!loc) return null;
      return {
        languageCode: loc.languageCode ?? lang,
        terms: loc.terms ?? [],
        definitions: loc.definitions ?? [],
        notes: loc.notes ?? [],
        examples: loc.examples ?? [],
      };
    },
  };
}

const sections = computed(() => {
  if (!diffResult.value) return {};
  const out: Record<string, any> = {};
  const diff = diffResult.value as any;
  const loc = diff.localization?.('eng') ?? diff.localizations?.eng;
  if (!loc) return out;

  const defChanged = loc.definitions?.changed?.[0];
  if (defChanged?.textDiff?.hunks?.length) {
    out.definition = { hunks: defChanged.textDiff.hunks };
  } else if (loc.definitions?.added?.length) {
    out.definition = { type: 'added', value: loc.definitions.added[0].value?.content ?? loc.definitions.added[0].value };
  } else if (loc.definitions?.removed?.length) {
    out.definition = { type: 'removed', value: loc.definitions.removed[0].value?.content ?? loc.definitions.removed[0].value };
  }

  const termChanged = loc.designations?.changed?.[0];
  if (termChanged?.textDiff?.hunks?.length) {
    out.terms = { hunks: termChanged.textDiff.hunks };
  } else if (loc.designations?.added?.length || loc.designations?.removed?.length) {
    out.terms = {
      type: 'changed',
      oldValue: (loc.designations.removed ?? []).map((d: any) => d.value?.designation ?? d.value?.text ?? String(d.value ?? '')).join('; '),
      newValue: (loc.designations.added ?? []).map((d: any) => d.value?.designation ?? d.value?.text ?? String(d.value ?? '')).join('; '),
    };
  }

  if (loc.notes?.added?.length || loc.notes?.removed?.length) {
    out.notes = {
      type: 'changed',
      oldValue: (loc.notes.removed ?? []).map((n: any) => n.value?.content ?? n.value?.text ?? String(n.value ?? '')).join('; '),
      newValue: (loc.notes.added ?? []).map((n: any) => n.value?.content ?? n.value?.text ?? String(n.value ?? '')).join('; '),
    };
  }

  if (loc.examples?.added?.length || loc.examples?.removed?.length) {
    out.examples = {
      type: 'changed',
      oldValue: (loc.examples.removed ?? []).map((e: any) => e.value?.content ?? e.value?.text ?? String(e.value ?? '')).join('; '),
      newValue: (loc.examples.added ?? []).map((e: any) => e.value?.content ?? e.value?.text ?? String(e.value ?? '')).join('; '),
    };
  }

  return out;
});

function fieldLabel(field: string): string {
  const labels: Record<string, string> = {
    definition: 'Definition',
    terms: 'Terms',
    notes: 'Notes',
    examples: 'Examples',
  };
  return labels[field] ?? field;
}

function similarityColor(score: number): string {
  if (score >= 0.8) return 'bg-emerald-500';
  if (score >= 0.5) return 'bg-amber-500';
  return 'bg-red-500';
}
function similarityTextColor(score: number): string {
  if (score >= 0.8) return 'text-emerald-600 dark:text-emerald-400';
  if (score >= 0.5) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}
</script>
