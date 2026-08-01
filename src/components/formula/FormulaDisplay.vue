<script setup lang="ts">
/**
 * FormulaDisplay — renders a dataset-level Formula entity.
 *
 * Caption + expression + description + sources. The expression renders
 * via Plurimath (LaTeX/MathML/AsciiMath). Self-anchoring — the outer
 * `<figure>` receives the anchor ID for `{{formula:id}}` mentions.
 */
import { computed } from 'vue';
import type { Formula } from 'glossarist';
import type { FormulaNotation } from '../../adapters/non-verbal/types';
import { useNonVerbalEntity } from '../../composables/use-non-verbal-entity';
import { resolveFallbackChain } from '../../utils/locale';
import { anchorId } from '../../utils/non-verbal-anchor';
import NonVerbalCaption from '../non-verbal/NonVerbalCaption.vue';
import NonVerbalSources from '../non-verbal/NonVerbalSources.vue';
import NonVerbalFallback from '../non-verbal/NonVerbalFallback.vue';
import FormulaExpression from './FormulaExpression.vue';

const props = defineProps<{
  datasetId: string;
  entityId: string;
  locale: string;
  datasetLocales?: readonly string[];
}>();

const k = () => 'formula' as const;
const { entity, state, error } = useNonVerbalEntity(k, () => props.datasetId, () => props.entityId);

const fallbackChain = computed(() => resolveFallbackChain(props.datasetLocales));
const form = computed(() => entity.value as Formula | null);
const anchor = computed(() => anchorId('formula', props.datasetId, props.entityId));
const descriptionId = computed(() => `${anchor.value}-desc`);
</script>

<template>
  <figure
    v-if="form && state === 'loaded'"
    :id="anchor"
    class="formula-entity"
  >
    <div class="formula__expr-line">
      <FormulaExpression
        :expression="(form.expression as any)"
        :notation="(form.notation as FormulaNotation | null)"
        :locale="locale"
        :fallback-chain="fallbackChain"
      />
    </div>

    <NonVerbalCaption
      :identifier="form.identifier"
      :caption="(form.caption as any)"
      :description="(form.description as any)"
      :locale="locale"
      :fallback-chain="fallbackChain"
      :description-id="descriptionId"
    />

    <NonVerbalSources
      v-if="form.sources?.length"
      :sources="[...(form.sources || [])]"
    />
  </figure>

  <NonVerbalFallback
    v-else-if="state === 'loading' || state === 'not-found' || state === 'error'"
    :state="state"
    kind="formula"
    :entity-id="entityId"
    :message="error ?? undefined"
  />
</template>

<style scoped>
.formula-entity {
  margin: 1rem 0;
  padding: 0.75rem 1rem;
  border-left: 3px solid var(--ink-200, #e5e5e5);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}
.formula__expr-line {
  font-size: 1.125rem;
  padding: 0.25rem 0;
}
.formula-entity:focus-visible {
  outline: 2px solid var(--blue-500, #3b82f6);
  outline-offset: 4px;
}
</style>
