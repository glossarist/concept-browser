<template>
  <ErrorBoundary title="Series card failed">
    <DatasetSeriesCard :register-id="registerId" />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import DatasetSeriesCard from '../components/DatasetSeriesCard.vue';
import ErrorBoundary from '../components/ErrorBoundary.vue';

defineProps<{ registerId: string }>();
</script>
