<template>
  <div class="supersession-diff">
    <!-- Supersession badge -->
    <div v-if="supersedes || supersededBy" class="mb-4 flex items-center gap-2 flex-wrap">
      <span v-if="supersededBy" class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12"/></svg>
        Superseded by
        <a :href="`/dataset/${supersededBy.registerId}/concept/${supersededBy.conceptId}`" class="underline hover:text-amber-800 dark:hover:text-amber-200">
          {{ supersededBy.term || supersededBy.conceptId }}
        </a>
        <button v-if="supersededBy.conceptData" @click="compareWith(supersededBy)" class="ml-1 text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 underline">
          compare →
        </button>
      </span>
      <span v-if="supersedes" class="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-medium">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6"/></svg>
        Supersedes
        <a :href="`/dataset/${supersedes.registerId}/concept/${supersedes.conceptId}`" class="underline hover:text-blue-800 dark:hover:text-blue-200">
          {{ supersedes.term || supersedes.conceptId }}
        </a>
        <button v-if="supersedes.conceptData" @click="compareWith(supersedes)" class="ml-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 underline">
          compare →
        </button>
      </span>
    </div>

    <!-- Comparison panel (slides in when user clicks "compare") -->
    <Transition name="slide-down">
      <div v-if="activeComparison" class="mt-4 border border-ink-200 dark:border-ink-700 rounded-lg overflow-hidden">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 py-2.5 bg-ink-50/50 dark:bg-ink-800/30 border-b border-ink-100/60 dark:border-ink-700/40">
          <div class="flex items-center gap-3">
            <span class="text-sm font-medium text-ink-600 dark:text-ink-300">
              Comparing: {{ concept.designations?.eng ?? concept.conceptId }}
            </span>
            <svg class="w-4 h-4 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8l4 4m0 0l-4 4m4-4H3"/></svg>
            <span class="text-sm font-medium text-ink-600 dark:text-ink-300">
              {{ activeComparison.term || activeComparison.conceptId }}
            </span>
          </div>
          <button @click="activeComparison = null; diffResult = null" class="text-ink-400 hover:text-ink-600 dark:hover:text-ink-200">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        </div>

        <!-- Diff content -->
        <div class="p-4 space-y-4">
          <!-- Similarity score -->
          <div v-if="diffResult?.similarity != null" class="flex items-center gap-3">
            <span class="text-xs text-ink-400 w-20">Similarity</span>
            <div class="flex-1 max-w-xs bg-ink-100 dark:bg-ink-800 rounded-full h-2.5 overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="similarityColor(diffResult.similarity)"
                :style="{ width: `${Math.round(diffResult.similarity * 100)}%` }"
              />
            </div>
            <span class="text-sm font-medium" :class="similarityTextColor(diffResult.similarity)">
              {{ Math.round(diffResult.similarity * 100) }}%
            </span>
            <span v-if="diffResult.stats" class="text-xs text-ink-400">
              (+{{ diffResult.stats.added }} / -{{ diffResult.stats.removed }} / ~{{ diffResult.stats.changed }})
            </span>
          </div>

          <!-- Definition diff -->
          <section v-if="diffSections.definition">
            <h4 class="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Definition</h4>
            <div class="font-mono text-xs leading-relaxed">
              <template v-if="diffSections.definition.hunks">
                <span
                  v-for="(hunk, i) in diffSections.definition.hunks"
                  :key="i"
                  :class="{
                    'bg-emerald-100/70 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300': hunk.type === 'added',
                    'bg-red-100/70 dark:bg-red-900/20 text-red-700 dark:text-red-300 line-through': hunk.type === 'removed',
                    'text-ink-500': hunk.type === 'equal',
                  }"
                  dir="auto"
                >{{ hunk.text }} </span>
              </template>
              <span v-else-if="diffSections.definition.type === 'added'" class="text-emerald-600 dark:text-emerald-400" dir="auto">
                {{ diffSections.definition.value }}
              </span>
              <span v-else-if="diffSections.definition.type === 'removed'" class="text-red-500 dark:text-red-400 line-through" dir="auto">
                {{ diffSections.definition.value }}
              </span>
            </div>
          </section>

          <!-- Designations diff -->
          <section v-if="diffSections.designations">
            <h4 class="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Designations</h4>
            <div class="space-y-1">
              <div v-for="(item, i) in diffSections.designations.items" :key="i" class="flex items-baseline gap-2 text-sm">
                <span
                  :class="{
                    'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300': item.type === 'added',
                    'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300': item.type === 'removed',
                    'bg-ink-100 dark:bg-ink-800 text-ink-500': !item.type,
                  }"
                  class="text-xs px-1.5 py-0.5 rounded font-medium"
                >{{ item.type ?? 'same' }}</span>
                <span :class="{ 'line-through opacity-60': item.type === 'removed' }" dir="auto">{{ item.text }}</span>
              </div>
            </div>
          </section>

          <!-- Notes / Examples changes -->
          <section v-if="diffSections.notes?.length || diffSections.examples?.length">
            <h4 class="text-xs font-semibold text-ink-400 uppercase tracking-wider mb-2">Other changes</h4>
            <div class="space-y-1">
              <div v-for="(note, i) in diffSections.notes" :key="'n'+i" class="text-sm flex items-baseline gap-2">
                <span class="text-xs px-1.5 py-0.5 rounded" :class="note.type === 'added' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'">
                  note {{ note.type }}
                </span>
                <span dir="auto">{{ note.text }}</span>
              </div>
              <div v-for="(ex, i) in diffSections.examples" :key="'e'+i" class="text-sm flex items-baseline gap-2">
                <span class="text-xs px-1.5 py-0.5 rounded" :class="ex.type === 'added' ? 'bg-emerald-100 text-emerald-600' : 'bg-red-100 text-red-600'">
                  example {{ ex.type }}
                </span>
                <span dir="auto">{{ ex.text }}</span>
              </div>
            </div>
          </section>

          <!-- No changes -->
          <div v-if="diffResult && !diffResult.hasChanges" class="text-center py-4">
            <p class="text-sm text-ink-400">Concepts are identical — no textual differences detected.</p>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { diffConcepts } from 'glossarist/diff';
