<script setup lang="ts">
/**
 * GroupView — overview page for a dataset group (lineage series,
 * topic bundle, family, collection). Renders authored about content
 * when available, otherwise generates from group metadata + members.
 *
 * Route: /group/:groupId
 */
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useSiteConfig } from '../config/use-site-config';
import { resolveGroupKind, groupTypeMeta } from '../config/group-types';
import { useVocabularyStore } from '../stores/vocabulary';

const route = useRoute();
const router = useRouter();
const { datasetGroups } = useSiteConfig();
const store = useVocabularyStore();

const groupId = computed(() => route.params.groupId as string);

const group = computed(() => {
  return datasetGroups.value?.find(g => g.id === groupId.value);
});

const groupKind = computed(() => group.value ? resolveGroupKind(group.value) : 'default');
const groupMeta = computed(() => group.value ? groupTypeMeta(group.value) : groupTypeMeta({}));

const loading = ref(true);
const aboutHtml = ref<string | null>(null);
const aboutTitle = ref<string>('');

async function fetchAbout() {
  loading.value = true;
  aboutHtml.value = null;

  const base = import.meta.env.BASE_URL;
  const candidates = [
    `${base}pages/group-${groupId.value}-about.json`,
  ];

  for (const url of candidates) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        aboutTitle.value = data.title || group.value?.label || groupId.value;
        aboutHtml.value = data.html;
        break;
      }
    } catch { /* try next */ }
  }

  loading.value = false;
}

onMounted(fetchAbout);
watch(groupId, fetchAbout);

const members = computed(() => {
  if (!group.value) return [];
  return group.value.datasets.map(id => {
    const m = store.manifests.get(id);
    return {
      id,
      title: m?.title ?? id,
      ref: m?.ref ?? id,
      conceptCount: m?.conceptCount ?? 0,
      loaded: !!m,
      status: m?.status ?? 'unknown',
      year: m?.ref ? parseInt(m.ref.match(/(\d{4})$/)?.[1] ?? '0', 10) || undefined : undefined,
    };
  }).sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
});

function openDataset(id: string) {
  router.push({ name: 'dataset', params: { registerId: id } });
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
      <router-link :to="{ name: 'home' }" class="hover:text-ink-700">Home</router-link>
      <span class="text-ink-200">/</span>
      <span class="text-ink-700">{{ group?.label ?? groupId }}</span>
    </nav>

    <template v-if="loading">
      <div class="animate-pulse space-y-4">
        <div class="h-8 bg-ink-100 rounded w-64"></div>
        <div class="card p-6"><div class="h-48 bg-ink-50 rounded"></div></div>
      </div>
    </template>

    <template v-else-if="group">
      <div class="flex items-baseline gap-3 mb-2">
        <span class="text-2xl">{{ groupMeta.glyph }}</span>
        <h1 class="font-title text-3xl text-ink-800 dark:text-ink-50">
          {{ group.label }}
        </h1>
      </div>
      <p v-if="group.description" class="text-ink-500 dark:text-ink-400 mb-6">{{ group.description }}</p>

      <div v-if="aboutHtml" class="card p-6 mb-6 prose-page" v-html="aboutHtml"></div>

      <h2 class="section-label mb-3">Members ({{ members.length }})</h2>
      <div class="space-y-2">
        <button
          v-for="m in members"
          :key="m.id"
          type="button"
          class="w-full text-left card p-4 flex items-center gap-4 hover:border-ink-300 transition-colors"
          @click="openDataset(m.id)"
        >
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">{{ m.title }}</div>
            <div v-if="m.loaded" class="text-xs text-ink-400 mt-0.5">
              {{ m.conceptCount.toLocaleString() }} concepts · {{ m.status }}
            </div>
          </div>
          <span v-if="m.year" class="font-mono text-sm text-ink-400 flex-shrink-0">{{ m.year }}</span>
        </button>
      </div>
    </template>

    <template v-else>
      <div class="card p-8 text-center">
        <h1 class="font-serif text-2xl text-ink-800 mb-2">Group not found</h1>
        <p class="text-ink-500 mb-4">No group with id "{{ groupId }}" is configured.</p>
        <router-link :to="{ name: 'home' }" class="btn-primary">Go home</router-link>
      </div>
    </template>
  </div>
</template>