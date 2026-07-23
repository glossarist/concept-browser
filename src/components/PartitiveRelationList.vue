<script setup lang="ts">
/**
 * PartitiveRelationList — renders one-to-many partitive decompositions
 * as grouped cards. Each relation shows:
 *   - the comprehensive (whole) concept as the card header
 *   - each partitive member as an indented child with a certainty badge
 *   - completeness badge (complete / partial)
 *   - plurality badge (shared / uncertain / sharedType) when present
 *   - criterion as italic text under the title
 *
 * Independent of RelationshipList.vue, which renders binary edges.
 * Both consume the same stores but render in separate sections.
 *
 * v2 shape per concept-model/TODO.partitive-relation-v2.
 */
import type { PartitiveRelationWire, Manifest } from '../adapters/types';
import { useRouter } from 'vue-router';
import { useVocabularyStore } from '../stores/vocabulary';
import { getFactory } from '../adapters/factory';
import { useI18n } from '../i18n';
import {
  partitiveRelationStyle,
  completenessLabel,
  certaintyLabel,
} from '../utils/partitive-relation-styling';

const props = defineProps<{
  relations: PartitiveRelationWire[];
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
    return parsed.conceptId || uri;
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

function criterionText(criterion?: Record<string, string>): string | null {
  if (!criterion) return null;
  return criterion[props.manifest.id]
    ?? criterion.default
    ?? criterion.eng
    ?? Object.values(criterion)[0]
    ?? null;
}

function pluralityBadge(plurality: NonNullable<PartitiveRelationWire['plurality']>): string {
  if (!plurality.isShared) return '';
  let label = t('partitive.plurality.shared') || 'shared type';
  if (plurality.isUncertain) {
    label = `${label} (${t('partitive.plurality.uncertain') || 'uncertain'})`;
  }
  if (plurality.sharedType) {
    label = `${label}: ${plurality.sharedType}`;
  }
  return label;
}
</script>

<template>
  <div v-if="relations.length > 0" class="space-y-3">
    <div class="section-label flex items-center gap-1.5 mb-2">
      <span class="inline-block w-2 h-2 rounded-full bg-emerald-600"></span>
      {{ t('partitive.relations') || 'Partitive relations' }}
    </div>
    <div
      v-for="(rel, i) in relations"
      :key="i"
      class="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 overflow-hidden"
    >
      <div class="px-3 py-2 flex items-center gap-2 border-b border-emerald-200 dark:border-emerald-800">
        <span class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-200 dark:bg-emerald-800 text-emerald-900 dark:text-emerald-100 uppercase">
          {{ completenessLabel(rel.completeness) }}
        </span>
        <span
          v-if="rel.plurality && rel.plurality.isShared"
          class="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100 uppercase"
          :title="pluralityBadge(rel.plurality)"
        >
          {{ pluralityBadge(rel.plurality) }}
        </span>
        <button
          @click="navigate(rel.comprehensive)"
          class="ml-auto text-sm font-medium text-emerald-900 dark:text-emerald-100 hover:underline truncate"
        >
          {{ labelFor(rel.comprehensive) }}
        </button>
      </div>
      <div
        v-if="criterionText(rel.criterion)"
        class="px-3 py-1 text-xs text-emerald-800 dark:text-emerald-200 italic border-b border-emerald-200 dark:border-emerald-800"
      >
        {{ criterionText(rel.criterion) }}
      </div>
      <ul class="divide-y divide-emerald-100 dark:divide-emerald-900/30">
        <li v-for="(member, j) in rel.partitives" :key="j">
          <button
            @click="navigate(member.uri)"
            class="block w-full text-left px-3 py-1.5 text-sm hover:bg-emerald-100 dark:hover:bg-emerald-900/30 text-emerald-900 dark:text-emerald-100"
            :class="{ 'opacity-60': member.certainty === 'possible' }"
          >
            <span class="text-emerald-600 dark:text-emerald-400 mr-2">└</span>
            {{ labelFor(member.uri) }}
            <span
              v-if="member.certainty === 'possible'"
              class="ml-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 uppercase"
              :title="'plurality uncertain (ISO 704 broken line)'"
            >
              {{ certaintyLabel(member.certainty) }}
            </span>
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
