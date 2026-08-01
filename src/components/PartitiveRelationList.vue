<script setup lang="ts">
/**
 * PartitiveRelationList — renders one-to-many partitive decompositions
 * as ISO 704 rake diagrams. Each relation card shows:
 *   - completeness badge (Complete / Partial)
 *   - the comprehensive's designation as the card title
 *   - optional criterion as italic text
 *   - the rake diagram itself (PartitiveRelationDiagram), where each
 *     drop's line style encodes its multiplicity + is_delimiting per
 *     ISO 704:2022 (5 multiplicity values × 2 delimiting states).
 *
 * External concepts (status: 'external') are wrapped in parentheses per
 * ISO 704:2022 §5.5.4.3.1, using the upstream `isExternalMember` /
 * `isExternalComprehensive` detection from glossarist@0.4.52.
 *
 * Header badges communicate metadata that the diagram's line styles
 * also encode — for users who can't perceive the visual difference
 * (screen readers, low vision, monochrome displays).
 */
import type { PartitiveRelationWire, Manifest } from '../adapters/types';
import { useRouter } from 'vue-router';
import { useVocabularyStore } from '../stores/vocabulary';
import { getFactory } from '../adapters/factory';
import { useI18n, locale } from '../i18n';
import { completenessLabel } from '../utils/partitive-relation-styling';
import { presenceLabel, countLabel } from '../utils/partitive-multiplicity';
import { resolveDesignation } from '../utils/resolve-designation';
import { isExternalMember, isExternalComprehensive, formatExternalLabel } from '../utils/external-detection';
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

/** Per-URI cache of external-status lookups, so the rake doesn't re-resolve
 *  the same concept on every render pass. */
const externalCache = new Map<string, boolean>();

/**
 * Bridge the concept-browser ref shape to glossarist@0.4.52's ConceptStore
 * interface. The store exposes concepts via `lookup({ source, id })` and
 * returns an object with `.status` + `.related[]` — exactly what the
 * upstream external-detection utilities need.
 */
const externalStore = {
  lookup(ref: { source?: string | null; id?: string | null }) {
    if (!ref?.source && !ref?.id) return null;
    // Find the matching concept by traversing the loaded datasets.
    for (const adapter of store.datasets.values()) {
      for (const entry of adapter.getConcepts() ?? []) {
        if (entry && entry.id === ref.id) {
          return {
            status: entry.status,
            related: (entry as any).relatedConcepts ?? (entry as any).related ?? [],
          };
        }
      }
    }
    return null;
  },
};

function isExternalUri(uri: string, kind: 'member' | 'comprehensive'): boolean {
  if (externalCache.has(uri)) return externalCache.get(uri)!;
  // Build a member/hyperedge shape the upstream utilities expect.
  const ref = { source: uri, id: uri.split('/').pop() ?? uri };
  let isExt: boolean;
  if (kind === 'comprehensive') {
    isExt = isExternalComprehensive({ comprehensive: ref, members: [] }, externalStore);
  } else {
    isExt = isExternalMember({ ref }, externalStore);
  }
  externalCache.set(uri, isExt);
  return isExt;
}

function designationFor(uri: string, kind: 'member' | 'comprehensive' = 'member'): string {
  const label = resolveDesignation(uri, store, factory, locale.value);
  return formatExternalLabel(label, isExternalUri(uri, kind));
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

/**
 * Build a per-member view-model carrying the resolved designation plus
 * the multiplicity + is_delimiting fields the diagram needs.
 */
function labeledMembers(rel: PartitiveRelationWire): PartitiveMemberLabeled[] {
  return rel.partitives.map(m => ({
    uri: m.uri,
    label: designationFor(m.uri, 'member'),
    presence: m.presence,
    count: m.count,
    isDelimiting: m.isDelimiting,
  }));
}

/** Tooltip text for a member, shown on hover. */
function memberTooltip(m: { presence: 'required' | 'optional'; count: 'exactly_one' | 'at_least_one' | 'multiple'; isDelimiting: boolean }): string {
  const label = `${presenceLabel(m.presence)} · ${countLabel(m.count).toLowerCase()}`;
  return m.isDelimiting ? `Delimiting · ${label}` : label;
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
      <!-- Rake diagram (ISO 704:2022 partitive-relation convention) -->
      <div class="px-3 py-3 overflow-x-auto">
        <PartitiveRelationDiagram
          :comprehensive-label="designationFor(rel.comprehensive)"
          :partitives="labeledMembers(rel)"
          :completeness="rel.completeness"
          :criterion="null"
          :member-tooltip="memberTooltip"
          @navigate="navigate"
        />
      </div>
    </div>
  </div>
</template>
