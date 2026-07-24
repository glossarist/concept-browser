<script setup lang="ts">
/**
 * PartitiveRelationDiagram — renders a single PartitiveRelation as an
 * ISO 704 rake/bracket diagram in SVG.
 *
 * Layout (looking top-down):
 *
 *            [comprehensive]
 *                   │
 *                   │   ← vertical stem
 *   ┌───────────────┴───────────────┐   ← horizontal spine
 *   │               │               │
 *   │               │               │   ← perpendicular drops
 * [part1]        [part2]        [part3]
 *
 * Line conventions per ISO 704:
 *   - default                              : single solid line
 *   - plurality.isShared && !isUncertain   : close-set DOUBLE solid lines
 *                                            on stem + spine (drops stay single)
 *   - plurality.isShared && isUncertain    : one solid + one DASHED line
 *   - completeness === 'partial'           : spine extends past the last
 *                                            tooth (continued backline —
 *                                            "more exist but aren't shown")
 *
 * The diagram is pure SVG — no JS layout engine. Coordinates are
 * computed from the partitive count.
 */
import { computed } from 'vue';
import type { TypeSharedPluralityWire } from '../adapters/types';

export interface PartitiveMemberLabeled {
  uri: string;
  label: string;
  certainty: 'confirmed' | 'possible';
}

const props = withDefaults(defineProps<{
  comprehensiveLabel: string;
  partitives: PartitiveMemberLabeled[];
  completeness: 'complete' | 'partial';
  plurality: TypeSharedPluralityWire | null;
  criterion?: string | null;
}>(), {
  criterion: null,
});

const emit = defineEmits<{
  (e: 'navigate', uri: string): void;
}>();

// Layout constants — chosen for readability at 100% zoom.
const NODE_W = 120;
const NODE_H = 32;
const STEM_LEN = 28;
const SPINE_TO_NODE = 32;
const GAP_X = 16;
const PADDING_X = 24;
const PADDING_Y = 16;
const DOUBLE_GAP = 3;       // gap between the two lines of a close-set double
const PARTIAL_TAIL = 32;    // how far the spine extends past the last tooth for partial
const DASH_PATTERN = '4 3';

type LineVariant = 'single' | 'double-solid' | 'solid-plus-dashed';

const lineVariant = computed<LineVariant>(() => {
  if (!props.plurality?.isShared) return 'single';
  return props.plurality.isUncertain ? 'solid-plus-dashed' : 'double-solid';
});

const layout = computed(() => {
  const n = props.partitives.length;
  const totalWidth = PADDING_X * 2 + n * NODE_W + (n - 1) * GAP_X;
  const totalHeight = PADDING_Y * 2 + NODE_H + STEM_LEN + SPINE_TO_NODE + NODE_H;

  const centerX = totalWidth / 2;
  const compY = PADDING_Y + NODE_H / 2;
  const spineY = compY + NODE_H / 2 + STEM_LEN;
  const partY = spineY + SPINE_TO_NODE;

  const partitiveSlots = props.partitives.map((member, i) => {
    const x = PADDING_X + NODE_W / 2 + i * (NODE_W + GAP_X);
    return { member, x };
  });

  const leftX = partitiveSlots[0]?.x ?? centerX;
  const lastX = partitiveSlots[n - 1]?.x ?? centerX;
  const spineEndX = props.completeness === 'partial'
    ? lastX + PARTIAL_TAIL
    : lastX;

  return {
    totalWidth,
    totalHeight,
    centerX,
    compY,
    spineY,
    partY,
    partitiveSlots,
    leftX,
    spineEndX,
  };
});

function strokeAttr(variant: LineVariant, opacity = 1) {
  if (variant === 'solid-plus-dashed') {
    return { stroke: 'currentColor', 'stroke-width': 1.4, 'stroke-dasharray': DASH_PATTERN, opacity };
  }
  return { stroke: 'currentColor', 'stroke-width': 1.4, opacity };
}

function emitNav(uri: string) {
  emit('navigate', uri);
}
</script>

