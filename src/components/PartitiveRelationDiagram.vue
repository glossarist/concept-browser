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
 *                                            tooth (continued backline)
 *
 * Node sizing is designation-aware: the longest label drives the node
 * width (clamped to [MIN_NODE_W, MAX_NODE_W]); labels that don't fit
 * wrap to a second line via tspan. This lets the rake show actual
 * designations ('system of quantities') instead of bare IDs ('1.3').
 */
import { computed } from 'vue';

export interface PartitiveMemberLabeled {
  uri: string;
  label: string;
  certainty: 'confirmed' | 'possible';
}

const props = withDefaults(defineProps<{
  comprehensiveLabel: string;
  partitives: PartitiveMemberLabeled[];
  completeness: 'complete' | 'partial';
  criterion?: string | null;
}>(), {
  criterion: null,
});

const emit = defineEmits<{
  (e: 'navigate', uri: string): void;
}>();

// Layout constants
const MIN_NODE_W = 110;
const MAX_NODE_W = 220;
const SINGLE_LINE_H = 32;
const DOUBLE_LINE_H = 50;
const STEM_LEN = 28;
const SPINE_TO_NODE = 32;
const GAP_X = 16;
const PADDING_X = 20;
const PADDING_Y = 14;
const DOUBLE_GAP = 3;
const PARTIAL_TAIL = 32;
const DASH_PATTERN = '4 3';
const CHAR_W = 6.2;            // approx for 11px sans-serif
const NODE_TEXT_PAD = 16;      // horizontal padding inside node rect

type LineVariant = 'single' | 'double-solid' | 'solid-plus-dashed';

const lineVariant = computed<LineVariant>(() => {
  if (!props.plurality?.isShared) return 'single';
  return props.plurality.isUncertain ? 'solid-plus-dashed' : 'double-solid';
});

/** Estimated pixel width of a string at 11px sans-serif. */
function estimateTextWidth(text: string): number {
  return text.length * CHAR_W;
}

/**
 * Wrap a label to at most 2 lines, breaking on word boundaries.
 * If a single word exceeds the limit, it stays on its own line and
 * gets truncated with an ellipsis.
 */
function wrapLabel(text: string, maxCharsPerLine: number): string[] {
  if (text.length <= maxCharsPerLine) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (w.length > maxCharsPerLine) {
      // word itself too long — flush current, push truncated word
      if (current) { lines.push(current); current = ''; }
      lines.push(w.slice(0, Math.max(1, maxCharsPerLine - 1)) + '…');
      continue;
    }
    if (!current) {
      current = w;
    } else if ((current + ' ' + w).length <= maxCharsPerLine) {
      current += ' ' + w;
    } else {
      lines.push(current);
      current = w;
    }
  }
  if (current) lines.push(current);
  if (lines.length > 2) {
    return [lines[0], lines.slice(1).join(' ').slice(0, maxCharsPerLine - 1) + '…'];
  }
  return lines;
}

const layout = computed(() => {
  const allLabels = [props.comprehensiveLabel, ...props.partitives.map(p => p.label)];
  const longestWidth = Math.max(...allLabels.map(estimateTextWidth));
  const nodeW = Math.min(MAX_NODE_W, Math.max(MIN_NODE_W, Math.ceil(longestWidth) + NODE_TEXT_PAD));
  const charsPerLine = Math.max(10, Math.floor((nodeW - NODE_TEXT_PAD) / CHAR_W));

  const wrapped = allLabels.map(label => wrapLabel(label, charsPerLine));
  const anyWrapped = wrapped.some(lines => lines.length > 1);
  const nodeH = anyWrapped ? DOUBLE_LINE_H : SINGLE_LINE_H;

  const n = props.partitives.length;
  const totalWidth = PADDING_X * 2 + n * nodeW + (n - 1) * GAP_X;
  const totalHeight = PADDING_Y * 2 + nodeH + STEM_LEN + SPINE_TO_NODE + nodeH;

  const centerX = totalWidth / 2;
  const compY = PADDING_Y + nodeH / 2;
  const spineY = compY + nodeH / 2 + STEM_LEN;
  const partY = spineY + SPINE_TO_NODE;

  const partitiveSlots = props.partitives.map((member, i) => {
    const x = PADDING_X + nodeW / 2 + i * (nodeW + GAP_X);
    const labelLines = wrapped[i + 1]; // index 0 is comprehensive
    return { member, x, labelLines };
  });

  const leftX = partitiveSlots[0]?.x ?? centerX;
  const lastX = partitiveSlots[n - 1]?.x ?? centerX;
  const spineEndX = props.completeness === 'partial'
    ? lastX + PARTIAL_TAIL
    : lastX;

  return {
    nodeW,
    nodeH,
    totalWidth,
    totalHeight,
    centerX,
    compY,
    spineY,
    partY,
    partitiveSlots,
    comprehensiveLines: wrapped[0],
    leftX,
    spineEndX,
  };
});

