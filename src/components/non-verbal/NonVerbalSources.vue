<script setup lang="ts">
/**
 * NonVerbalSources — shared source list for all three entity kinds.
 *
 * Reuses the existing CitationDisplay component for individual citations
 * so the rendering matches the rest of the app. Each source may carry a
 * modification note (e.g. "Adapted.") which is rendered alongside.
 */
import type { ConceptSource } from 'glossarist';
import CitationDisplay from '../CitationDisplay.vue';

defineProps<{
  sources: ConceptSource[];
}>();
</script>

<template>
  <div v-if="sources.length" class="nv-sources">
    <div class="nv-sources__label">Sources</div>
    <ol class="nv-sources__list">
      <li v-for="(src, i) in sources" :key="i" class="nv-source">
        <CitationDisplay v-if="src.origin" :citation="src.origin" />
        <span v-if="src.modification" class="nv-source__modification">
          — {{ src.modification }}
        </span>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.nv-sources {
  font-size: 0.75rem;
  color: var(--ink-500, #666);
  margin-top: 0.5rem;
}
.nv-sources__label {
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin-bottom: 0.25rem;
}
.nv-sources__list {
  list-style: decimal inside;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}
.nv-source__modification {
  color: var(--ink-400, #888);
  font-style: italic;
}
</style>
