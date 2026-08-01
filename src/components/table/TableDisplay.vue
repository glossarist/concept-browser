<script setup lang="ts">
/**
 * TableDisplay — renders a dataset-level Table entity.
 *
 * Delegates content rendering to TableStructured (headers + rows) or
 * TableMarkup (HTML / Markdown / AsciiDoc) based on `content.kind`.
 */
import { computed } from 'vue';
import type { Table } from 'glossarist';
import type { TableContent, TableFormat } from '../../adapters/non-verbal/types';
import { useNonVerbalEntity } from '../../composables/use-non-verbal-entity';
import { resolveFallbackChain } from '../../utils/locale';
import { anchorId } from '../../utils/non-verbal-anchor';
import NonVerbalCaption from '../non-verbal/NonVerbalCaption.vue';
import NonVerbalSources from '../non-verbal/NonVerbalSources.vue';
import NonVerbalFallback from '../non-verbal/NonVerbalFallback.vue';
import TableStructured from './TableStructured.vue';
import TableMarkup from './TableMarkup.vue';

const props = defineProps<{
  datasetId: string;
  entityId: string;
  locale: string;
  datasetLocales?: readonly string[];
}>();

const k = () => 'table' as const;
const { entity, state, error } = useNonVerbalEntity(k, () => props.datasetId, () => props.entityId);

const fallbackChain = computed(() => resolveFallbackChain(props.datasetLocales));
const anchor = computed(() => anchorId('table', props.datasetId, props.entityId));
const descriptionId = computed(() => `${anchor.value}-desc`);

const table = computed<Table | null>(() => entity.value as Table | null);
const content = computed<TableContent | null>(() => (table.value?.content ?? null) as TableContent | null);
const structuredContent = computed(() => {
  const c = content.value;
  return c && c.kind === 'structured' ? c : null;
});
const markup = computed(() => {
  const c = content.value;
  return c && c.kind === 'markup' ? c.markup : null;
});
</script>

<template>
  <figure
    v-if="table && state === 'loaded'"
    :id="anchor"
    class="table-entity"
  >
    <TableStructured
      v-if="structuredContent"
      :content="structuredContent"
      :locale="locale"
      :fallback-chain="fallbackChain"
    />
    <TableMarkup
      v-else-if="markup"
      :content="markup"
      :format="(table.format as TableFormat | null)"
      :locale="locale"
      :fallback-chain="fallbackChain"
    />

    <NonVerbalCaption
      :identifier="table.identifier"
      :caption="(table.caption as any)"
      :description="(table.description as any)"
      :locale="locale"
      :fallback-chain="fallbackChain"
      :description-id="descriptionId"
    />

    <NonVerbalSources
      v-if="table.sources?.length"
      :sources="[...(table.sources || [])]"
    />
  </figure>

  <NonVerbalFallback
    v-else-if="state === 'loading' || state === 'not-found' || state === 'error'"
    :state="state"
    kind="table"
    :entity-id="entityId"
    :message="error ?? undefined"
  />
</template>

<style scoped>
.table-entity {
  margin: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.table-entity:focus-visible {
  outline: 2px solid var(--blue-500, #3b82f6);
  outline-offset: 4px;
}
</style>
