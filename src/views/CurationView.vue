<script setup lang="ts">
/**
 * CurationView — register-level data-quality worklists (issue #260).
 *
 * Renders the three curation queues emitted at build time
 * ({register}/curation.json): validation failures, missing
 * translations per configured language, entries without sources.
 * Every item deep-links to its concept page. Client-side filter across
 * designation and id; per-queue incremental reveal keeps large
 * registers (10k+ items) out of DOM trouble.
 */
import { computed, ref } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useDatasetLoader } from '../composables/use-dataset-loader';
import { useCurationQueues } from '../composables/use-curation-queues';
import { langLabel, langName } from '../utils/lang';
import { useI18n } from '../i18n';
import type { CurationQueue } from '../adapters/curation-queues';

const props = defineProps<{ registerId?: string }>();

const store = useVocabularyStore();
const { loading, localError, ensureLoaded, resolvedId } = useDatasetLoader(() => props.registerId);
const { curation, missing, error: curationError, reload: reloadCuration } = useCurationQueues(resolvedId);
const { t } = useI18n();

const manifest = computed(() => store.manifests.get(resolvedId.value));

const filterText = ref('');

function matches(item: { id: string; designation?: string }): boolean {
  const q = filterText.value.trim().toLowerCase();
  if (!q) return true;
  return item.id.toLowerCase().includes(q) || (item.designation ?? '').toLowerCase().includes(q);
}

const validationQueue = computed(() => curation.value?.validation);
const missingQueue = computed(() => curation.value?.missingTranslations);
const noSourcesQueue = computed(() => curation.value?.noSources);

function filtered(queue: CurationQueue | undefined): CurationQueue['items'] {
  if (!queue) return [];
  return queue.items.filter(matches);
}

// Incremental reveal: large registers can carry thousands of queue
// items; render the first PAGE and grow on demand.
const PAGE = 100;
const revealed = ref<Record<string, number>>({});
function visible(queueKey: string, items: CurationQueue['items']): CurationQueue['items'] {
  const n = revealed.value[queueKey] ?? PAGE;
  return items.slice(0, n);
}
function revealMore(queueKey: string) {
  const n = revealed.value[queueKey] ?? PAGE;
  revealed.value = { ...revealed.value, [queueKey]: n + PAGE };
}

