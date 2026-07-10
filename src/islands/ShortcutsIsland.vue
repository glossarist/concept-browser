<template>
  <ErrorBoundary title="Shortcuts failed">
    <ShortcutsModal :open="open" @close="$emit('close')" />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import ShortcutsModal from '../components/ShortcutsModal.vue';
import ErrorBoundary from '../components/ErrorBoundary.vue';

defineProps<{ open: boolean }>();
defineEmits<{ close: [] }>();
</script>
