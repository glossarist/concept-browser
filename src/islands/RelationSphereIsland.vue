<template>
  <ErrorBoundary title="Sphere view failed" :retry-key="conceptUri">
    <RelationSphere
      :concept="concept"
      :edges="edges"
      :concept-uri="conceptUri"
    />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import RelationSphere from '../components/RelationSphere.vue';
import ErrorBoundary from '../components/ErrorBoundary.vue';

defineProps<{
  concept: any;
  conceptUri: string;
  edges?: any[];
}>();
</script>
