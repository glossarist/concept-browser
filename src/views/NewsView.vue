<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useSiteConfig } from '../config/use-site-config';

interface NewsPost {
  slug: string;
  title: string;
  date: string;
  categories: string[];
  excerpt: string;
}

const { config } = useSiteConfig();
const posts = ref<NewsPost[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
  try {
    const resp = await fetch('/news.json');
    if (resp.ok) {
      posts.value = await resp.json();
    }
  } catch (e: any) {
    error.value = e.message;
  }
  loading.value = false;
});

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <h1 class="font-serif text-3xl text-ink-800 mb-2">News</h1>
    <p class="text-ink-400 mb-8">
      Updates from {{ config?.branding?.ownerName || config?.title || 'Glossarist' }}.
    </p>

    <template v-if="loading">
      <div class="animate-pulse space-y-6">
        <div v-for="i in 3" :key="i" class="card p-6 space-y-3">
          <div class="h-3 bg-ink-100 rounded w-24"></div>
          <div class="h-6 bg-ink-100 rounded w-3/4"></div>
          <div class="h-4 bg-ink-100 rounded w-full"></div>
        </div>
      </div>
    </template>

    <template v-else-if="error">
      <div class="card p-8 text-center">
        <p class="text-ink-500">Failed to load news posts.</p>
      </div>
    </template>

    <template v-else-if="posts.length === 0">
      <div class="card p-8 text-center">
        <p class="text-ink-500">No news posts yet.</p>
      </div>
    </template>

    <template v-else>
      <div class="space-y-6">
        <article v-for="post in posts" :key="post.slug" class="card p-6">
          <div class="flex items-center gap-3 text-xs text-ink-400 mb-2">
            <time :datetime="post.date">{{ formatDate(post.date) }}</time>
            <span v-if="post.categories.length" class="flex gap-1">
              <span
                v-for="cat in post.categories"
                :key="cat"
                class="bg-ink-50 text-ink-500 px-1.5 py-0.5 rounded"
              >{{ cat }}</span>
            </span>
          </div>
          <h2 class="font-serif text-xl text-ink-800 mb-2">{{ post.title }}</h2>
          <p v-if="post.excerpt" class="text-ink-500 text-sm leading-relaxed">{{ post.excerpt }}</p>
        </article>
      </div>
    </template>
  </div>
</template>
