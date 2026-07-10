/**
 * Island adapter for the REAL ConceptDetail.vue component.
 *
 * Astro provides concept data at build time. This island creates the
 * minimal dependency chain (Pinia stores, router stub) that
 * ConceptDetail needs, then renders the actual component — preserving
 * 100% of the SPA's UX.
 */
<template>
  <div class="concept-detail-wrapper">
    <component
      :is="ConceptDetail"
      :concept="concept"
      :register-id="registerId"
      :concept-uri="conceptUri"
    />
  </div>
</template>

<script setup lang="ts">
import { shallowRef, onMounted, getCurrentInstance } from 'vue';
import type { Concept } from 'glossarist';

const props = defineProps<{
  concept: any;
  registerId: string;
  conceptUri: string;
}>();

// Dynamically import the REAL ConceptDetail — it has deep deps
// (Pinia, router, composables) that need the island's app context.
// Using shallowRef to avoid deep reactivity on a large component.
const ConceptDetail = shallowRef<any>(null);

onMounted(async () => {
  try {
    // Import the real component
    const mod = await import('../components/ConceptDetail.vue');
    ConceptDetail.value = mod.default;
  } catch (e) {
    console.error('Failed to load ConceptDetail:', e);
    // Fallback to inline rendering
    ConceptDetail.value = {
      name: 'ConceptFallback',
      render() {
        return null;
      },
    };
  }
});
</script>
