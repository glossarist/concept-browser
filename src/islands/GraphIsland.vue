<template>
  <div ref="container" class="graph-island w-full h-[600px] relative">
    <div v-if="loading" class="absolute inset-0 flex items-center justify-center">
      <div class="text-center">
        <div class="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-3"></div>
        <p class="text-ink-400 text-sm">Loading graph data...</p>
      </div>
    </div>
    <canvas v-show="!loading" ref="canvas" class="w-full h-full"></canvas>
    <div v-if="!loading && nodes.length === 0" class="absolute inset-0 flex items-center justify-center">
      <p class="text-ink-400">No graph data available.</p>
    </div>
    <div class="absolute top-2 right-2 flex gap-2">
      <button @click="zoomIn" class="p-1.5 rounded bg-surface dark:bg-ink-800 border border-ink-200 dark:border-ink-600 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700 text-sm">+</button>
      <button @click="zoomOut" class="p-1.5 rounded bg-surface dark:bg-ink-800 border border-ink-200 dark:border-ink-600 text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-700 text-sm">−</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps<{
  nodes: Array<{ id: string; label: string; group?: string }>;
  edges: Array<{ source: string; target: string; type?: string }>;
}>();

const container = ref<HTMLElement>();
const canvas = ref<HTMLCanvasElement>();
const loading = ref(true);
const nodes = ref(props.nodes);
const edges = ref(props.edges);
let animationId: number | null = null;
let scale = 1;

onMounted(async () => {
  // Dynamically import D3 to avoid loading it for all visitors
  try {
    const { select, forceSimulation, forceManyBody, forceCenter, forceLink } = await import('d3');
    loading.value = false;
    if (nodes.value.length === 0) return;

    const width = container.value?.clientWidth ?? 800;
    const height = 600;
    const ctx = canvas.value?.getContext('2d');
    if (!ctx) return;
    canvas.value!.width = width;
    canvas.value!.height = height;

    // Simple force simulation
    const positions = new Map<string, { x: number; y: number; vx: number; vy: number }>();
    for (const n of nodes.value) {
      positions.set(n.id, {
        x: width / 2 + (Math.random() - 0.5) * 200,
        y: height / 2 + (Math.random() - 0.5) * 200,
        vx: 0, vy: 0,
      });
    }

    const sim = forceSimulation(nodes.value as any)
      .force('charge', forceManyBody().strength(-200))
      .force('center', forceCenter(width / 2, height / 2))
      .on('tick', draw);

    function draw() {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      // Draw edges
      ctx.strokeStyle = 'rgba(100, 100, 100, 0.2)';
      ctx.lineWidth = 1;
      for (const e of edges.value) {
        const s = positions.get(e.source);
        const t = positions.get(e.target);
        if (!s || !t) continue;
        ctx.beginPath();
        ctx.moveTo(s.x * scale, s.y * scale);
        ctx.lineTo(t.x * scale, t.y * scale);
        ctx.stroke();
      }
      // Draw nodes
      for (const n of nodes.value) {
        const p = positions.get(n.id);
        if (!p) continue;
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(p.x * scale, p.y * scale, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } catch {
    loading.value = false;
  }
});

function zoomIn() { scale = Math.min(scale * 1.2, 3); }
function zoomOut() { scale = Math.max(scale / 1.2, 0.3); }

onUnmounted(() => {
  if (animationId) cancelAnimationFrame(animationId);
});
</script>
