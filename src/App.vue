<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useVocabularyStore } from './stores/vocabulary';
import AppHeader from './components/AppHeader.vue';
import AppSidebar from './components/AppSidebar.vue';

const store = useVocabularyStore();
const appReady = ref(false);
const showScrollTop = ref(false);
let mainEl: HTMLElement | null = null;

function onMainScroll() {
  showScrollTop.value = (mainEl?.scrollTop ?? 0) > 400;
}

function scrollToTop() {
  mainEl?.scrollTo({ top: 0, behavior: 'smooth' });
}

onMounted(async () => {
  await store.discoverDatasets();
  appReady.value = true;
  // Watch scroll on main content area
  mainEl = document.querySelector('main');
  mainEl?.addEventListener('scroll', onMainScroll, { passive: true });
});

onUnmounted(() => {
  mainEl?.removeEventListener('scroll', onMainScroll);
});
</script>

<template>
  <div class="min-h-screen bg-surface flex flex-col">
    <AppHeader />
    <div class="flex flex-1 overflow-hidden">
      <AppSidebar />
      <main class="flex-1 overflow-y-auto bg-surface">
        <div v-if="!appReady" class="flex items-center justify-center h-[70vh]">
          <div class="w-full max-w-md px-6 space-y-6">
            <!-- Title skeleton -->
            <div class="space-y-3">
              <div class="skeleton h-3 w-24"></div>
              <div class="skeleton h-10 w-64"></div>
              <div class="skeleton h-4 w-80"></div>
              <div class="skeleton h-4 w-56"></div>
            </div>
            <!-- Stats skeleton -->
            <div class="flex gap-4">
              <div class="skeleton h-16 flex-1"></div>
              <div class="skeleton h-16 flex-1"></div>
              <div class="skeleton h-16 flex-1"></div>
            </div>
            <!-- Card skeleton -->
            <div class="flex gap-4">
              <div class="skeleton h-40 flex-1"></div>
              <div class="skeleton h-40 flex-1"></div>
              <div class="skeleton h-40 flex-1"></div>
            </div>
          </div>
        </div>
        <template v-else>
          <div v-if="store.error && !store.currentConcept" class="max-w-xl mx-auto text-center py-24">
            <div class="card p-8 border-red-200 bg-red-50/50">
              <p class="text-red-700 font-medium mb-1">Error loading data</p>
              <p class="text-sm text-red-600/80">{{ store.error }}</p>
            </div>
          </div>
          <router-view v-slot="{ Component }">
            <transition name="page" mode="out-in">
              <component :is="Component" :key="$route.fullPath" />
            </transition>
          </router-view>
        </template>
      </main>
    </div>
    <!-- Scroll-to-top -->
    <transition name="page">
      <button
        v-if="showScrollTop"
        @click="scrollToTop"
        aria-label="Scroll to top"
        class="fixed bottom-6 right-6 z-40 w-10 h-10 bg-surface-raised border border-ink-100 rounded-full flex items-center justify-center shadow-md hover:shadow-lg hover:bg-ink-50 transition-all"
      >
        <svg class="w-4 h-4 text-ink-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
      </button>
    </transition>
  </div>
</template>
