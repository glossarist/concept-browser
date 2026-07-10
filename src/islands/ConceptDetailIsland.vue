<template>
  <!-- Full concept detail using the REAL ConceptDetail.vue -->
  <ErrorBoundary title="Concept view failed" :retry-key="conceptUri">
    <ConceptDetail
      :concept="concept"
      :register-id="registerId"
      :concept-uri="conceptUri"
    />
  </ErrorBoundary>
</template>

<script setup lang="ts">
import { onErrorCaptured } from 'vue';
import ConceptDetail from '../components/ConceptDetail.vue';
import ErrorBoundary from '../components/ErrorBoundary.vue';

defineProps<{
  concept: any;
  registerId: string;
  conceptUri: string;
}>();

onErrorCaptured((err) => {
  console.error('ConceptDetail island error:', err);
  return false;
});
</script>
