<script setup lang="ts">
/**
 * FigureDisplay — main component for rendering a dataset-level Figure.
 *
 * Fetches the entity via the resolver, renders the image(s), caption,
 * description, and sources. Composite figures (with subfigures) render
 * recursively — each subfigure is itself a FigureDisplay.
 *
 * Self-anchoring: the outer `<figure>` element receives the anchor ID
 * so `{{fig:id}}` mentions can scroll to it via the cross-ref composable.
 */
import { computed, ref } from 'vue';
import type { Figure } from '../../adapters/non-verbal/types';
import { useNonVerbalEntity } from '../../composables/use-non-verbal-entity';
import { resolveFallbackChain } from '../../utils/locale';
import { anchorId } from '../../utils/non-verbal-anchor';
import { deriveLayout } from './figure-layout';
import NonVerbalCaption from '../non-verbal/NonVerbalCaption.vue';
import NonVerbalSources from '../non-verbal/NonVerbalSources.vue';
import NonVerbalFallback from '../non-verbal/NonVerbalFallback.vue';
import FigureImages from './FigureImages.vue';

const props = defineProps<{
  datasetId: string;
  entityId: string;
  locale: string;
  /** Languages configured on the dataset — drives fallback chain. */
  datasetLocales?: readonly string[];
}>();

const k = () => 'figure' as const;
const ds = () => props.datasetId;
const id = () => props.entityId;
const { entity, state, error } = useNonVerbalEntity(k, ds, id);

const fallbackChain = computed(() => resolveFallbackChain(props.datasetLocales));
const layout = computed(() => entity.value ? deriveLayout(entity.value as Figure) : 'single');
const anchor = computed(() => anchorId('figure', props.datasetId, props.entityId));
const descriptionId = computed(() => `${anchor.value}-desc`);

const topLevelImages = computed(() => (entity.value as Figure | null)?.images ?? []);
</script>

<template>
  <figure
    v-if="entity && state === 'loaded'"
    :id="anchor"
    :class="`figure figure--${layout}`"
  >
    <div v-if="topLevelImages.length" :class="`figure__media figure__media--${layout}`">
      <FigureImages
        :images="topLevelImages"
        :alt="(entity as Figure).alt"
        :dataset-id="datasetId"
        :locale="locale"
        :fallback-chain="fallbackChain"
        :hasDescription="!!(entity as Figure).description && Object.keys((entity as Figure).description ?? {}).length > 0"
        :description-id="descriptionId"
        entity-label="Figure"
      />
    </div>

    <template v-if="(entity as Figure).subfigures?.length">
      <div :class="`figure__subfigures figure__subfigures--${layout}`">
        <FigureDisplay
          v-for="sub in (entity as Figure).subfigures"
          :key="sub.id"
          :dataset-id="datasetId"
          :entity-id="sub.id"
          :locale="locale"
          :dataset-locales="datasetLocales"
        />
      </div>
    </template>

    <NonVerbalCaption
      :identifier="(entity as Figure).identifier"
      :caption="(entity as Figure).caption"
      :description="(entity as Figure).description"
      :locale="locale"
      :fallback-chain="fallbackChain"
      :description-id="descriptionId"
    />

    <NonVerbalSources
      v-if="(entity as Figure).sources?.length"
      :sources="(entity as Figure).sources!"
    />
  </figure>

  <NonVerbalFallback
    v-else-if="state === 'loading' || state === 'not-found' || state === 'error'"
    :state="state"
    kind="figure"
    :entity-id="entityId"
    :message="error ?? undefined"
  />
</template>

<style scoped>
.figure {
  margin: 1rem 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.figure__media--row,
.figure__media--grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}
.figure__media--column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}
.figure__subfigures--row { flex-direction: row; flex-wrap: wrap; gap: 0.75rem; }
.figure__subfigures--column { flex-direction: column; gap: 0.75rem; }
.figure__subfigures--grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 0.75rem;
}

[dir='rtl'] .figure__subfigures--row { flex-direction: row-reverse; }

.figure:focus-visible {
  outline: 2px solid var(--blue-500, #3b82f6);
  outline-offset: 4px;
}
</style>
