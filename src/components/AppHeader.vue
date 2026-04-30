<script setup lang="ts">
import { useRouter } from 'vue-router';
import { useUiStore } from '../stores/ui';
import { useVocabularyStore } from '../stores/vocabulary';
import { ref } from 'vue';

const router = useRouter();
const ui = useUiStore();
const store = useVocabularyStore();
const searchInput = ref('');

function doSearch() {
  const q = searchInput.value.trim();
  if (q) {
    ui.searchQuery = q;
    router.push({ name: 'search', query: { q } });
  }
}

function goHome() {
  router.push({ name: 'home' });
}
</script>

<template>
  <header class="bg-surface-raised border-b border-ink-100/80 z-30 relative">
    <div class="px-4 lg:px-5 h-14 flex items-center gap-3">
      <!-- Mobile hamburger -->
      <button
        @click="ui.toggleSidebar()"
        :aria-label="ui.sidebarOpen ? 'Close navigation menu' : 'Open navigation menu'"
        class="lg:hidden p-2 -ml-1 rounded-lg text-ink-600 hover:bg-ink-50 transition-colors flex-shrink-0"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 6h16M4 12h16M4 18h16"/>
        </svg>
      </button>

      <!-- Logo -->
      <button @click="goHome" class="flex items-center gap-2 hover:opacity-80 transition flex-shrink-0 group">
        <div class="w-8 h-8 bg-ink-800 rounded-lg flex items-center justify-center group-hover:bg-ink-700 transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
            <line x1="9" y1="7" x2="17" y2="7"/>
            <line x1="9" y1="11" x2="15" y2="11"/>
          </svg>
        </div>
        <span class="font-serif text-lg text-ink-800 leading-none hidden sm:inline">Glossarist</span>
      </button>

      <!-- Search -->
      <form @submit.prevent="doSearch" class="flex-1 max-w-lg mx-2 sm:mx-4">
        <div class="relative">
          <input
            v-model="searchInput"
            type="text"
            aria-label="Search concepts"
            placeholder="Search..."
            class="w-full pl-9 pr-3 py-2 text-sm bg-surface border border-ink-100 rounded-lg focus:ring-2 focus:ring-ink-200 focus:border-ink-400 outline-none placeholder:text-ink-300 transition-all"
          />
          <svg class="absolute left-3 top-2.5 w-4 h-4 text-ink-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
          </svg>
        </div>
      </form>

      <!-- Stats -->
      <div class="text-xs text-ink-400 flex-shrink-0 hidden md:block">
        {{ store.datasetList.length }} datasets
      </div>
    </div>
  </header>
</template>
