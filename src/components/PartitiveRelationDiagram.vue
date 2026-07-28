<script setup lang="ts">
/**
 * PartitiveRelationDiagram — renders a single PartitiveRelation as an
 * ISO 704:2022 rake/bracket diagram in SVG.
 *
 * Layout:
 *
 *            [comprehensive]
 *                   │
 *                   │   ← stem (always single solid — relation frame)
 *   ┌───────────────┴───────────────┐   ← spine (always single solid — relation frame)
 *   │               │               │
 *   │               │               │   ← drops (per-member multiplicity + delimiting)
 * [part1]        [part2]        [part3]
 *
 * Per ISO 704:2022, each drop's line style encodes its multiplicity +
 * is_delimiting (see utils/partitive-multiplicity.ts for the registry):
 *
 *   multiplicity         is_delimiting  visual
 *   -------------------  --------------  --------------------------------
 *   compulsory           false           1 solid  @ 1.5px
 *   compulsory           true            1 solid  @ 4.5px (bold, 3× width)
 *   optional             false           1 dashed @ 1.5px
 *   optional             true            1 dashed @ 4.5px
 *   compulsory_multiple  false           2 solid  @ 1.5px
 *   compulsory_multiple  true            2 solid  @ 4.5px
 *   optional_multiple    false           2 dashed @ 1.5px
 *   optional_multiple    true            2 dashed @ 4.5px
 *   compulsory_at_least_one         false           1 solid + 1 dashed @ 1.5px
 *   compulsory_at_least_one         true            1 solid + 1 dashed @ 4.5px
 *
 * completeness === 'partial'  : spine extends past the last tooth
 *                               (continued backline — "more exist but
 *                               not shown")
 *
 * Node sizing is designation-aware: the longest label drives the node
 * width (clamped to [MIN_NODE_W, MAX_NODE_W]); labels that don't fit
 * wrap to a second line via tspan.
 */
import { computed } from 'vue';
import {
  rakeStrokeStyle,
  type PartitivePresence,
  type PartitiveCount,
  type RakeStrokeStyle,
} from '../utils/partitive-multiplicity';

export interface PartitiveMemberLabeled {
  uri: string;
  label: string;
  presence: PartitivePresence;
  count: PartitiveCount;
  isDelimiting: boolean;
}

const props = withDefaults(defineProps<{
  comprehensiveLabel: string;
  partitives: PartitiveMemberLabeled[];
  completeness: 'complete' | 'partial';
  criterion?: string | null;
  /** Optional per-member tooltip string. */
  memberTooltip?: (m: { presence: PartitivePresence; count: PartitiveCount; isDelimiting: boolean }) => string;
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
const DOUBLE_GAP = 3;             // gap between the two lines of a close-set double
const PARTIAL_TAIL = 32;
const DASH_PATTERN = '4 3';
const CHAR_W = 6.2;               // approx for 11px sans-serif
const NODE_TEXT_PAD = 16;
const FRAME_STROKE_WIDTH = 1.4;   // stem + spine use this width always

/** Estimated pixel width of a string at 11px sans-serif. */
function estimateTextWidth(text: string): number {
  return text.length * CHAR_W;
}

/** Wrap a label to at most 2 lines, breaking on word boundaries. */
function wrapLabel(text: string, maxCharsPerLine: number): string[] {
  if (text.length <= maxCharsPerLine) return [text];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const w of words) {
    if (w.length > maxCharsPerLine) {
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
    return {
      member,
      x,
      labelLines,
      style: rakeStrokeStyle(member.presence, member.count, member.isDelimiting),
    };
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

/**
 * Build SVG stroke attributes for the relation frame (stem + spine).
 *
 * The frame is structural — always a single solid line at standard
 * width. Per-member multiplicity + delimiting are encoded on the drops
 * only (MECE: frame vs drops).
 */
const frameStrokeAttrs = computed(() => ({
  stroke: 'currentColor',
  'stroke-width': FRAME_STROKE_WIDTH,
}));

/**
 * Build SVG stroke attributes for one of a drop's parallel lines.
 * The drop may have 1 or 2 parallel lines per its multiplicity.
 */
function dropStrokeAttrs(style: RakeStrokeStyle, dashed: boolean, opacity = 1) {
  return {
    stroke: 'currentColor',
    'stroke-width': style.strokeWidth,
    opacity,
    ...(dashed ? { 'stroke-dasharray': DASH_PATTERN } : {}),
  };
}

function emitNav(uri: string) {
  emit('navigate', uri);
}

function tooltipFor(member: PartitiveMemberLabeled): string | undefined {
  return props.memberTooltip?.({ presence: member.presence, count: member.count, isDelimiting: member.isDelimiting });
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

    <!-- Stem: comprehensive → spine (single solid frame) -->
    <line
      :x1="layout.centerX" :y1="layout.compY + layout.nodeH / 2"
      :x2="layout.centerX" :y2="layout.spineY"
      v-bind="frameStrokeAttrs"
    />

    <!-- Spine: leftmost tooth → rightmost tooth (single solid frame;
         extended for completeness: 'partial') -->
    <line
      :x1="layout.leftX" :y1="layout.spineY"
      :x2="layout.spineEndX" :y2="layout.spineY"
      v-bind="frameStrokeAttrs"
    />

    <!-- Drops + partitive nodes -->
    <g v-for="(slot, i) in layout.partitiveSlots" :key="i">
      <!-- Primary drop line -->
      <line
        :x1="slot.x" :y1="layout.spineY"
        :x2="slot.x" :y2="layout.partY - layout.nodeH / 2"
        v-bind="dropStrokeAttrs(slot.style, slot.style.primaryDashed)"
      />
      <!-- Secondary drop line (only for lineCount === 2; e.g. *_multiple, compulsory_at_least_one) -->
      <line
        v-if="slot.style.lineCount === 2"
        :x1="slot.x + DOUBLE_GAP" :y1="layout.spineY"
        :x2="slot.x + DOUBLE_GAP" :y2="layout.partY - layout.nodeH / 2"
        v-bind="dropStrokeAttrs(slot.style, slot.style.secondaryDashed)"
      />
      <g class="cursor-pointer" :title="tooltipFor(slot.member)" @click="emitNav(slot.member.uri)">
        <rect
          :x="slot.x - layout.nodeW / 2"
          :y="layout.partY - layout.nodeH / 2"
          :width="layout.nodeW"
          :height="layout.nodeH"
          rx="6"
          :class="slot.style.strokeWidth > 2
            ? 'fill-emerald-100 dark:fill-emerald-900/50 stroke-current'
            : 'fill-emerald-50 dark:fill-emerald-900/30 stroke-current'"
          :stroke-width="slot.style.strokeWidth > 2 ? 2.4 : 1.2"
        />
        <text
          :x="slot.x"
          text-anchor="middle"
          :class="slot.style.strokeWidth > 2
            ? 'text-[11px] fill-emerald-900 dark:fill-emerald-50 font-medium'
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