function strokeAttr(variant: LineVariant, opacity = 1, override?: 'dash') {
  const useDash = override === 'dash' || variant === 'solid-plus-dashed';
  return {
    stroke: 'currentColor',
    'stroke-width': 1.4,
    opacity,
    ...(useDash ? { 'stroke-dasharray': DASH_PATTERN } : {}),
  };
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
        :x="layout.centerX - layout.nodeW / 2"
        :y="layout.compY - layout.nodeH / 2"
        :width="layout.nodeW"
        :height="layout.nodeH"
        rx="6"
        class="fill-emerald-50 dark:fill-emerald-900/30 stroke-current"
        stroke-width="1.2"
      />
      <text :x="layout.centerX" text-anchor="middle" class="text-[11px] fill-emerald-900 dark:fill-emerald-100">
        <tspan
          v-for="(line, i) in layout.comprehensiveLines"
          :key="i"
          :x="layout.centerX"
          :y="layout.compY - (layout.comprehensiveLines.length - 1) * 7 + i * 14"
        >{{ line }}</tspan>
      </text>
    </g>

    <!-- Criterion italic under the comprehensive -->
    <text
      v-if="criterion"
      :x="layout.centerX"
      :y="layout.compY + layout.nodeH / 2 + 10"
      text-anchor="middle"
      class="text-[9px] italic fill-emerald-800 dark:fill-emerald-200/80"
    >{{ criterion }}</text>

    <!-- Stem (vertical from comprehensive to spine) -->
    <line
      v-if="lineVariant === 'single'"
      :x1="layout.centerX" :y1="layout.compY + layout.nodeH / 2"
      :x2="layout.centerX" :y2="layout.spineY"
      v-bind="strokeAttr('single')"
    />
    <template v-else>
      <line
        :x1="layout.centerX - DOUBLE_GAP / 2" :y1="layout.compY + layout.nodeH / 2"
        :x2="layout.centerX - DOUBLE_GAP / 2" :y2="layout.spineY"
        v-bind="strokeAttr('double-solid')"
      />
      <line
        :x1="layout.centerX + DOUBLE_GAP / 2" :y1="layout.compY + layout.nodeH / 2"
        :x2="layout.centerX + DOUBLE_GAP / 2" :y2="layout.spineY"
        v-bind="strokeAttr(lineVariant, 1, lineVariant === 'solid-plus-dashed' ? 'dash' : undefined)"
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
        v-bind="strokeAttr(lineVariant, 1, lineVariant === 'solid-plus-dashed' ? 'dash' : undefined)"
      />
    </template>

    <!-- Drops + partitive nodes -->
    <g v-for="(slot, i) in layout.partitiveSlots" :key="i">
      <line
        :x1="slot.x" :y1="layout.spineY"
        :x2="slot.x" :y2="layout.partY - layout.nodeH / 2"
        v-bind="strokeAttr('single', slot.member.certainty === 'possible' ? 0.5 : 1, slot.member.certainty === 'possible' ? 'dash' : undefined)"
      />
      <g class="cursor-pointer" @click="emitNav(slot.member.uri)">
        <rect
          :x="slot.x - layout.nodeW / 2"
          :y="layout.partY - layout.nodeH / 2"
          :width="layout.nodeW"
          :height="layout.nodeH"
          rx="6"
          :class="slot.member.certainty === 'possible'
            ? 'fill-emerald-50/60 dark:fill-emerald-900/20 stroke-current'
            : 'fill-emerald-50 dark:fill-emerald-900/30 stroke-current'"
          :stroke-dasharray="slot.member.certainty === 'possible' ? DASH_PATTERN : undefined"
          stroke-width="1.2"
        />
        <text
          :x="slot.x"
          text-anchor="middle"
          :class="slot.member.certainty === 'possible'
            ? 'text-[11px] fill-emerald-700/70 dark:fill-emerald-200/60 italic'
            : 'text-[11px] fill-emerald-900 dark:fill-emerald-100'"
        >
          <tspan
            v-for="(line, j) in slot.labelLines"
            :key="j"
            :x="slot.x"
            :y="layout.partY - (slot.labelLines.length - 1) * 7 + j * 14"
          >{{ line }}</tspan>
        </text>
      </g>
    </g>
  </svg>
</template>
