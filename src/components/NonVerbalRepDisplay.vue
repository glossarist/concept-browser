<script setup lang="ts">
import { computed } from 'vue';
import type { NonVerbRep, Citation } from 'glossarist';
import type { FigureImage, LocalizedString, NonVerbRepV3, NonVerbalSource } from '../adapters/non-verbal/types';
import { resolveFallbackChain } from '../utils/locale';
import FigureImages from './figure/FigureImages.vue';
import NonVerbalCaption from './non-verbal/NonVerbalCaption.vue';
import CitationDisplay from './CitationDisplay.vue';

const props = defineProps<{
  reps: NonVerbRep[];
  locale: string;
  registerId: string;
  datasetLocales?: readonly string[];
}>();

const fallbackChain = computed(() => resolveFallbackChain(props.datasetLocales));

// Cast once at the boundary: glossarist-js's published `.d.ts` still
// describes pre-V3 NonVerbRep, but the runtime exposes the V3 shape
// (images/alt/caption/description/sources). See TODO.figures/19.
const v3Reps = computed<NonVerbRepV3[]>(() => props.reps as unknown as NonVerbRepV3[]);

function imagesOf(rep: NonVerbRepV3): FigureImage[] {
  return rep.images ?? [];
}

function hasImages(rep: NonVerbRepV3): boolean {
  return imagesOf(rep).length > 0;
}

function asCitation(origin: NonVerbalSource['origin']): Citation | null {
  return (origin as unknown as Citation) ?? null;
}
</script>

<template>
  <div v-if="v3Reps.length" class="space-y-3">
    <div class="section-label">Non-verbal representations</div>
    <figure v-for="(rep, i) in v3Reps" :key="i" class="card p-4 space-y-2">
      <span class="badge text-[10px] bg-violet-50 text-violet-700">{{ rep.type ?? 'representation' }}</span>

      <FigureImages
        v-if="hasImages(rep)"
        :images="imagesOf(rep)"
        :alt="(rep.alt as LocalizedString | undefined) ?? undefined"
        :dataset-id="registerId"
        :locale="locale"
        :fallback-chain="fallbackChain"
        :has-description="!!rep.description && Object.keys(rep.description).length > 0"
        :entity-label="rep.type ?? 'representation'"
      />

      <NonVerbalCaption
        :caption="(rep.caption as LocalizedString | undefined) ?? undefined"
        :description="(rep.description as LocalizedString | undefined) ?? undefined"
        :locale="locale"
        :fallback-chain="fallbackChain"
      />

      <div v-if="rep.sources?.length" class="nv-rep__sources">
        <div class="nv-rep__sources-label">Sources</div>
        <ol class="nv-rep__sources-list">
          <li v-for="(src, si) in rep.sources" :key="si" class="nv-rep__source">
            <CitationDisplay v-if="asCitation(src.origin)" :citation="asCitation(src.origin)!" :register-id="registerId" />
            <span v-if="src.modification" class="nv-rep__source-modification">— {{ src.modification }}</span>
          </li>
        </ol>
      </div>
    </figure>
  </div>
</template>

<style scoped>
.nv-rep__sources {
  font-size: 0.75rem;
  color: var(--ink-500, #666);
  margin-top: 0.5rem;
}
.nv-rep__sources-label {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.25rem;
}
.nv-rep__sources-list {
  list-style: decimal inside;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.nv-rep__source-modification {
  color: var(--ink-400, #888);
  font-style: italic;
}
</style>
