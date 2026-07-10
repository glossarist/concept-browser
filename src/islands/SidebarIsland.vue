<template>
  <ErrorBoundary title="Sidebar failed">
    <AppSidebar />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import AppSidebar from '../components/AppSidebar.vue';
import ErrorBoundary from '../components/ErrorBoundary.vue';

defineProps<{
  activeDataset?: string;
  activeGroup?: string;
}>();
</script>
