<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';

interface PageData {
  title: string;
  html: string;
}

const route = useRoute();
const slug = computed(() => {
  if (route.params.slug) return route.params.slug as string;
  if (route.params.page) return route.params.page as string;
  if (route.name === 'about' || route.name === 'about-global') return 'about';
  const path = route.path.replace(/^\//, '').replace(/\/$/, '');
  const lastSegment = path.split('/').pop() || '';
  return lastSegment;
});
const data = ref<PageData | null>(null);
const loading = ref(true);
const notFound = ref(false);

onMounted(async () => {
  try {
    const resp = await fetch(`/pages/${slug.value}.json`);
    if (resp.ok) {
      data.value = await resp.json();
    } else {
      notFound.value = true;
    }
  } catch {
    notFound.value = true;
  }
  loading.value = false;
});
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
      <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors">Home</router-link>
      <span class="text-ink-200">/</span>
      <span class="text-ink-700">{{ data?.title || slug }}</span>
    </nav>

    <template v-if="loading">
      <div class="animate-pulse space-y-6">
        <div class="h-8 bg-ink-100 rounded w-48"></div>
        <div class="h-4 bg-ink-100 rounded w-full"></div>
        <div class="h-4 bg-ink-100 rounded w-5/6"></div>
        <div class="h-4 bg-ink-100 rounded w-4/6"></div>
      </div>
    </template>

    <template v-else-if="notFound">
      <div class="card p-8 text-center">
        <h1 class="font-serif text-2xl text-ink-800 mb-2">Page Not Found</h1>
        <p class="text-ink-500 mb-4">The page "{{ slug }}" does not exist.</p>
        <router-link :to="{ name: 'home' }" class="btn-primary">Go Home</router-link>
      </div>
    </template>

    <template v-else-if="data">
      <h1 class="font-serif text-3xl text-ink-800 mb-6">{{ data.title }}</h1>
      <div class="prose-page" v-html="data.html"></div>
    </template>
  </div>
</template>
