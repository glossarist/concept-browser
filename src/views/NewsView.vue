<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSiteConfig } from '../config/use-site-config';
import { renderAsciiDocLite } from '../utils/asciidoc-lite';

interface NewsPost {
  slug: string;
  title: string;
  date: string;
  categories: string[];
  file: string;
  excerpt: string;
}

const { config } = useSiteConfig();
const posts = ref<NewsPost[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

const activeSlug = ref<string | null>(null);
const activeHtml = ref('');
const activeLoading = ref(false);

onMounted(async () => {
  try {
    const resp = await fetch('/news.json');
    if (resp.ok) posts.value = await resp.json();
  } catch (e: any) {
    error.value = e.message;
  }
  loading.value = false;
});

async function openPost(post: NewsPost) {
  if (activeSlug.value === post.slug) {
    activeSlug.value = null;
    activeHtml.value = '';
    return;
  }
  activeSlug.value = post.slug;
  activeLoading.value = true;
  try {
    const resp = await fetch(post.file);
    if (resp.ok) {
      const text = await resp.text();
      const body = stripFrontmatter(text);
      activeHtml.value = renderAsciiDocLite(body);
    }
  } catch { /* ignore */ }
  activeLoading.value = false;
}

function stripFrontmatter(text: string): string {
  const lines = text.split('\n');
  if (lines[0] !== '---') return text;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === '---') { end = i; break; }
  }
  if (end < 0) return text;
  return lines.slice(end + 1).join('\n').trim();
}

function formatDate(dateStr: string) {
  if (!dateStr) return '';
  try {
    // Handle Jekyll-style dates: "2024-06-19 00:00:00 +0800"
    const normalized = dateStr
      .replace(/^(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})\s+([+-]\d{2})(\d{2})$/, '$1T$2$3:$4')
      .replace(/^(\d{4}-\d{2}-\d{2})\s+([+-]\d{2})(\d{2})$/, '$1T00:00:00$2:$3');
    return new Date(normalized).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
      <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors">Home</router-link>
      <span class="text-ink-200">/</span>
      <span class="text-ink-700">News</span>
    </nav>
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
      <div class="space-y-4">
        <article v-for="post in posts" :key="post.slug">
          <button
            @click="openPost(post)"
            class="w-full text-left card p-6 hover:bg-surface-alt/50 transition-colors"
            :class="activeSlug === post.slug ? 'ring-1 ring-ink-200' : ''"
          >
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
            <div class="flex items-start justify-between gap-3">
              <h2 class="font-serif text-xl text-ink-800">{{ post.title }}</h2>
              <svg
                class="w-5 h-5 text-ink-300 flex-shrink-0 mt-1 transition-transform"
                :class="activeSlug === post.slug ? 'rotate-180' : ''"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              ><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 9l-7 7-7-7"/></svg>
            </div>
            <p v-if="activeSlug !== post.slug && post.excerpt" class="text-ink-500 text-sm mt-2 leading-relaxed">{{ post.excerpt }}</p>
          </button>

          <div v-if="activeSlug === post.slug" class="card rounded-t-none -mt-1 p-6 pt-3 border-t border-ink-100/40">
            <div v-if="activeLoading" class="animate-pulse space-y-2">
              <div class="h-4 bg-ink-100 rounded w-full"></div>
              <div class="h-4 bg-ink-100 rounded w-5/6"></div>
              <div class="h-4 bg-ink-100 rounded w-4/6"></div>
            </div>
            <div v-else class="prose-news" v-html="activeHtml"></div>
          </div>
        </article>
      </div>
    </template>
  </div>
</template>
