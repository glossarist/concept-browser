<template>
  <ErrorBoundary title="Search failed" retry-key="search">
    <div class="search-island">
      <SearchBar />
      <SearchResults />
    </div>
  </ErrorBoundary>
</template>

<script setup lang="ts">
import SearchBar from '../components/SearchBar.vue';
import SearchResults from '../components/SearchResults.vue';
import ErrorBoundary from '../components/ErrorBoundary.vue';

defineProps<{
  concepts?: Array<{
    conceptId: string;
    registerId: string;
    term: string;
    status: string;
  }>;
}>();
</script>
