<script setup lang="ts">
/**
 * NonVerbalList — renders the structural non-verbal entity refs
 * (`figures[]`, `tables[]`, `formulas[]` from the concept) as a compact
 * list of in-page anchor links.
 *
 * This is the "Figures / Tables / Formulas" section of a concept page.
 * Inline mentions in prose are handled separately by the content
 * renderer; this list surfaces entities the author declared as
 * structural members of the concept regardless of whether they are
 * also mentioned inline.
 *
 * Click handling is delegated to `useNonVerbalCrossRef` (a single
 * document-level handler), so the links here are plain `<a href="#…">`.
 */
import { computed } from 'vue';
import type { StructuralEntityRef } from '../../composables/use-concept-entities';
import type { NonVerbalKind } from '../../adapters/non-verbal/types';

const props = defineProps<{
  refs: StructuralEntityRef[];
}>();

const KIND_LABEL: Readonly<Record<NonVerbalKind, string>> = {
  figure: 'Figure',
  table: 'Table',
  formula: 'Formula',
};

const KIND_BADGE_CLASS: Readonly<Record<NonVerbalKind, string>> = {
  figure: 'bg-violet-50 text-violet-700',
  table: 'bg-sky-50 text-sky-700',
  formula: 'bg-amber-50 text-amber-700',
};

interface GroupedRefs {
  kind: NonVerbalKind;
  label: string;
  badgeClass: string;
  items: StructuralEntityRef[];
}

const grouped = computed<GroupedRefs[]>(() => {
  const map = new Map<NonVerbalKind, StructuralEntityRef[]>();
  for (const r of props.refs) {
    const bucket = map.get(r.kind) ?? [];
    bucket.push(r);
    map.set(r.kind, bucket);
  }
  const out: GroupedRefs[] = [];
  for (const [kind, items] of map) {
    out.push({
      kind,
      label: KIND_LABEL[kind],
      badgeClass: KIND_BADGE_CLASS[kind],
      items,
    });
  }
  return out;
});

function labelOf(r: StructuralEntityRef): string {
  return r.display ?? r.entityId;
}
</script>

<template>
  <div v-if="refs.length" class="space-y-3">
    <div class="section-label">Non-verbal entities</div>
    <div
      v-for="group in grouped"
      :key="group.kind"
      class="card p-3 space-y-1.5"
    >
      <div class="flex items-center gap-2">
        <span class="badge text-[10px]" :class="group.badgeClass">{{ group.label }}s</span>
        <span class="text-xs text-ink-400">{{ group.items.length }}</span>
      </div>
      <ol class="space-y-1">
        <li v-for="r in group.items" :key="r.anchor">
          <a
            :href="`#${r.anchor}`"
            class="nv-list__link"
          >
            <span class="nv-list__label">{{ labelOf(r) }}</span>
            <span v-if="r.display" class="nv-list__id">{{ r.entityId }}</span>
          </a>
        </li>
      </ol>
    </div>
  </div>
</template>

<style scoped>
.nv-list__link {
  display: flex;
  align-items: baseline;
  gap: 0.5rem;
  padding: 0.25rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.8125rem;
  color: var(--ink-700, #444);
  text-decoration: none;
  transition: background-color 120ms ease;
}
.nv-list__link:hover {
  background: var(--ink-50, #f5f5f5);
  color: var(--ink-900, #111);
}
.nv-list__label {
  font-weight: 500;
}
.nv-list__id {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.6875rem;
  color: var(--ink-400, #888);
}
</style>