import type { ConceptDiff } from 'glossarist/diff';

interface SupersessionTarget {
  conceptId: string;
  registerId: string;
  term?: string;
  conceptData?: any;
}

const props = defineProps<{
  concept: any;
  registerId: string;
  supersedes?: SupersessionTarget | null;
  supersededBy?: SupersessionTarget | null;
}>();

const activeComparison = ref<SupersessionTarget | null>(null);
const diffResult = ref<ConceptDiff | null>(null);

async function compareWith(target: SupersessionTarget) {
  if (!target.conceptData) return;
  activeComparison.value = target;
  diffResult.value = null;

  try {
    const oldConcept = target === props.supersedes ? target.conceptData : props.concept;
    const newConcept = target === props.supersedes ? props.concept : target.conceptData;
    diffResult.value = diffConcepts(
      toConceptLike(oldConcept),
      toConceptLike(newConcept),
    );
  } catch (e) {
    console.error('Supersession diff failed:', e);
  }
}

function toConceptLike(data: any) {
  const langs = data.languages ?? (data.localizations ? Object.keys(data.localizations) : []);
  return {
    id: data.conceptId ?? data.id,
    termid: String(data.conceptId ?? data.id),
    status: data.status,
    uri: data.uri,
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

const diffSections = computed(() => {
  if (!diffResult.value) return {};
  const diff = diffResult.value as any;
  const loc = diff.localization?.('eng') ?? diff.localizations?.eng;
  if (!loc) return {};
  const out: any = {};

  const defChanged = loc.definitions?.changed?.[0];
  if (defChanged?.textDiff?.hunks?.length) {
    out.definition = { hunks: defChanged.textDiff.hunks };
  } else if (loc.definitions?.added?.length) {
    out.definition = { type: 'added', value: loc.definitions.added[0].value?.content ?? loc.definitions.added[0].value };
  } else if (loc.definitions?.removed?.length) {
    out.definition = { type: 'removed', value: loc.definitions.removed[0].value?.content ?? loc.definitions.removed[0].value };
  }

  if (loc.designations?.added?.length || loc.designations?.removed?.length || loc.designations?.changed?.length) {
    const items: Array<{ type?: string; text: string }> = [];
    for (const d of loc.designations.added ?? []) {
      items.push({ type: 'added', text: d.value?.designation ?? d.value?.text ?? String(d.value ?? '') });
    }
    for (const d of loc.designations.removed ?? []) {
      items.push({ type: 'removed', text: d.value?.designation ?? d.value?.text ?? String(d.value ?? '') });
    }
    for (const d of loc.designations.changed ?? []) {
      items.push({ type: 'removed', text: d.oldValue?.designation ?? d.oldValue?.text ?? String(d.oldValue ?? '') });
      items.push({ type: 'added', text: d.newValue?.designation ?? d.newValue?.text ?? String(d.newValue ?? '') });
    }
    out.designations = { items };
  }

  if (loc.notes?.added?.length || loc.notes?.removed?.length) {
    out.notes = [
      ...(loc.notes.added ?? []).map((n: any) => ({ type: 'added', text: n.value?.content ?? n.value?.text ?? String(n.value ?? '') })),
      ...(loc.notes.removed ?? []).map((n: any) => ({ type: 'removed', text: n.value?.content ?? n.value?.text ?? String(n.value ?? '') })),
    ];
  }

  if (loc.examples?.added?.length || loc.examples?.removed?.length) {
    out.examples = [
      ...(loc.examples.added ?? []).map((e: any) => ({ type: 'added', text: e.value?.content ?? e.value?.text ?? String(e.value ?? '') })),
      ...(loc.examples.removed ?? []).map((e: any) => ({ type: 'removed', text: e.value?.content ?? e.value?.text ?? String(e.value ?? '') })),
    ];
  }

  return out;
});

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

<style scoped>
.slide-down-enter-active, .slide-down-leave-active {
  transition: all 0.3s ease;
}
.slide-down-enter-from, .slide-down-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}
</style>
