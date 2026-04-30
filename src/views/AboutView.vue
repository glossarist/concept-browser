<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useDsStyle } from '../utils/dataset-style';
import { langName, langLabel } from '../utils/lang';

const props = defineProps<{ registerId: string }>();

const store = useVocabularyStore();
const { getColor } = useDsStyle();
const loading = ref(false);
const localError = ref<string | null>(null);

async function ensureLoaded() {
  if (store.manifests.has(props.registerId)) return;
  loading.value = true;
  localError.value = null;
  try {
    await store.loadDataset(props.registerId);
  } catch (e: any) {
    localError.value = e.message || 'Failed to load dataset';
  }
  loading.value = false;
}

onMounted(ensureLoaded);
watch(() => props.registerId, ensureLoaded);

const manifest = computed(() => store.manifests.get(props.registerId));
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Breadcrumb -->
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
      <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors">Home</router-link>
      <span class="text-ink-200">/</span>
      <router-link :to="{ name: 'dataset', params: { registerId } }" class="hover:text-ink-700 transition-colors">{{ manifest?.title || registerId }}</router-link>
      <span class="text-ink-200">/</span>
      <span class="text-ink-700">About</span>
    </nav>

    <template v-if="loading">
      <div class="animate-pulse space-y-6">
        <div class="h-8 bg-ink-100 rounded w-32"></div>
        <div class="card p-6"><div class="h-24 bg-ink-50 rounded"></div></div>
        <div class="card p-6"><div class="h-48 bg-ink-50 rounded"></div></div>
        <div class="card p-6"><div class="h-16 bg-ink-50 rounded"></div></div>
      </div>
    </template>
    <template v-else-if="localError">
      <div class="card p-8 border-red-200 bg-red-50/50 text-center">
        <p class="text-red-700 font-medium mb-1">Failed to load dataset info</p>
        <p class="text-sm text-red-600/80 mb-4">{{ localError }}</p>
        <button @click="ensureLoaded" class="btn-primary">Retry</button>
      </div>
    </template>
    <template v-else-if="manifest">
      <h1 class="font-serif text-3xl text-ink-800 mb-6">About</h1>

      <!-- Description -->
      <div class="card p-6 mb-6">
        <h2 class="section-label">Description</h2>
        <p class="text-ink-700 leading-relaxed mt-3">{{ manifest.description }}</p>
      </div>

      <!-- Key info -->
      <div class="card p-6 mb-6">
        <h2 class="section-label">Key Information</h2>
        <dl class="space-y-4 mt-3">
          <div class="flex items-start gap-4">
            <dt class="text-ink-400 text-sm w-32 flex-shrink-0 pt-0.5">Owner</dt>
            <dd class="text-ink-800 font-medium">{{ manifest.owner }}</dd>
          </div>
          <div class="flex items-start gap-4">
            <dt class="text-ink-400 text-sm w-32 flex-shrink-0 pt-0.5">Concepts</dt>
            <dd class="text-ink-800 font-mono">{{ manifest.conceptCount.toLocaleString() }}</dd>
          </div>
          <div class="flex items-start gap-4">
            <dt class="text-ink-400 text-sm w-32 flex-shrink-0 pt-0.5">Languages</dt>
            <dd class="text-ink-800">{{ manifest.languages.length }}</dd>
          </div>
          <div class="flex items-start gap-4">
            <dt class="text-ink-400 text-sm w-32 flex-shrink-0 pt-0.5">Last Updated</dt>
            <dd class="text-ink-800">{{ manifest.lastUpdated }}</dd>
          </div>
          <div class="flex items-start gap-4">
            <dt class="text-ink-400 text-sm w-32 flex-shrink-0 pt-0.5">Schema Version</dt>
            <dd class="text-ink-800 font-mono text-sm">{{ manifest.schemaVersion }}</dd>
          </div>
          <div v-if="manifest.sourceRepo" class="flex items-start gap-4">
            <dt class="text-ink-400 text-sm w-32 flex-shrink-0 pt-0.5">Source</dt>
            <dd>
              <a :href="manifest.sourceRepo" target="_blank" class="concept-link text-sm break-all">
                {{ manifest.sourceRepo.replace('https://github.com/', '') }}
              </a>
            </dd>
          </div>
          <div v-if="manifest.existingSiteUrl" class="flex items-start gap-4">
            <dt class="text-ink-400 text-sm w-32 flex-shrink-0 pt-0.5">Website</dt>
            <dd>
              <a :href="manifest.existingSiteUrl" target="_blank" class="concept-link text-sm">
                {{ manifest.existingSiteUrl.replace(/^https?:\/\//, '') }}
              </a>
            </dd>
          </div>
        </dl>
      </div>

      <!-- Languages -->
      <div class="card p-6 mb-6">
        <h2 class="section-label">Languages</h2>
        <div class="flex flex-wrap gap-2 mt-3">
          <div
            v-for="lang in manifest.languages"
            :key="lang"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-ink-50"
          >
            <span class="text-xs font-semibold text-ink-500 bg-ink-50 px-1.5 py-0.5 rounded">{{ langLabel(lang) }}</span>
            <span class="text-sm font-medium text-ink-700">{{ langName(lang) }}</span>
            <span class="text-xs text-ink-300">({{ lang }})</span>
          </div>
        </div>
      </div>

      <!-- Tags -->
      <div v-if="manifest.tags?.length" class="card p-6">
        <h2 class="section-label">Tags</h2>
        <div class="flex flex-wrap gap-2 mt-3">
          <span
            v-for="tag in manifest.tags"
            :key="tag"
            class="badge"
            :style="{
              backgroundColor: getColor(registerId) + '15',
              color: getColor(registerId),
            }"
          >
            {{ tag }}
          </span>
        </div>
      </div>
    </template>
  </div>
</template>