async function reloadAll() {
  await ensureLoaded();
  reloadCuration();
}
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <nav aria-label="Breadcrumb" class="flex items-center gap-1.5 text-sm text-ink-400 mb-6">
      <router-link :to="{ name: 'home' }" class="hover:text-ink-700 transition-colors">{{ t('nav.home') }}</router-link>
      <span class="text-ink-200">/</span>
      <router-link :to="{ name: 'dataset', params: { registerId: resolvedId } }" class="hover:text-ink-700 transition-colors">{{ manifest?.title || resolvedId }}</router-link>
      <span class="text-ink-200">/</span>
      <span class="text-ink-700">{{ t('curation.title') }}</span>
    </nav>

    <template v-if="loading">
      <div class="animate-pulse space-y-6">
        <div class="h-8 bg-ink-100 rounded w-40"></div>
        <div class="h-4 bg-ink-100 rounded w-72"></div>
        <div class="card overflow-hidden"><div class="h-40 bg-ink-50"></div></div>
      </div>
    </template>
    <template v-else-if="localError">
      <div class="card p-8 border-red-200 bg-red-50/50 text-center">
        <p class="text-red-700 font-medium mb-1">{{ t('curation.failedToLoad') }}</p>
        <p class="text-sm text-red-600/80 mb-4">{{ localError }}</p>
        <button @click="reloadAll" class="btn-primary">{{ t('curation.retry') }}</button>
      </div>
    </template>
    <template v-else-if="manifest">
      <h1 class="font-serif text-3xl text-ink-800 mb-2">{{ t('curation.title') }}</h1>
      <p class="text-ink-400 mb-4">{{ t('curation.summary', { title: manifest.title }) }}</p>

      <div v-if="curation" class="flex flex-wrap gap-2 mb-4">
        <span class="badge badge-gray">{{ curation.conceptCount.toLocaleString() }} {{ t('dataset.concepts') }}</span>
        <span class="badge badge-gray">{{ curation.languages.length }} {{ t('dataset.languages') }}</span>
        <router-link :to="{ name: 'stats', params: { registerId: resolvedId } }" class="text-xs text-blue-600 hover:underline self-center">
          {{ t('nav.stats') }} →
        </router-link>
      </div>

      <div v-if="curation" class="mb-6">
        <label class="sr-only" for="curation-filter">{{ t('curation.filter') }}</label>
        <input
          id="curation-filter"
          v-model="filterText"
          type="search"
          :placeholder="t('curation.filter')"
          class="w-full max-w-md px-3 py-2 text-sm rounded-lg border border-ink-100 dark:border-ink-700 bg-surface-raised dark:bg-ink-800 text-ink-800 dark:text-ink-100 placeholder:text-ink-300 focus:outline-none focus:ring-2 focus:ring-blue-400/40"
        />
      </div>

      <div v-if="!curation && missing" class="card p-8 text-center">
        <p class="text-ink-500 dark:text-ink-300 text-sm">{{ t('curation.noData') }}</p>
      </div>
      <div v-else-if="!curation && curationError" class="card p-8 border-red-200 bg-red-50/50 text-center">
        <p class="text-red-700 font-medium mb-1 text-sm">{{ t('curation.loadFailed') }} {{ curationError }}</p>
        <button @click="reloadCuration" class="btn-primary mt-3">{{ t('curation.retry') }}</button>
      </div>

      <div v-if="curation" class="space-y-8">
        <!-- Validation failures -->
        <section aria-labelledby="curation-validation">
          <div class="flex items-center gap-3 mb-3">
            <h2 id="curation-validation" class="section-label mb-0">{{ t('curation.validation.title') }}</h2>
            <span class="badge" :class="filtered(validationQueue).length ? 'badge bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300' : 'badge-green'" data-testid="queue-count-validation">
              {{ validationQueue?.count ?? 0 }}
            </span>
          </div>
          <div v-if="filtered(validationQueue).length === 0" class="card p-4 text-sm text-ink-500 dark:text-ink-300">
            {{ t('curation.validation.allClear') }}
          </div>
          <ul v-else class="card divide-y divide-ink-50 dark:divide-ink-700/60">
            <li v-for="item in visible('validation', filtered(validationQueue))" :key="item.id">
              <router-link
                :to="{ name: 'concept', params: { registerId: resolvedId, conceptId: item.id } }"
                class="flex items-baseline gap-3 px-4 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
              >
                <span class="text-sm font-medium text-ink-800 dark:text-ink-100">{{ item.designation || item.id }}</span>
                <span class="text-xs text-ink-300 dark:text-ink-400 font-mono">{{ item.id }}</span>
                <span v-if="item.reason" class="ml-auto text-xs text-red-600 dark:text-red-400 text-right">{{ item.reason }}</span>
              </router-link>
            </li>
          </ul>
        </section>

        <!-- Missing translations -->
        <section aria-labelledby="curation-missing">
          <div class="flex items-center gap-3 mb-3">
            <h2 id="curation-missing" class="section-label mb-0">{{ t('curation.missing.title') }}</h2>
            <span class="badge" :class="filtered(missingQueue).length ? 'badge-yellow' : 'badge-green'" data-testid="queue-count-missing">
              {{ missingQueue?.count ?? 0 }}
            </span>
          </div>
          <div v-if="filtered(missingQueue).length === 0" class="card p-4 text-sm text-ink-500 dark:text-ink-300">
            {{ t('curation.missing.allClear') }}
          </div>
          <ul v-else class="card divide-y divide-ink-50 dark:divide-ink-700/60">
            <li v-for="item in visible('missing', filtered(missingQueue))" :key="item.id">
              <router-link
                :to="{ name: 'concept', params: { registerId: resolvedId, conceptId: item.id } }"
                class="flex items-center gap-3 px-4 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors flex-wrap"
              >
                <span class="text-sm font-medium text-ink-800 dark:text-ink-100">{{ item.designation || item.id }}</span>
                <span class="text-xs text-ink-300 dark:text-ink-400 font-mono">{{ item.id }}</span>
                <span class="ml-auto flex gap-1">
                  <span
                    v-for="lang in item.missing ?? []"
                    :key="lang"
                    class="badge badge-yellow text-[10px]"
                    :title="t('curation.missing.missingLang', { lang: langName(lang) })"
                  >{{ langLabel(lang) }}</span>
                </span>
              </router-link>
            </li>
          </ul>
        </section>

        <!-- Without sources -->
        <section aria-labelledby="curation-nosources">
          <div class="flex items-center gap-3 mb-3">
            <h2 id="curation-nosources" class="section-label mb-0">{{ t('curation.noSources.title') }}</h2>
            <span class="badge" :class="filtered(noSourcesQueue).length ? 'badge-gray' : 'badge-green'" data-testid="queue-count-nosources">
              {{ noSourcesQueue?.count ?? 0 }}
            </span>
          </div>
          <div v-if="filtered(noSourcesQueue).length === 0" class="card p-4 text-sm text-ink-500 dark:text-ink-300">
            {{ t('curation.noSources.allClear') }}
          </div>
          <ul v-else class="card divide-y divide-ink-50 dark:divide-ink-700/60">
            <li v-for="item in visible('noSources', filtered(noSourcesQueue))" :key="item.id">
              <router-link
                :to="{ name: 'concept', params: { registerId: resolvedId, conceptId: item.id } }"
                class="flex items-baseline gap-3 px-4 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-800 transition-colors"
              >
                <span class="text-sm font-medium text-ink-800 dark:text-ink-100">{{ item.designation || item.id }}</span>
                <span class="text-xs text-ink-300 dark:text-ink-400 font-mono">{{ item.id }}</span>
              </router-link>
            </li>
          </ul>
        </section>

        <!-- Reveal-more controls -->
        <template v-for="q in [
          { key: 'validation', queue: validationQueue },
          { key: 'missing', queue: missingQueue },
          { key: 'noSources', queue: noSourcesQueue },
        ]" :key="q.key">
          <div v-if="q.queue && filtered(q.queue).length > (revealed[q.key] ?? PAGE)" class="text-center">
            <button class="btn-secondary text-sm" @click="revealMore(q.key)">
              {{ t('curation.showMore', { count: String(Math.min(PAGE, filtered(q.queue).length - (revealed[q.key] ?? PAGE))) }) }}
            </button>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
