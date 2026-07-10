<template>
  <ErrorBoundary title="Graph view failed" retry-key="graph">
    <GraphPanel :nodes="nodes" :edges="edges" />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import GraphPanel from '../components/GraphPanel.vue';
import ErrorBoundary from '../components/ErrorBoundary.vue';

defineProps<{
  nodes: Array<{ id: string; label: string; group?: string }>;
  edges: Array<{ source: string; target: string; type?: string }>;
}>();
</script>
