<script setup lang="ts">
/**
 * RelationGraph — per-concept neighborhood graph on the concept page
 * (issue #259).
 *
 * 2D d3-force rendering of the concept's typed relations from the
 * build-time relation-graph.json — no server calls, one static fetch.
 * Local mode = direct relations (1 hop); global mode = N-hop BFS.
 * Node click emits `navigate` (the host decides routing). SVG and PNG
 * exports rasterize the rendered SVG client-side.
 *
 * Lazy-loaded by ConceptView (defineAsyncComponent) so the concept
 * page's default detail view never pays the d3 chunk.
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  select,
  zoom,
  zoomIdentity,
  drag,
  type Simulation,
  type D3DragEvent,
  type Selection,
} from 'd3';
import { useRelationGraph } from '../composables/use-relation-graph';
import { useUiStore } from '../stores/ui';
import { useDsStyle } from '../utils/dataset-style';
import { colorForTypeInMode, relationLabel } from '../utils/relation-sphere-styling';
import {
  neighborhood,
  edgeTypeCounts,
  serializeSvg,
  rasterizePng,
  downloadBlob,
  exportFilename,
  splitNodeId,
  type RelationGraphWire,
  type GraphSubNode,
  type GraphSubEdge,
} from '../utils/relation-graph';
import { useI18n } from '../i18n';

const props = defineProps<{
  registerId: string;
  conceptId: string;
}>();

const emit = defineEmits<{
  (e: 'navigate', payload: { registerId: string; conceptId: string }): void;
}>();

const { t } = useI18n();
const uiStore = useUiStore();
const { getStyle } = useDsStyle();
const { graph, loading, missing, error } = useRelationGraph(() => props.registerId);

// ── View state ─────────────────────────────────────────────────────
const scope = ref<'local' | 'global'>('local');
const globalDepth = ref(2);
const MAX_RENDER_NODES = 300;

const focusNodeId = computed(() => `${props.registerId}/${props.conceptId}`);

const sub = computed(() => {
  if (!graph.value) return null;
  const depth = scope.value === 'local' ? 1 : globalDepth.value;
  return neighborhood(graph.value as RelationGraphWire, focusNodeId.value, depth, MAX_RENDER_NODES);
});

const nodeCount = computed(() => sub.value?.nodes.length ?? 0);
const edgeCount = computed(() => sub.value?.edges.length ?? 0);
const truncated = computed(() => sub.value?.truncated ?? false);

const focusDesignation = computed(() => {
  const wire = graph.value;
  if (!wire) return props.conceptId;
  const entry = wire.nodes[focusNodeId.value];
  return entry?.[0] || props.conceptId;
});

const legendTypes = computed(() => {
  if (!sub.value) return [];
  const counts = edgeTypeCounts(sub.value.edges);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([type, count]) => ({ type, count, label: relationLabel(type) || type }));
});

// WCAG-conscious palette. Node labels and chrome follow the ink scale
// (light: 500 on white ≈ 7.6:1, dark: 300 on ink-900 ≈ 6.9:1); edge
// colors come from the site's per-relation-type SSOT pairs.
const LABEL_LIGHT = '#484a6e'; // ink-500
const LABEL_DARK = '#b8b9cc'; // ink-200
const EDGE_FALLBACK_LIGHT = '#8d8faa'; // ink-300
const EDGE_FALLBACK_DARK = '#636588'; // ink-400
const SURFACE_LIGHT = '#faf9f6';
const SURFACE_DARK = '#0f1020'; // ink-900

function labelColor(): string {
  return uiStore.isDark ? LABEL_DARK : LABEL_LIGHT;
}

function edgeColor(type: string): string {
  const color = colorForTypeInMode(type, uiStore.isDark);
  if (color && color.startsWith('#')) return color;
  return uiStore.isDark ? EDGE_FALLBACK_DARK : EDGE_FALLBACK_LIGHT;
}

function nodeFill(node: GraphSubNode): string {
  return getStyle(node.registerId)[uiStore.isDark ? 'dark' : 'light'];
}

function surfaceColor(): string {
  return uiStore.isDark ? SURFACE_DARK : SURFACE_LIGHT;
}

// ── d3 rendering ───────────────────────────────────────────────────
interface SimNode extends GraphSubNode {
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}
type SimEdge = { source: SimNode | string; target: SimNode | string; type: string };

const svgRef = ref<SVGSVGElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const emptyNotice = ref(false);

let simulation: Simulation<SimNode, undefined> | null = null;
let zoomBehavior: ReturnType<typeof zoom<SVGSVGElement, unknown>> | null = null;
let svgSel: Selection<SVGSVGElement, unknown, null, undefined> | null = null;
let gSel: Selection<SVGGElement, unknown, null, undefined> | null = null;

function render() {
  if (!svgRef.value || !containerRef.value) return;
  const data = sub.value;
  if (!data || data.nodes.length === 0) {
    emptyNotice.value = true;
    return;
  }
  emptyNotice.value = false;

  const width = containerRef.value.clientWidth || 800;
  const height = containerRef.value.clientHeight || 600;

  svgSel = select(svgRef.value);
  svgSel.selectAll('*').remove();
  svgSel.attr('viewBox', `0 0 ${width} ${height}`);

  const isDark = uiStore.isDark;
  const defs = svgSel.append('defs');
  // One arrowhead marker per distinct edge color — markers can't inherit
  // the line stroke, so each color gets its own.
  const markerColors = [...new Set(data.edges.map(e => edgeColor(e.type)))];
  for (const color of markerColors) {
    const id = `rg-arrow-${color.replace(/[^a-zA-Z0-9]/g, '')}`;
    defs
      .append('marker')
      .attr('id', id)
      .attr('viewBox', '0 -5 10 10')
      .attr('refX', 14)
      .attr('refY', 0)
      .attr('markerWidth', 5)
      .attr('markerHeight', 5)
      .attr('orient', 'auto')
      .append('path')
      .attr('d', 'M0,-4L10,0L0,4')
      .attr('fill', color);
  }

  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.15, 6])
    .on('zoom', event => {
      gSel?.attr('transform', event.transform.toString());
    });
  svgSel.call(zoomBehavior);

  gSel = svgSel.append('g');

  const simNodes: SimNode[] = data.nodes.map(n => ({
    ...n,
    x: width / 2 + (Math.random() - 0.5) * 160,
    y: height / 2 + (Math.random() - 0.5) * 160,
  }));
  const nodeIndex = new Map(simNodes.map(n => [n.id, n]));
  const simEdges: SimEdge[] = data.edges
    .filter(e => nodeIndex.has(e.source) && nodeIndex.has(e.target))
    .map(e => ({ source: e.source, target: e.target, type: e.type }));

  // Per-render locals: closures below must touch THIS render's
  // selections, never whatever a previous render left behind.
  const edgesBound = gSel
    .append('g')
    .selectAll<SVGLineElement, SimEdge>('line')
    .data(simEdges)
    .join('line')
    .attr('stroke', d => edgeColor(d.type))
    .attr('stroke-width', 1.2)
    .attr('marker-end', d => `url(#rg-arrow-${edgeColor(d.type).replace(/[^a-zA-Z0-9]/g, '')})`);

  const nodesBound = gSel
    .append('g')
    .selectAll<SVGGElement, SimNode>('g')
    .data(simNodes, d => d.id)
    .join('g')
    .attr('class', 'rg-node')
    .style('cursor', 'pointer');

  nodesBound
    .append('circle')
    .attr('r', d => (d.id === focusNodeId.value ? 9 : 5))
    .attr('fill', d => nodeFill(d))
    .attr('stroke', d => (d.id === focusNodeId.value ? labelColor() : surfaceColor()))
    .attr('stroke-width', d => (d.id === focusNodeId.value ? 2 : 1.5));

  nodesBound
    .append('text')
    .attr('dy', -11)
    .attr('text-anchor', 'middle')
    .attr('font-size', '10px')
    .attr('font-weight', d => (d.id === focusNodeId.value ? 700 : 500))
    .attr('font-family', '"DM Sans", system-ui, sans-serif')
    .attr('fill', () => labelColor())
    .attr('pointer-events', 'none')
    .text(d => (d.designation || d.conceptId).slice(0, 28));

  // Accessible name per node (designation + register + status).
  nodesBound
    .append('title')
    .text(d => `${d.designation || d.conceptId} — ${d.registerId}${d.status ? ` (${d.status})` : ''}`);

  function edgeTouchesNode(e: SimEdge, node: SimNode): boolean {
    const src = typeof e.source === 'string' ? e.source : e.source.id;
    const tgt = typeof e.target === 'string' ? e.target : e.target.id;
    return src === node.id || tgt === node.id;
  }

  nodesBound
    .on('click', (_event: unknown, d: SimNode) => {
      const { registerId, conceptId } = splitNodeId(d.id);
      if (registerId && conceptId) emit('navigate', { registerId, conceptId });
    })
    .on('mouseenter', function (this: SVGGElement, _event: unknown, d: SimNode) {
      edgesBound
        .attr('stroke-width', e => (edgeTouchesNode(e, d) ? 2.2 : 1.2))
        .attr('opacity', e => (edgeTouchesNode(e, d) ? 1 : 0.35));
      select<SVGGElement, SimNode>(this).select<SVGCircleElement>('circle')
        .attr('stroke-width', n => (n.id === d.id ? 2.5 : n.id === focusNodeId.value ? 2 : 1.5));
    })
    .on('mouseleave', () => {
      edgesBound.attr('stroke-width', 1.2).attr('opacity', 1);
    });

  const dragBehavior = drag<SVGGElement, SimNode>()
    .on('start', (event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
      if (!event.active) simulation?.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    })
    .on('drag', (event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
      d.fx = event.x;
      d.fy = event.y;
    })
    .on('end', (event: D3DragEvent<SVGGElement, SimNode, SimNode>, d) => {
      if (!event.active) simulation?.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    });
  nodesBound.call(dragBehavior);

  simulation?.stop();
  simulation = forceSimulation<SimNode>(simNodes)
    .force('link', forceLink<SimNode, SimEdge>(simEdges)
      .id(d => d.id)
      .distance(simNodes.length < 40 ? 80 : 50)
      .strength(0.6))
    .force('charge', forceManyBody().strength(simNodes.length < 40 ? -220 : -110))
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide<SimNode>().radius(14))
    .alpha(1)
    .alphaDecay(0.03)
    .on('tick', () => {
      edgesBound
        .attr('x1', d => (d.source as SimNode).x ?? 0)
        .attr('y1', d => (d.source as SimNode).y ?? 0)
        .attr('x2', d => (d.target as SimNode).x ?? 0)
        .attr('y2', d => (d.target as SimNode).y ?? 0);
      nodesBound.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });
}

// ── Lifecycle ──────────────────────────────────────────────────────
watch([graph, scope, globalDepth, focusNodeId], () => {
  nextTick(render);
});

watch(() => uiStore.isDark, () => {
  nextTick(render);
});

onMounted(() => {
  nextTick(render);
});

onBeforeUnmount(() => {
  simulation?.stop();
  simulation = null;
});

function resetZoom() {
  if (svgSel && zoomBehavior) {
    svgSel.transition().duration(400).call(zoomBehavior.transform, zoomIdentity);
  }
}

function relayout() {
  render();
}

// ── Export: SVG + PNG ──────────────────────────────────────────────
const exporting = ref(false);
const exportError = ref<string | null>(null);

async function exportSvg() {
  exportError.value = null;
  if (!svgRef.value || !containerRef.value || !sub.value) return;
  try {
    const width = containerRef.value.clientWidth || 800;
    const height = containerRef.value.clientHeight || 600;
    const svgString = serializeSvg(svgRef.value, width, height);
    downloadBlob(new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' }),
      exportFilename(props.registerId, props.conceptId, 'svg'));
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : String(e);
  }
}

async function exportPng() {
  exportError.value = null;
  if (!svgRef.value || !containerRef.value || !sub.value) return;
  exporting.value = true;
  try {
    const width = containerRef.value.clientWidth || 800;
    const height = containerRef.value.clientHeight || 600;
    const svgString = serializeSvg(svgRef.value, width, height);
    const blob = await rasterizePng(svgString, width, height, surfaceColor(), 2);
    downloadBlob(blob, exportFilename(props.registerId, props.conceptId, 'png'));
  } catch (e) {
    exportError.value = e instanceof Error ? e.message : String(e);
  } finally {
    exporting.value = false;
  }
}
</script>

<template>
  <div ref="containerRef" class="relative w-full h-full min-h-[28rem] bg-surface dark:bg-ink-900 rounded-lg border border-ink-100 dark:border-ink-700 overflow-hidden" data-testid="relation-graph">
    <!-- Controls -->
    <div class="absolute top-3 left-3 z-10 bg-surface-raised/95 dark:bg-ink-800/95 backdrop-blur rounded-lg border border-ink-100/60 dark:border-ink-700 px-3 py-2.5 text-xs" style="box-shadow: 0 2px 8px rgba(15, 16, 32, 0.08);">
      <div class="flex items-center gap-1 mb-2" role="group" :aria-label="t('relationGraph.scope')">
        <button
          class="px-2 py-1 rounded font-medium transition-colors"
          :class="scope === 'local' ? 'bg-ink-800 text-white dark:bg-ink-100 dark:text-ink-900' : 'text-ink-500 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-700'"
          :aria-pressed="scope === 'local'"
          @click="scope = 'local'"
        >
          {{ t('relationGraph.local') }}
        </button>
        <button
          class="px-2 py-1 rounded font-medium transition-colors"
          :class="scope === 'global' ? 'bg-ink-800 text-white dark:bg-ink-100 dark:text-ink-900' : 'text-ink-500 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-700'"
          :aria-pressed="scope === 'global'"
          @click="scope = 'global'"
        >
          {{ t('relationGraph.global') }}
        </button>
        <select
          v-if="scope === 'global'"
          v-model.number="globalDepth"
          class="ml-1 px-1 py-0.5 rounded border border-ink-100 dark:border-ink-600 bg-surface dark:bg-ink-700 text-ink-600 dark:text-ink-200"
          :aria-label="t('relationGraph.depth')"
        >
          <option :value="2">2</option>
          <option :value="3">3</option>
          <option :value="4">4</option>
        </select>
      </div>
      <div class="text-ink-400 dark:text-ink-300 tabular-nums" aria-live="polite">
        {{ nodeCount }} {{ t('relationGraph.nodes') }} · {{ edgeCount }} {{ t('relationGraph.edges') }}
      </div>
      <p v-if="truncated" class="mt-1 text-amber-600 dark:text-amber-400 max-w-[16rem] leading-snug">
        {{ t('relationGraph.truncated', { max: String(MAX_RENDER_NODES) }) }}
      </p>
      <div class="flex gap-3 mt-2 pt-2 border-t border-ink-100/60 dark:border-ink-700">
        <button class="text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-300 hover:text-ink-800 dark:hover:text-ink-100 transition-colors" @click="resetZoom">
          {{ t('relationGraph.resetZoom') }}
        </button>
        <button class="text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-300 hover:text-ink-800 dark:hover:text-ink-100 transition-colors" @click="relayout">
          {{ t('relationGraph.relayout') }}
        </button>
      </div>
      <div class="flex gap-3 mt-2 pt-2 border-t border-ink-100/60 dark:border-ink-700">
        <button
          class="text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-300 hover:text-ink-800 dark:hover:text-ink-100 transition-colors"
          :disabled="exporting || nodeCount === 0"
          @click="exportSvg"
        >
          {{ t('relationGraph.exportSvg') }}
        </button>
        <button
          class="text-[10px] font-semibold uppercase tracking-wide text-ink-500 dark:text-ink-300 hover:text-ink-800 dark:hover:text-ink-100 transition-colors"
          :disabled="exporting || nodeCount === 0"
          @click="exportPng"
        >
          {{ exporting ? t('relationGraph.exporting') : t('relationGraph.exportPng') }}
        </button>
      </div>
      <p v-if="exportError" class="mt-1 text-red-600 dark:text-red-400 max-w-[16rem] leading-snug" role="alert">{{ exportError }}</p>
    </div>

    <!-- Relation-type legend -->
    <div v-if="legendTypes.length > 0" class="absolute top-3 right-3 z-10 bg-surface-raised/95 dark:bg-ink-800/95 backdrop-blur rounded-lg border border-ink-100/60 dark:border-ink-700 px-3 py-2.5 max-w-[14rem]">
      <div class="text-[10px] font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-300 mb-1.5">{{ t('relationGraph.legend') }}</div>
      <div class="space-y-1">
        <div v-for="entry in legendTypes" :key="entry.type" class="flex items-center gap-1.5 text-[11px] text-ink-600 dark:text-ink-200">
          <span class="w-3 h-0.5 rounded-full inline-block flex-shrink-0" :style="{ backgroundColor: edgeColor(entry.type) }"></span>
          <span class="truncate">{{ entry.label }}</span>
          <span class="text-ink-300 dark:text-ink-400 ml-auto tabular-nums">{{ entry.count }}</span>
        </div>
      </div>
    </div>

    <!-- Loading / missing / error / empty states -->
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
      <div class="text-center">
        <div class="w-8 h-8 border-2 border-ink-200 dark:border-ink-600 border-t-ink-600 dark:border-t-ink-300 rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-sm text-ink-400 dark:text-ink-300">{{ t('relationGraph.loading') }}</p>
      </div>
    </div>
    <div v-else-if="missing" class="absolute inset-0 flex items-center justify-center px-8 text-center">
      <p class="text-sm text-ink-400 dark:text-ink-300">{{ t('relationGraph.noData') }}</p>
    </div>
    <div v-else-if="error" class="absolute inset-0 flex items-center justify-center px-8 text-center">
      <p class="text-sm text-red-600 dark:text-red-400" role="alert">{{ t('relationGraph.loadFailed') }} {{ error }}</p>
    </div>
    <div v-else-if="emptyNotice" class="absolute inset-0 flex items-center justify-center px-8 text-center">
      <p class="text-sm text-ink-400 dark:text-ink-300">{{ t('relationGraph.noRelations') }}</p>
    </div>

    <svg ref="svgRef" class="w-full h-full block" role="img" :aria-label="t('relationGraph.ariaLabel', { term: focusDesignation })"></svg>
  </div>
</template>
