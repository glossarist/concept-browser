<script setup lang="ts">
/**
 * GenericRelationList — renders one-to-many generic (genus/species)
 * decompositions as ISO 704 rake diagrams. Mirror of
 * PartitiveRelationList with type label swapped.
 *
 * External concepts are parenthesized per ISO 704 §5.5.4.3.1.
 */
import type { GenericRelationWire, Manifest } from '../adapters/types';
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
  relations: GenericRelationWire[];
  manifest: Manifest;
  registerId: string;
}>();

const router = useRouter();
const store = useVocabularyStore();
const factory = getFactory();
const { t } = useI18n();

const externalCache = new Map<string, boolean>();

const externalStore = {
  lookup(ref: { source?: string | null; id?: string | null }) {
    if (!ref?.source && !ref?.id) return null;
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

/** Resolve a LocalizedString delimitingCharacteristic to the current locale. */
function characteristicText(dc: Record<string, string>): string {
  return dc[locale.value] ?? dc.default ?? dc.eng ?? Object.values(dc)[0] ?? '';
}

function memberLabel(member: GenericRelationWire['members'][number]): PartitiveMemberLabeled {
  return {
    uri: member.uri,
    presence: member.presence,
    count: member.count,
    isDelimiting: false,
    label: designationFor(member.uri, 'member'),
  };
}
</script>

<template>
  <section class="generic-relations" aria-label="Generic relations">
    <div
      v-for="(rel, i) in relations"
      :key="`generic-${i}-${rel.comprehensive}`"
      class="generic-relation-card"
    >
      <header class="relation-header">
        <span class="badge badge-completeness" :class="`completeness-${rel.completeness}`">
          {{ completenessLabel(rel.completeness) }}
        </span>
        <span class="badge badge-type">{{ t('relations.generic') }}</span>
        <h4 class="comprehensive">{{ designationFor(rel.comprehensive, 'comprehensive') }}</h4>
      </header>

      <p v-if="rel.criterion" class="criterion">
        <em>{{ rel.criterion[locale] || rel.criterion.eng || Object.values(rel.criterion)[0] }}</em>
      </p>

      <PartitiveRelationDiagram
        :partitives="rel.members.map(memberLabel)"
        :comprehensive-label="designationFor(rel.comprehensive, 'comprehensive')"
        :completeness="rel.completeness"
      />

      <ul class="member-presence-list" aria-label="Member delimiting characteristics">
        <li v-for="(m, j) in rel.members" :key="j">
          <span class="member-label">{{ designationFor(m.uri, 'member') }}</span>
          <span
            v-if="m.delimitingCharacteristic"
            class="member-delimiting-characteristic"
          >{{ characteristicText(m.delimitingCharacteristic) }}</span>
          <span v-if="m.presence && m.presence !== 'required'" class="member-presence">{{ presenceLabel(m.presence) }}</span>
          <span v-if="m.count && m.count !== 'exactly_one'" class="member-count">{{ countLabel(m.count) }}</span>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.generic-relation-card {
  border: 1px solid var(--color-border, #ccc);
  border-radius: 6px;
  padding: 1rem;
  margin-bottom: 1rem;
  background: var(--color-surface, #fff);
}

.relation-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.badge {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.badge-completeness.completeness-complete {
  background: var(--color-success-soft, #d4edda);
  color: var(--color-success-fg, #155724);
}

.badge-completeness.completeness-partial {
  background: var(--color-warn-soft, #fff3cd);
  color: var(--color-warn-fg, #856404);
}

.badge-type {
  background: var(--color-accent-soft, #d1ecf1);
  color: var(--color-accent-fg, #0c5460);
}

.comprehensive {
  margin: 0;
  font-size: 1.1rem;
  flex: 1 1 auto;
}

.criterion {
  color: var(--color-text-muted, #6c757d);
  margin: 0.5rem 0;
  font-size: 0.95rem;
}

.member-presence-list {
  list-style: none;
  padding: 0;
  margin: 0.5rem 0 0;
  font-size: 0.85rem;
}

.member-presence-list li {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.15rem 0;
}

.member-presence-list .member-presence,
.member-presence-list .member-count,
.member-presence-list .member-delimiting {
  color: var(--color-text-muted, #6c757d);
  font-size: 0.75rem;
  border: 1px solid var(--color-border-light, #eee);
  padding: 0.05rem 0.4rem;
  border-radius: 3px;
}
</style>
