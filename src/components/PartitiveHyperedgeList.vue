<script setup lang="ts">
/**
 * PartitiveRelationList — renders one-to-many partitive decompositions
 * as grouped cards. Each hyperedge shows:
 *   - the comprehensive (whole) concept as the card header
 *   - the parts as indented children
 *   - enumeration badge (closed / open)
 *   - marker badges (double / dashed) when present
 *   - optional content (label / note)
 *
 * Independent of RelationshipList.vue, which renders binary edges.
 * Both consume the same edges/hyperedges stores but render in
 * separate sections.
 *
 * See concept-model/TODO.hyperedge/00-design-overview.md.
 */
import type { PartitiveRelation, Manifest } from '../adapters/types';
import { useRouter } from 'vue-router';
import { useVocabularyStore } from '../stores/vocabulary';
import { getFactory } from '../adapters/factory';
import { useI18n } from '../i18n';
import { hyperedgeStyle, markerColor, enumerationLabel } from '../utils/hyperedge-styling';
import { conceptIdFromUri } from '../utils/concept-helpers';

const props = defineProps<{
  hyperedges: PartitiveRelation[];
  manifest: Manifest;
  registerId: string;
}>();

const emit = defineEmits<{
  (e: 'navigate', registerId: string, conceptId: string): void;
}>();

const router = useRouter();
const store = useVocabularyStore();
const factory = getFactory();
const { t } = useI18n();

function labelFor(uri: string): string {
  const parsed = factory.resolve(uri);
  if (parsed.type === 'internal') {
    return conceptIdFromUri(uri) || uri;
  }
  return uri;
}

function navigate(uri: string) {
  const parsed = factory.resolve(uri);
  if (parsed.type === 'internal') {
    store.viewConcept(parsed.registerId, parsed.conceptId);
    router.push({
      name: 'concept',
      params: { registerId: parsed.registerId, conceptId: parsed.conceptId },
    });
  }
}

function enumerationBadge(e: 'closed' | 'open'): string {
  return e === 'open'
    ? t('partitive.enumeration.open') || 'open'
    : t('partitive.enumeration.closed') || 'closed';
}
</script>

<template>
  <div v-if="hyperedges.length > 0" class="space-y-3">
    <div class="section-label flex items-center gap-1.5 mb-2">
      <span class="inline-block w-2 h-2 rounded-full bg-emerald-600"></span>
      {{ t('partitive.hyperedges') || 'Partitive groups' }}
    </div>
    <div
      v-for="(he, i) in hyperedges"
      :key="i"
      class="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 overflow-hidden"
    >
      <div class="px-3 py-2 flex items-center gap-2 border-b border-emerald-200 dark:border-emerald-800">
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 uppercase">
          {{ enumerationBadge(he.enumeration) }}
        </span>
        <span
          v-for="marker in he.markers"
          :key="marker"
          class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 uppercase"
          :title="marker === 'double' ? 'close-set double line: several parts of same type' : 'dashed line: plurality uncertain'"
        >
          {{ marker }}
        </span>
        <button
          @click="navigate(he.comprehensive)"
          class="ml-auto text-sm font-medium text-emerald-900 dark:text-emerald-100 hover:underline truncate"
        >
          {{ labelFor(he.comprehensive) }}
        </button>
      </div>
      <div v-if="he.label" class="px-3 py-1 text-xs text-emerald-800 dark:text-emerald-200 italic border-b border-emerald-200 dark:border-emerald-800">
        {{ he.label }}
      </div>
      <ul class="divide-y divide-emerald-100 dark:divide-emerald-900/30">
        <li v-for="(part, j) in he.parts" :key="j">
          <button
            @click="navigate(part)"
            class="block w-full text-left px-3 py-1.5 text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100"
          >
            <span class="text-emerald-600 dark:text-emerald-400 mr-2">└</span>
            {{ labelFor(part) }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
