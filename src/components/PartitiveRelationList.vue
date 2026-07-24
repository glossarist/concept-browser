<script setup lang="ts">
/**
 * PartitiveRelationList — renders one-to-many partitive decompositions
 * as ISO 704 rake diagrams. Each relation shows:
 *   - completeness badge (complete / partial)
 *   - plurality badge (shared / uncertain / sharedType) when present
 *   - criterion as italic text under the header
 *   - the rake diagram itself (PartitiveRelationDiagram)
 *
 * The diagram is the primary renderer. Badges in the header communicate
 * the metadata that the diagram's line styles also encode (so users who
 * can't perceive the visual difference still get the info).
 */
import type { PartitiveRelationWire, Manifest } from '../adapters/types';
import { useRouter } from 'vue-router';
import { useVocabularyStore } from '../stores/vocabulary';
import { getFactory } from '../adapters/factory';
import { useI18n, locale } from '../i18n';
import {
  completenessLabel,
  certaintyLabel,
} from '../utils/partitive-relation-styling';
import PartitiveRelationDiagram, {
  type PartitiveMemberLabeled,
} from './PartitiveRelationDiagram.vue';

const props = defineProps<{
  relations: PartitiveRelationWire[];
  manifest: Manifest;
  registerId: string;
}>();

const router = useRouter();
const store = useVocabularyStore();
const factory = getFactory();
const { t } = useI18n();

function designationFor(uri: string): string {
  const node = store.graph.getNode(uri);
  if (node) {
    const des = node.designations[locale.value]
      || node.designations.eng
      || Object.values(node.designations)[0];
    if (des) return des;
  }
  const resolution = factory.resolve(uri);
  if (resolution.type === 'internal') {
    const adapter = store.datasets.get(resolution.registerId);
    const entry = adapter?.getIndexEntry(resolution.conceptId);
    if (entry) {
      const des = entry.designations[locale.value]
        || entry.designations.eng
        || Object.values(entry.designations)[0];
      if (des) return des;
    }
  }
  return resolution.type === 'internal' ? resolution.conceptId : uri;
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

function labeledMembers(rel: PartitiveRelationWire): PartitiveMemberLabeled[] {
  return rel.partitives.map(m => ({
    uri: m.uri,
    label: designationFor(m.uri),
    certainty: m.certainty,
  }));
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
          {{ designationFor(rel.comprehensive) }}
        </button>
      </div>
      <div
        v-if="criterionText(rel.criterion)"
        class="px-3 py-1 text-xs text-emerald-800 dark:text-emerald-200 italic border-b border-emerald-200 dark:border-emerald-800"
      >
        {{ criterionText(rel.criterion) }}
      </div>
      <!-- Rake diagram (ISO 704 partitive-relation convention) -->
      <div class="px-3 py-3 overflow-x-auto">
        <PartitiveRelationDiagram
          :comprehensive-label="designationFor(rel.comprehensive)"
          :partitives="labeledMembers(rel)"
          :completeness="rel.completeness"
          :plurality="rel.plurality"
          :criterion="null"
          @navigate="navigate"
        />
      </div>
    </div>
  </div>
</template>
