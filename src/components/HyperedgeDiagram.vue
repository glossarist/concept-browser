<script setup lang="ts">
/**
 * HyperedgeDiagram — small inline SVG that calls the actual sphere
 * renderers (drawRakeBundles / drawGenericPipes) on hand-picked
 * sample data. Used on the Relation Types teaching page.
 *
 * The diagrams stay in sync with the real sphere rendering by
 * construction — no static SVG to drift out of date.
 */
import { onMounted, ref } from 'vue';
import { drawRakeBundles } from './relation-sphere/rake-bundles';
import { drawGenericPipes } from './relation-sphere/pipe-bundles';
import type {
  PartitiveRelationWire,
  PartitiveMemberWire,
  GenericRelationWire,
} from '../adapters/types';
import { useUiStore } from '../stores/ui';

const props = defineProps<{
  kind: 'partitive' | 'generic';
}>();

const svgRef = ref<SVGSVGElement | null>(null);
const uiStore = useUiStore();

/* Synthetic positions: comp at top-center, members fanned across the
   bottom. Mirrors the layout the sphere produces for a 3-member
   hyperedge with the focus at the center. */
const POS = new Map<string, { x: number; y: number }>([
  ['vim-2012/1.3', { x: 120, y: 24 }],
  ['vim-2012/1.4', { x: 36, y: 132 }],
  ['vim-2012/1.5', { x: 120, y: 144 }],
  ['vim-2012/1.22', { x: 204, y: 132 }],
]);

const PARTITIVE: PartitiveRelationWire = {
  source: 'https://example.org/vim-2012/concept/1.3',
  comprehensive: 'https://example.org/vim-2012/concept/1.3',
  completeness: 'partial',
  register: 'vim-2012',
  partitives: [
    /* required + multiple → solid double-line */
    { uri: 'https://example.org/vim-2012/concept/1.4', presence: 'required', count: 'multiple', isDelimiting: false },
    /* required + exactly_one + delimiting → 3× width single solid */
    { uri: 'https://example.org/vim-2012/concept/1.5', presence: 'required', count: 'exactly_one', isDelimiting: true },
    /* optional + at_least_one → dashed double-line */
    { uri: 'https://example.org/vim-2012/concept/1.22', presence: 'optional', count: 'at_least_one', isDelimiting: false },
  ] satisfies PartitiveMemberWire[],
};

const GENERIC: GenericRelationWire = {
  source: 'https://example.org/vim-2012/concept/1.9',
  comprehensive: 'https://example.org/vim-2012/concept/1.9',
  completeness: 'partial',
  register: 'vim-2012',
  criterion: { eng: 'by magnitude relationship', fra: 'selon la relation de grandeur' },
  members: [
    { uri: 'https://example.org/vim-2012/concept/1.17', presence: 'required', count: 'at_least_one',
      delimitingCharacteristic: { eng: 'multiple of a unit', fra: "multiple d'une unité" } },
    { uri: 'https://example.org/vim-2012/concept/1.18', presence: 'required', count: 'at_least_one',
      delimitingCharacteristic: { eng: 'submultiple of a unit', fra: "sous-multiple d'une unité" } },
    { uri: 'https://example.org/vim-2012/concept/1.12', presence: 'required', count: 'at_least_one',
      delimitingCharacteristic: { eng: 'coherent derived unit', fra: 'unité dérivée cohérente' } },
  ],
};

/* Override positions for the generic sample (comp is 1.9, members are 1.17/1.18/1.12). */
const GENERIC_POS = new Map<string, { x: number; y: number }>([
  ['vim-2012/1.9', { x: 120, y: 24 }],
  ['vim-2012/1.17', { x: 36, y: 132 }],
  ['vim-2012/1.18', { x: 120, y: 144 }],
  ['vim-2012/1.12', { x: 204, y: 132 }],
]);

onMounted(() => {
  const svg = svgRef.value;
  if (!svg) return;
  if (props.kind === 'partitive') {
    drawRakeBundles(svg, POS, {
      isDark: uiStore.isDark,
      color: uiStore.isDark ? '#2dd4bf' : '#0d9488',
      isMuted: false,
      relations: [PARTITIVE],
    });
  } else {
    drawGenericPipes(svg, GENERIC_POS, {
      isDark: uiStore.isDark,
      color: uiStore.isDark ? '#fbbf24' : '#b45309',
      isMuted: false,
      relations: [GENERIC],
      locale: 'eng',
    });
  }
});
</script>

<template>
  <svg
    ref="svgRef"
    class="hyperedge-diagram"
    viewBox="0 0 240 168"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  />
</template>

<style scoped>
.hyperedge-diagram {
  width: 100%;
  max-width: 240px;
  height: auto;
  display: block;
}
</style>
