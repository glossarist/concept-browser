<template>
  <ErrorBoundary title="Group renderer failed">
    <DatasetGroupRenderer :group="group" :datasets="datasets" />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import DatasetGroupRenderer from '../components/DatasetGroupRenderer.vue';
import ErrorBoundary from '../components/ErrorBoundary.vue';

defineProps<{
  group: any;
  datasets: any[];
}>();
</script>
