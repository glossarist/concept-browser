<template>
  <div class="graph-island">
    <GraphPanel v-if="mounted" :nodes="nodes" :edges="edges" />
    <div v-else class="w-full h-[600px] flex items-center justify-center">
      <div class="text-center">
        <div class="inline-block w-12 h-12 border-4 border-blue-200 border-t-blue-500 rounded-full animate-spin mb-3"></div>
        <p class="text-ink-400 text-sm">Loading graph...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import GraphPanel from '../components/GraphPanel.vue';

defineProps<{
  nodes: Array<{ id: string; label: string; group?: string }>;
  edges: Array<{ source: string; target: string; type?: string }>;
}>();

const mounted = ref(false);
onMounted(() => { mounted.value = true; });
</script>
