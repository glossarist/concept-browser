<template>
  <div class="search-island">
    <input
      v-model="query"
      type="search"
      :placeholder="`Search ${totalConcepts} concepts...`"
      class="w-full px-4 py-3 border border-ink-200 dark:border-ink-700 rounded-lg bg-surface dark:bg-ink-800 text-ink-700 dark:text-ink-100 focus:ring-2 focus:ring-blue-400 focus:border-transparent"
    />
    <div v-if="query" class="mt-4 space-y-2">
      <p class="text-xs text-ink-400">{{ results.length }} result{{ results.length !== 1 ? 's' : '' }}</p>
      <!-- Use the real SearchResults component -->
      <SearchResults :results="formattedResults" />
    </div>
    <div v-else class="mt-4 text-ink-400 text-sm">Type to search across all datasets.</div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import SearchResults from '../components/SearchResults.vue';

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
    .sort((a, b) => a.term.localeCompare(b.term))
    .slice(0, 50);
});

// Format for SearchResults component
const formattedResults = computed(() =>
  results.value.map(r => ({
    id: r.conceptId,
    registerId: r.registerId,
    term: r.term,
    status: r.status,
  }))
);
</script>
