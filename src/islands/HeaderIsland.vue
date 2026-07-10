<template>
  <ErrorBoundary title="Header failed">
    <AppHeader />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import AppHeader from '../components/AppHeader.vue';
import ErrorBoundary from '../components/ErrorBoundary.vue';
</script>
