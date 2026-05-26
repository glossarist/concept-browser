<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { getFactory } from '../adapters/factory';
import { useVocabularyStore } from '../stores/vocabulary';

const route = useRoute();
const router = useRouter();
const store = useVocabularyStore();

const error = ref<string | null>(null);
const uri = ref('');

onMounted(async () => {
  uri.value = decodeURIComponent(route.params.uri as string);
  const factory = getFactory();

  if (!factory.getAdapters().length) {
    try {
      await store.discoverDatasets();
    } catch {
      error.value = 'Failed to load datasets.';
      return;
    }
  }

  const resolution = factory.resolve(uri.value);

  if (resolution.type === 'internal') {
    if (!store.datasets.has(resolution.registerId)) {
      try {
        await store.loadDataset(resolution.registerId);
      } catch {
        error.value = `Failed to load dataset: ${resolution.registerId}`;
        return;
      }
    }
    router.replace({ name: 'concept', params: { registerId: resolution.registerId, conceptId: resolution.conceptId } });
  } else if (resolution.type === 'site') {
    window.location.href = `${resolution.baseUrl}/resolve/${encodeURIComponent(uri.value)}`;
  } else if (resolution.type === 'url') {
    window.location.href = resolution.url;
  } else {
    error.value = 'Concept not found';
  }
});
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 py-16 text-center">
    <template v-if="error">
      <h1 class="text-2xl font-serif text-ink-800 mb-4">Concept not found</h1>
      <p class="text-ink-500 mb-2">The following concept URI could not be resolved:</p>
      <code class="text-sm text-ink-600 break-all bg-ink-50 px-3 py-2 rounded">{{ uri }}</code>
      <div class="mt-8">
        <router-link :to="{ name: 'home' }" class="concept-link">Return to home</router-link>
      </div>
    </template>
    <template v-else>
      <p class="text-ink-400">Resolving...</p>
    </template>
  </div>
</template>
