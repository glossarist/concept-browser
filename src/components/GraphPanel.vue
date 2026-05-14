<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick, reactive } from 'vue';
import type { GraphNode, GraphEdge } from '../adapters/types';
import type { SimulationNodeDatum, SimulationLinkDatum } from 'd3';
import { useDsStyle } from '../utils/dataset-style';
import { useUiStore } from '../stores/ui';
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
  type D3DragEvent,
  type Selection,
} from 'd3';

const props = defineProps<{
  nodes: GraphNode[];
  edges: GraphEdge[];
  registers: { id: string; title: string }[];
}>();

const svgRef = ref<SVGSVGElement | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);
const selectedNode = ref<GraphNode | null>(null);
const detailCloseRef = ref<HTMLButtonElement | null>(null);
const labelMode = ref<'designation' | 'identifier'>('designation');

// Dataset enable/disable state
const registerEnabled = reactive<Record<string, boolean>>({});
const panelOpen = ref(true);

// Default to first register only enabled
for (let i = 0; i < props.registers.length; i++) {
  const reg = props.registers[i];
  if (registerEnabled[reg.id] === undefined) {
    registerEnabled[reg.id] = i === 0;
  }
}

// Watch for new registers — keep them off by default
watch(() => props.registers, (regs) => {
  for (const reg of regs) {
    if (registerEnabled[reg.id] === undefined) {
      registerEnabled[reg.id] = false;
    }
  }
});

const { getColor } = useDsStyle();
const uiStore = useUiStore();

const STUB_COLOR = '#b8b9cc'; // ink-200
const HIGHLIGHT_COLOR = '#1a1b2e'; // ink-800

function registerColor(register: string): string {
  return getColor(register);
}

// Filtered data based on enabled registers
const enabledRegisters = computed(() => {
  const enabled = new Set<string>();
  for (const [id, on] of Object.entries(registerEnabled)) {
    if (on) enabled.add(id);
  }
  return enabled;
});

const visibleNodes = computed(() => {
  const enabled = enabledRegisters.value;
  return props.nodes.filter(n => enabled.has(n.register));
});

const visibleNodeUris = computed(() => {
  const uris = new Set<string>();
  for (const n of visibleNodes.value) uris.add(n.uri);
  return uris;
});

const visibleEdges = computed(() => {
  const uris = visibleNodeUris.value;
  const lang = uiStore.selectedLang;
  return props.edges.filter(e =>
    uris.has(e.source) && uris.has(e.target) &&
    (!lang || !e.lang || e.lang === lang)
  );
});

const nodeCount = computed(() => visibleNodes.value.length);
const edgeCount = computed(() => visibleEdges.value.length);
const isCapped = computed(() => nodeCount.value > MAX_RENDER_NODES);

