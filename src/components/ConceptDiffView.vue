<script setup lang="ts">
/**
 * ConceptDiffView — render a side-by-side diff between two concepts.
 *
 * Replaces the two orphan islands (ConceptDiffIsland,
 * SupersessionDiffIsland). One component, driven by props:
 *   - `oldConcept` / `newConcept` — wire shapes (ConceptLikeData)
 *   - `lang` — which language's diff to render (default 'eng')
 *
 * The diff itself is computed by the parent (via useConceptDiff)
 * and passed in as `diff`, OR computed here from the two concepts.
 * The first form is preferred when the parent already has the diff
 * cached; the second form is for one-shot comparisons.
 */
import { computed, watchEffect } from 'vue';
import type { ConceptDiff } from 'glossarist/diff';
import type { ConceptLikeData } from '../composables/use-concept-diff';
import {
  useConceptDiff,
  deriveDiffSections,
  computeSimilarity,
} from '../composables/use-concept-diff';

const props = withDefaults(defineProps<{
  oldConcept: ConceptLikeData | null;
  newConcept: ConceptLikeData | null;
  lang?: string;
  /** Optional precomputed diff (skips internal diffConcepts call). */
  diff?: ConceptDiff | null;
  /** Optional label for the comparison direction. */
  oldLabel?: string;
  newLabel?: string;
}>(), {
  lang: 'eng',
  diff: null,
  oldLabel: 'Previous',
  newLabel: 'Current',
});

const internal = useConceptDiff();

watchEffect(() => {
  if (props.diff) {
    internal.clear();
    return;
  }
  if (props.oldConcept && props.newConcept) {
    internal.diff(props.oldConcept, props.newConcept);
  } else {
    internal.clear();
  }
});

const effectiveDiff = computed(() => (props.diff ?? internal.diffResult.value) as any);
const sections = computed(() => deriveDiffSections(effectiveDiff.value, props.lang));
const similarity = computed(() => computeSimilarity(effectiveDiff.value));
const hasChanges = computed(() => effectiveDiff.value?.hasChanges === true);
const loading = computed(() => internal.loading.value);
const error = computed(() => internal.error.value);

function similarityBarColor(score: number): string {
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

<template>
  <div class="concept-diff-view space-y-4">
    <header v-if="oldLabel || newLabel" class="flex items-center justify-between text-xs">
      <span class="text-ink-400">{{ oldLabel }} → {{ newLabel }}</span>
    </header>

    <div v-if="error" class="card p-4 border-red-200 bg-red-50/50">
      <p class="text-sm text-red-700">{{ error }}</p>
    </div>

    <div v-if="loading" class="text-center py-6 text-sm text-ink-400">Comparing…</div>

    <template v-else-if="effectiveDiff">
      <!-- Similarity score -->
      <div v-if="similarity != null" class="flex items-center gap-3">
        <span class="text-xs text-ink-400 w-20">Similarity</span>
        <div class="flex-1 max-w-xs bg-ink-100 dark:bg-ink-800 rounded-full h-2.5 overflow-hidden">
          <div
            class="h-full rounded-full transition-all duration-300"
            :class="similarityBarColor(similarity)"
            :style="{ width: `${Math.round(similarity * 100)}%` }"
          />
        </div>
        <span class="text-sm font-medium" :class="similarityTextColor(similarity)">
          {{ Math.round(similarity * 100) }}%
        </span>
      </div>

      <p v-if="!hasChanges" class="text-center py-4 text-sm text-ink-400 italic">
        No differences between these versions.
      </p>

      <!-- Definition -->
      <section v-if="sections.definition" class="card p-4">
        <h3 class="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Definition</h3>
        <div class="font-mono text-xs leading-relaxed">
          <template v-if="sections.definition.hunks">
            <span
              v-for="(hunk, i) in sections.definition.hunks"
              :key="i"
              :class="{
                'bg-emerald-100/70 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300': hunk.type === 'added',
                'bg-red-100/70 dark:bg-red-900/20 text-red-700 dark:text-red-300 line-through': hunk.type === 'removed',
                'text-ink-500': hunk.type === 'equal',
              }"
              dir="auto"
            >{{ hunk.text }} </span>
          </template>
          <span v-else-if="sections.definition.type === 'added'" class="text-emerald-600 dark:text-emerald-400" dir="auto">
            {{ sections.definition.value }}
          </span>
          <span v-else-if="sections.definition.type === 'removed'" class="text-red-500 dark:text-red-400 line-through" dir="auto">
            {{ sections.definition.value }}
          </span>
        </div>
      </section>

      <!-- Designations -->
      <section v-if="sections.designations?.items?.length" class="card p-4">
        <h3 class="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Designations</h3>
        <div class="space-y-1">
          <div
            v-for="(item, i) in sections.designations.items"
            :key="i"
            class="flex items-baseline gap-2 text-sm"
          >
            <span
              :class="{
                'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300': item.type === 'added',
                'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300': item.type === 'removed',
              }"
              class="text-xs px-1.5 py-0.5 rounded font-medium"
            >{{ item.type ?? 'same' }}</span>
            <span :class="{ 'line-through opacity-60': item.type === 'removed' }" dir="auto">{{ item.text }}</span>
          </div>
        </div>
      </section>

      <!-- Notes -->
      <section v-if="sections.notes?.items?.length" class="card p-4">
        <h3 class="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Notes</h3>
        <div class="space-y-1">
          <div
            v-for="(item, i) in sections.notes.items"
            :key="i"
            class="text-sm flex items-baseline gap-2"
          >
            <span
              class="text-xs px-1.5 py-0.5 rounded"
              :class="item.type === 'added' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'"
            >{{ item.type }}</span>
            <span :class="{ 'line-through opacity-60': item.type === 'removed' }" dir="auto">{{ item.text }}</span>
          </div>
        </div>
      </section>

      <!-- Examples -->
      <section v-if="sections.examples?.items?.length" class="card p-4">
        <h3 class="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Examples</h3>
        <div class="space-y-1">
          <div
            v-for="(item, i) in sections.examples.items"
            :key="i"
            class="text-sm flex items-baseline gap-2"
          >
            <span
              class="text-xs px-1.5 py-0.5 rounded"
              :class="item.type === 'added' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'"
            >{{ item.type }}</span>
            <span :class="{ 'line-through opacity-60': item.type === 'removed' }" dir="auto">{{ item.text }}</span>
          </div>
        </div>
      </section>
    </template>

    <div v-else class="text-center py-6 text-sm text-ink-400">
      Select an edition to compare.
    </div>
  </div>
</template>
