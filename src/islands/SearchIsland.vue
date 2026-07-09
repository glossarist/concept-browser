<template>
  <div class="search-island">
    <input
      ref="input"
      v-model="query"
      type="search"
      :placeholder="`Search ${totalConcepts} concepts...`"
      class="w-full px-4 py-3 border border-ink-200 dark:border-ink-700 rounded-lg bg-surface dark:bg-ink-800 text-ink-700 dark:text-ink-100 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
      @input="onInput"
    />
    <div v-if="query" class="mt-4 space-y-2">
      <p class="text-xs text-ink-400">{{ results.length }} result{{ results.length !== 1 ? 's' : '' }}</p>
      <a
        v-for="r in results.slice(0, 50)"
        :key="r.registerId + r.conceptId"
        :href="`/dataset/${r.registerId}/concept/${r.conceptId}`"
        class="block p-3 rounded border border-ink-100/60 dark:border-ink-700/40 hover:bg-ink-50 dark:hover:bg-ink-800/40 transition-colors"
      >
        <span class="font-medium text-ink-700 dark:text-ink-200" v-html="highlight(r.term)"></span>
        <span class="text-xs text-ink-400 ml-2">{{ r.registerId }}</span>
        <span v-if="r.status" :class="['text-xs ml-2 px-1.5 py-0.5 rounded', r.status === 'valid' ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600']">{{ r.status }}</span>
      </a>
      <p v-if="results.length === 0" class="text-ink-400 text-sm">No results for "{{ query }}".</p>
    </div>
    <div v-else class="mt-4 text-ink-400 text-sm">Type to search across all datasets.</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

const props = defineProps<{
  concepts: Array<{
    conceptId: string;
    registerId: string;
    term: string;
    status: string;
  }>;
}>();

const query = ref('');
const totalConcepts = computed(() => props.concepts.length);

const results = computed(() => {
  const q = query.value.toLowerCase().trim();
  if (!q) return [];
  return props.concepts
    .filter(c => c.term.toLowerCase().includes(q))
    .sort((a, b) => {
      // Exact match first, then starts-with, then contains
      const al = a.term.toLowerCase();
      const bl = b.term.toLowerCase();
      const aStarts = al.startsWith(q) ? 0 : 1;
      const bStarts = bl.startsWith(q) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return al.localeCompare(bl);
    });
});

function onInput() { /* reactive via v-model */ }

function highlight(text: string): string {
  const q = query.value.trim();
  if (!q) return escapeHtml(text);
  const escaped = escapeRegex(q);
  return escapeHtml(text).replace(new RegExp(`(${escaped})`, 'gi'), '<mark>$1</mark>');
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
</script>