<template>
  <svg
    :viewBox="`0 0 ${layout.totalWidth} ${layout.totalHeight}`"
    width="100%"
    :style="{ maxWidth: `${layout.totalWidth}px` }"
    preserveAspectRatio="xMidYMid meet"
    class="partitive-rake text-emerald-700 dark:text-emerald-300"
    role="img"
    aria-label="Partitive relation diagram"
  >
    <!-- Comprehensive label -->
    <g>
      <rect
        :x="layout.centerX - NODE_W / 2"
        :y="layout.compY - NODE_H / 2"
        :width="NODE_W"
        :height="NODE_H"
        rx="6"
        class="fill-emerald-50 dark:fill-emerald-900/30 stroke-current"
        stroke-width="1.2"
      />
      <text
        :x="layout.centerX"
        :y="layout.compY"
        text-anchor="middle"
        dominant-baseline="middle"
        class="text-[11px] fill-emerald-900 dark:fill-emerald-100"
      >{{ comprehensiveLabel }}</text>
    </g>

    <!-- Criterion italic under the comprehensive -->
    <text
      v-if="criterion"
      :x="layout.centerX"
      :y="layout.compY + NODE_H / 2 + 10"
      text-anchor="middle"
      class="text-[9px] italic fill-emerald-800 dark:fill-emerald-200/80"
    >{{ criterion }}</text>

    <!-- Stem (vertical from comprehensive to spine) -->
    <line
      v-if="lineVariant === 'single'"
      :x1="layout.centerX" :y1="layout.compY + NODE_H / 2"
      :x2="layout.centerX" :y2="layout.spineY"
      v-bind="strokeAttr('single')"
    />
    <template v-else>
      <line
        :x1="layout.centerX - DOUBLE_GAP / 2" :y1="layout.compY + NODE_H / 2"
        :x2="layout.centerX - DOUBLE_GAP / 2" :y2="layout.spineY"
        v-bind="strokeAttr('double-solid')"
      />
      <line
        :x1="layout.centerX + DOUBLE_GAP / 2" :y1="layout.compY + NODE_H / 2"
        :x2="layout.centerX + DOUBLE_GAP / 2" :y2="layout.spineY"
        v-bind="strokeAttr(lineVariant === 'solid-plus-dashed' ? 'solid-plus-dashed' : 'double-solid')"
      />
    </template>

    <!-- Spine (horizontal, from leftmost tooth to rightmost tooth or extended) -->
    <line
      v-if="lineVariant === 'single'"
      :x1="layout.leftX" :y1="layout.spineY"
      :x2="layout.spineEndX" :y2="layout.spineY"
      v-bind="strokeAttr('single')"
    />
    <template v-else>
      <line
        :x1="layout.leftX" :y1="layout.spineY - DOUBLE_GAP / 2"
        :x2="layout.spineEndX" :y2="layout.spineY - DOUBLE_GAP / 2"
        v-bind="strokeAttr('double-solid')"
      />
      <line
        :x1="layout.leftX" :y1="layout.spineY + DOUBLE_GAP / 2"
        :x2="layout.spineEndX" :y2="layout.spineY + DOUBLE_GAP / 2"
        v-bind="strokeAttr(lineVariant === 'solid-plus-dashed' ? 'solid-plus-dashed' : 'double-solid')"
      />
    </template>

    <!-- Drops + partitive nodes -->
    <g v-for="(slot, i) in layout.partitiveSlots" :key="i">
      <!-- drop from spine to node (always single line per ISO 704) -->
      <line
        :x1="slot.x" :y1="layout.spineY"
        :x2="slot.x" :y2="layout.partY - NODE_H / 2"
        v-bind="strokeAttr('single', slot.member.certainty === 'possible' ? 0.5 : 1)"
        :stroke-dasharray="slot.member.certainty === 'possible' ? DASH_PATTERN : undefined"
      />
      <!-- node -->
      <g class="cursor-pointer" @click="emitNav(slot.member.uri)">
        <rect
          :x="slot.x - NODE_W / 2"
          :y="layout.partY - NODE_H / 2"
          :width="NODE_W"
          :height="NODE_H"
          rx="6"
          :class="slot.member.certainty === 'possible'
            ? 'fill-emerald-50/60 dark:fill-emerald-900/20 stroke-current'
            : 'fill-emerald-50 dark:fill-emerald-900/30 stroke-current'"
          :stroke-dasharray="slot.member.certainty === 'possible' ? DASH_PATTERN : undefined"
          stroke-width="1.2"
        />
        <text
          :x="slot.x"
          :y="layout.partY"
          text-anchor="middle"
          dominant-baseline="middle"
          :class="slot.member.certainty === 'possible'
            ? 'text-[11px] fill-emerald-700/70 dark:fill-emerald-200/60 italic'
            : 'text-[11px] fill-emerald-900 dark:fill-emerald-100'"
        >{{ slot.member.label }}</text>
      </g>
    </g>
  </svg>
</template>