// Per-register stats (from ALL props, not filtered)
const registerStats = computed(() => {
  const stats: Record<string, { nodes: number; edges: number }> = {};
  for (const reg of props.registers) {
    stats[reg.id] = { nodes: 0, edges: 0 };
  }
  for (const n of props.nodes) {
    if (stats[n.register]) stats[n.register].nodes++;
  }
  for (const e of props.edges) {
    const reg = e.register || (e.source.match(/glossarist\.org\/([^/]+)\/concept\//)?.[1] ?? '');
    if (stats[reg]) stats[reg].edges++;
  }
  return stats;
});

interface SimNode extends SimulationNodeDatum {
  uri: string;
  register: string;
  conceptId: string;
  designation: string;
  loaded: boolean;
  nodeType?: 'concept' | 'domain';
}

interface SimLink extends SimulationLinkDatum<SimNode> {
  source: SimNode | string;
  target: SimNode | string;
  type: string;
  label?: string;
  lang?: string;
}

let simulation: ReturnType<typeof forceSimulation<SimNode>> | null = null;
let svg: Selection<SVGSVGElement, unknown, null, undefined> | null = null;
let g: Selection<SVGGElement, unknown, null, undefined> | null = null;
let zoomBehavior: ReturnType<typeof zoom<SVGSVGElement, unknown>> | null = null;

function initGraph() {
  if (!svgRef.value || !containerRef.value) return;

  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;

  svg = select(svgRef.value);
  g = svg.append<SVGGElement>('g');

  zoomBehavior = zoom<SVGSVGElement, unknown>()
    .scaleExtent([0.1, 8])
    .on('zoom', (event) => {
      g?.attr('transform', event.transform.toString());
    });
  svg.call(zoomBehavior);

  // Arrow marker
  const defs = svg.append('defs');
  defs.append('marker')
    .attr('id', 'arrowhead')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 5)
    .attr('markerHeight', 5)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-4L10,0L0,4')
    .attr('fill', '#dddde6'); // ink-100

  buildSimulation(width, height);
}

const MAX_RENDER_NODES = 3000;

function buildSimulation(width: number, height: number) {
  if (!g) return;

  const allVisible = visibleNodes.value;
  const capped = allVisible.length > MAX_RENDER_NODES;
  const renderNodes = capped ? allVisible.slice(0, MAX_RENDER_NODES) : allVisible;

  const simNodes: SimNode[] = renderNodes.map(n => ({
    uri: n.uri,
    register: n.register,
    conceptId: n.conceptId,
    designation: Object.values(n.designations)[0] || n.conceptId,
    loaded: n.loaded,
    nodeType: n.nodeType,
    x: width / 2 + (Math.random() - 0.5) * 200,
    y: height / 2 + (Math.random() - 0.5) * 200,
  }));

  const nodeMap = new Map(simNodes.map(n => [n.uri, n]));

  const simLinks: SimLink[] = visibleEdges.value
    .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
    .map(e => ({
      source: e.source,
      target: e.target,
      type: e.type,
      label: e.label,
      lang: e.lang,
    }));

  g.selectAll('*').remove();

  const linkSel = g.append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(simLinks)
    .join('line')
    .attr('stroke', l => l.type === 'domain' ? '#c4b5fd' : '#dddde6')
    .attr('stroke-width', l => l.type === 'domain' ? 0.6 : 0.8)
    .attr('stroke-dasharray', l => l.type === 'domain' ? '3,2' : 'none')
    .attr('marker-end', l => l.type === 'domain' ? null : 'url(#arrowhead)');

  const nodeSel = g.append('g')
    .attr('class', 'nodes')
    .selectAll<SVGGElement, SimNode>('g')
    .data(simNodes, d => d.uri)
    .join('g')
    .attr('class', 'node')
    .style('cursor', 'pointer');

  const domainNodes = nodeSel.filter(d => d.nodeType === 'domain');
  const conceptNodes = nodeSel.filter(d => d.nodeType !== 'domain');

  // Domain: rounded rectangle with standard name inside
  domainNodes.append('rect')
    .attr('width', d => Math.max(48, d.designation.length * 5.5 + 10))
    .attr('height', 14)
    .attr('rx', 3)
    .attr('x', d => -(Math.max(48, d.designation.length * 5.5 + 10) / 2))
    .attr('y', -7)
    .attr('fill', '#ede9fe')
    .attr('stroke', '#8b5cf6')
    .attr('stroke-width', 1);

  domainNodes.append('text')
    .attr('text-anchor', 'middle')
    .attr('dy', 4)
    .attr('font-size', '7px')
    .attr('font-family', '"DM Sans", system-ui, sans-serif')
    .attr('font-weight', '600')
    .attr('fill', '#6d28d9')
    .attr('pointer-events', 'none')
    .text(d => d.designation);

  // Concept: circle
  conceptNodes.append('circle')
    .attr('r', d => d.loaded ? 5 : 3)
    .attr('fill', d => d.loaded ? registerColor(d.register) : STUB_COLOR)
    .attr('stroke', '#faf9f6')
    .attr('stroke-width', 1.5);

  conceptNodes.append('text')
    .attr('dy', -9)
    .attr('text-anchor', 'middle')
    .attr('font-size', '8px')
    .attr('font-family', '"DM Sans", system-ui, sans-serif')
    .attr('font-weight', '500')
    .attr('fill', '#636588') // ink-400
    .attr('pointer-events', 'none')
    .text(d => (labelMode.value === 'identifier' ? d.conceptId : d.designation).slice(0, 18));

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

  nodeSel.call(dragBehavior);

  nodeSel.on('click', (_event, d) => {
    const node = props.nodes.find(n => n.uri === d.uri);
    if (node) {
      selectedNode.value = selectedNode.value?.uri === node.uri ? null : node;
    }
  });

  nodeSel.on('mouseenter', (_event, d) => {
    linkSel
      .attr('stroke', l => {
        const src = typeof l.source === 'object' ? l.source.uri : l.source;
        const tgt = typeof l.target === 'object' ? l.target.uri : l.target;
        return src === d.uri || tgt === d.uri ? HIGHLIGHT_COLOR : '#eeeef2';
      })
      .attr('stroke-width', l => {
        const src = typeof l.source === 'object' ? l.source.uri : l.source;
        const tgt = typeof l.target === 'object' ? l.target.uri : l.target;
        return src === d.uri || tgt === d.uri ? 1.5 : 0.8;
      });
    conceptNodes.select('circle')
      .attr('r', n => n.uri === d.uri ? 8 : n.loaded ? 5 : 3)
      .attr('fill', n => n.uri === d.uri ? HIGHLIGHT_COLOR : n.loaded ? registerColor(n.register) : STUB_COLOR);
    domainNodes.select('rect')
      .attr('stroke', n => n.uri === d.uri ? '#6d28d9' : '#8b5cf6')
      .attr('stroke-width', n => n.uri === d.uri ? 2 : 1);
  }).on('mouseleave', () => {
    linkSel
      .attr('stroke', l => l.type === 'domain' ? '#c4b5fd' : '#dddde6')
      .attr('stroke-width', l => l.type === 'domain' ? 0.6 : 0.8);
    conceptNodes.select('circle')
      .attr('r', n => n.loaded ? 5 : 3)
      .attr('fill', n => n.loaded ? registerColor(n.register) : STUB_COLOR);
    domainNodes.select('rect')
      .attr('stroke', '#8b5cf6')
      .attr('stroke-width', 1);
  });

  const count = simNodes.length;
  simulation = forceSimulation<SimNode>(simNodes)
    .force('link', forceLink<SimNode, SimLink>(simLinks)
      .id(d => d.uri)
      .distance(count < 50 ? 80 : count < 200 ? 60 : 40)
      .strength(0.5)
    )
    .force('charge', forceManyBody()
      .strength(count < 50 ? -200 : count < 200 ? -100 : -50)
    )
    .force('center', forceCenter(width / 2, height / 2))
    .force('collide', forceCollide<SimNode>().radius(d =>
      d.nodeType === 'domain' ? 35 : (count > 1000 ? 6 : 12)
    ))
    .alpha(1)
    .alphaDecay(count > 500 ? 0.05 : 0.02)
    .on('tick', () => {
      linkSel
        .attr('x1', d => (d.source as SimNode).x ?? 0)
        .attr('y1', d => (d.source as SimNode).y ?? 0)
        .attr('x2', d => (d.target as SimNode).x ?? 0)
        .attr('y2', d => (d.target as SimNode).y ?? 0);

      nodeSel.attr('transform', d => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });
}

function rebuildGraph() {
  if (!containerRef.value || !svgRef.value) return;
  const width = containerRef.value.clientWidth;
  const height = containerRef.value.clientHeight;

  if (g) g.selectAll('*').remove();
  if (simulation) simulation.stop();

  if (!g) {
    initGraph();
  } else {
    buildSimulation(width, height);
  }
}

// Focus close button when node detail popup opens
watch(selectedNode, (node) => {
  if (node) {
    nextTick(() => {
      detailCloseRef.value?.focus();
    });
  }
});

// Rebuild when data or filters change
let prevDataKey = '';
watch([() => props.nodes.length, () => props.edges.length], ([nn, ne]) => {
  const key = `${nn}:${ne}`;
  if (key !== prevDataKey && nn > 0) {
    prevDataKey = key;
    nextTick(rebuildGraph);
  }
});

// Rebuild when register filters change
watch(registerEnabled, () => {
  nextTick(rebuildGraph);
});

onMounted(() => {
  nextTick(() => {
    if (props.nodes.length > 0) {
      initGraph();
      prevDataKey = `${props.nodes.length}:${props.edges.length}`;
    }
  });
});

onUnmounted(() => {
  simulation?.stop();
});

function resetZoom() {
  if (svg && zoomBehavior) {
    svg.transition().duration(500).call(zoomBehavior.transform, zoomIdentity);
  }
}

function toggleAll(on: boolean) {
  for (const reg of props.registers) {
    registerEnabled[reg.id] = on;
  }
}

function selectOnly(registerId: string) {
  for (const reg of props.registers) {
    registerEnabled[reg.id] = reg.id === registerId;
  }
}

function registerTitle(id: string): string {
  return props.registers.find(r => r.id === id)?.title ?? id;
}

function selectedNodeColor(): string {
  if (!selectedNode.value) return STUB_COLOR;
  if (!selectedNode.value.loaded) return STUB_COLOR;
  return registerColor(selectedNode.value.register);
}
</script>

<template>
  <div ref="containerRef" class="w-full h-full relative bg-surface">
    <!-- Control panel -->
    <div class="absolute top-4 left-4 z-10">
      <div class="bg-surface-raised/95 backdrop-blur rounded-xl border border-ink-100/60 overflow-hidden" style="box-shadow: 0 4px 12px rgba(26, 27, 46, 0.08);">
        <button
          @click="panelOpen = !panelOpen"
          :aria-label="panelOpen ? 'Collapse controls' : 'Expand controls'"
          class="w-full px-4 py-2.5 flex items-center justify-between hover:bg-ink-50/50 transition-colors"
        >
          <span class="text-xs font-semibold text-ink-600 tracking-wide">
            {{ nodeCount.toLocaleString() }} nodes &middot; {{ edgeCount.toLocaleString() }} edges
          </span>
          <svg class="w-3.5 h-3.5 text-ink-300 transition-transform" :class="panelOpen ? 'rotate-180' : ''" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
          </svg>
        </button>

        <div v-if="panelOpen" class="px-4 pb-4 border-t border-ink-100/40">
          <!-- Dataset toggles -->
          <div class="mt-3 space-y-2">
            <div class="flex items-center gap-2 mb-3">
              <button @click="toggleAll(true)" class="text-[10px] font-semibold text-ink-500 hover:text-ink-700 uppercase tracking-wide transition-colors">All</button>
              <span class="text-ink-200 text-xs">|</span>
              <button @click="toggleAll(false)" class="text-[10px] font-semibold text-ink-500 hover:text-ink-700 uppercase tracking-wide transition-colors">None</button>
            </div>
            <div
              v-for="reg in registers"
              :key="reg.id"
              class="flex items-center gap-2.5 py-1"
            >
              <label class="cursor-pointer flex items-center">
                <input
                  type="checkbox"
                  v-model="registerEnabled[reg.id]"
                  class="rounded border-ink-200 text-ink-800 focus:ring-ink-400/30"
                />
              </label>
              <button
                @click="selectOnly(reg.id)"
                class="flex items-center gap-2 min-w-0 flex-1 text-left group"
              >
                <span
                  class="w-2.5 h-2.5 rounded-full flex-shrink-0 ring-2 ring-offset-1"
                  :style="{ backgroundColor: registerColor(reg.id), '--tw-ring-color': registerColor(reg.id) + '40' }"
                ></span>
                <span class="text-xs text-ink-600 group-hover:text-ink-800 truncate transition-colors">{{ reg.title }}</span>
                <span class="text-[10px] text-ink-300 ml-auto tabular-nums">
                  {{ registerStats[reg.id]?.nodes ?? 0 }}
                </span>
              </button>
            </div>
          </div>

          <!-- Actions -->
          <div v-if="isCapped" class="text-[10px] text-amber-600 mt-2 leading-relaxed">
            Rendering first {{ MAX_RENDER_NODES.toLocaleString() }} of {{ nodeCount.toLocaleString() }} nodes.
          </div>

          <div v-if="nodeCount > 0" class="flex gap-4 mt-3 pt-3 border-t border-ink-100/40">
            <button @click="resetZoom" class="text-[10px] font-semibold text-ink-500 hover:text-ink-700 uppercase tracking-wide transition-colors">Reset zoom</button>
            <button @click="rebuildGraph" class="text-[10px] font-semibold text-ink-500 hover:text-ink-700 uppercase tracking-wide transition-colors">Re-layout</button>
          </div>

          <div v-if="nodeCount > 0" class="mt-3 pt-3 border-t border-ink-100/40">
            <div class="text-[10px] font-semibold text-ink-400 uppercase tracking-wide mb-2">Node labels</div>
            <div class="flex gap-1">
              <button
                @click="labelMode = 'designation'; rebuildGraph()"
                class="text-[10px] px-2 py-1 rounded font-medium transition-colors"
                :class="labelMode === 'designation' ? 'bg-ink-800 text-white' : 'text-ink-500 hover:bg-ink-50'"
              >Designation</button>
              <button
                @click="labelMode = 'identifier'; rebuildGraph()"
                class="text-[10px] px-2 py-1 rounded font-medium transition-colors"
                :class="labelMode === 'identifier' ? 'bg-ink-800 text-white' : 'text-ink-500 hover:bg-ink-50'"
              >Identifier</button>
            </div>
          </div>

          <div v-if="nodeCount === 0" class="text-xs text-ink-300 mt-3 leading-relaxed">
            {{ props.edges.length > 0 ? 'Enable datasets to see their graph.' : 'Browse concepts with cross-references to populate the graph.' }}
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div v-if="nodeCount > 0" class="absolute top-4 right-4 z-10 bg-surface-raised/90 backdrop-blur rounded-lg px-3 py-2.5 border border-ink-100/60 text-xs" style="box-shadow: 0 2px 6px rgba(26, 27, 46, 0.04);">
      <div v-if="registers.length > 1">
        <div class="font-semibold text-ink-400 text-[10px] uppercase tracking-wide mb-2">Datasets</div>
        <div v-for="reg in registers" :key="reg.id" class="flex items-center gap-2 mb-1.5 last:mb-0">
          <span
            class="w-2.5 h-2.5 rounded-full inline-block flex-shrink-0"
            :style="{ backgroundColor: registerColor(reg.id) }"
          ></span>
          <span class="text-ink-500">{{ reg.title }}</span>
        </div>
      </div>
      <div class="flex items-center gap-2 mt-2 pt-2 border-t border-ink-100/40">
        <span class="w-2 h-2 rounded-full inline-block" :style="{ backgroundColor: STUB_COLOR }"></span>
        <span class="text-ink-300">Stub (not loaded)</span>
      </div>
      <div class="flex items-center gap-2 mt-2 pt-2 border-t border-ink-100/40">
        <span class="w-4 h-2 rounded inline-block flex-shrink-0" style="background: #ede9fe; border: 1px solid #8b5cf6;"></span>
        <span class="text-ink-300">Domain (standard)</span>
      </div>
    </div>

    <svg ref="svgRef" class="w-full h-full" role="img" aria-label="Concept relationship graph visualization"></svg>

    <!-- Node detail popup -->
    <div
      v-if="selectedNode"
      @keydown.escape="selectedNode = null"
      class="absolute bottom-6 left-6 right-6 max-w-xs bg-surface-raised rounded-xl border border-ink-100/60 p-5 z-20"
      style="box-shadow: 0 8px 24px rgba(26, 27, 46, 0.12);"
    >
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <h3 class="font-serif text-base text-ink-800 leading-snug truncate">
            {{ Object.values(selectedNode.designations)[0] || selectedNode.conceptId }}
          </h3>
          <p class="text-xs text-ink-300 font-mono mt-0.5">{{ selectedNode.conceptId }}</p>
          <div class="flex items-center gap-1.5 mt-2">
            <span
              class="w-2 h-2 rounded-full inline-block flex-shrink-0"
              :style="{ backgroundColor: selectedNodeColor() }"
            ></span>
            <span class="text-[10px] text-ink-400 uppercase tracking-wide">
              {{ registerTitle(selectedNode.register) }} &middot;
              {{ selectedNode.loaded ? 'loaded' : 'stub' }}
            </span>
          </div>
        </div>
        <button ref="detailCloseRef" @click="selectedNode = null" class="text-ink-300 hover:text-ink-600 transition-colors flex-shrink-0 mt-0.5" aria-label="Close">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>
      <router-link
        v-if="selectedNode.register && selectedNode.nodeType !== 'domain'"
        :to="{ name: 'concept', params: { registerId: selectedNode.register, conceptId: selectedNode.conceptId } }"
        class="btn-primary text-xs mt-4 inline-block"
      >
        View concept
      </router-link>
    </div>
  </div>
</template>
