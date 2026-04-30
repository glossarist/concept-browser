<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import SearchBar from '../components/SearchBar.vue';
import { useUiStore } from '../stores/ui';

const route = useRoute();
const router = useRouter();
const ui = useUiStore();

onMounted(() => {
  if (route.query.q && typeof route.query.q === 'string') {
    ui.searchQuery = route.query.q;
  }
});

watch(() => route.query.q, (q) => {
  if (typeof q === 'string' && q) {
    ui.searchQuery = q;
  }
});
</script>

<template>
  <div class="px-4 sm:px-6 lg:px-8 py-8">
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
      <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors">Home</router-link>
      <span class="text-ink-200">/</span>
      <span class="text-ink-700">Search</span>
    </nav>
    <SearchBar />
  </div>
</template>
