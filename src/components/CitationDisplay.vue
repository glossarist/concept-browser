<script setup lang="ts">
import type { Citation } from 'glossarist';

const props = defineProps<{
  citation: Citation;
}>();

function formatRef(c: Citation): string {
  const ref = c.ref;
  if (!ref) return '';
  const parts: string[] = [];
  if (ref.source) parts.push(ref.source);
  if (ref.id) parts.push(ref.id);
  if (ref.version) parts.push(`(${ref.version})`);
  return parts.join(' ');
}
</script>

<template>
  <span class="inline">
    <template v-if="citation.ref">
      <span v-if="citation.ref.source" class="font-medium">{{ citation.ref.source }}</span>
      <span v-if="citation.ref.id"> {{ citation.ref.id }}</span>
      <span v-if="citation.ref.version" class="text-ink-400"> ({{ citation.ref.version }})</span>
    </template>
    <template v-if="citation.locality">
      <span v-if="citation.locality.type" class="text-ink-400">, {{ citation.locality.type }}</span>
      <span v-if="citation.locality.referenceFrom" class="text-ink-400">
        {{ citation.locality.referenceTo ? ` ${citation.locality.referenceFrom}–${citation.locality.referenceTo}` : ` ${citation.locality.referenceFrom}` }}
      </span>
    </template>
    <a v-if="citation.link" :href="citation.link" target="_blank" rel="noopener" class="concept-link ml-1">[link]</a>
    <span v-if="citation.original" class="text-xs text-ink-300 ml-1">(orig: {{ citation.original }})</span>
  </span>
</template>
