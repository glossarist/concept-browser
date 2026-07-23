<script setup lang="ts">
/**
 * DefaultGroupSidebar — flat list of dataset entries with expansion slot.
 * Used for topic, family, collection, and default group kinds.
 * Invoked via DatasetGroupRenderer dispatch (OCP).
 *
 * Slot `expanded` receives `{ entry, isCurrent }` per entry so callers
 * can render shared per-entry content (sub-pages, sections, etc.)
 * without touching this component.
 */
import { useRouter } from 'vue-router';
import { useI18n } from '../../i18n';
import { useDsStyle } from '../../utils/dataset-style';
import { useSiteConfig } from '../../config/use-site-config';

defineProps<{
  entries: Array<{
    id: string;
    title: string;
    loaded: boolean;
    conceptCount: number;
  }>;
  currentDataset: string;
}>();

const router = useRouter();
const { t } = useI18n();
const { getColor } = useDsStyle();
const { localizedDatasetField } = useSiteConfig();

function navigate(id: string, current: string) {
  if (id === current) return;
  router.push({ name: 'dataset', params: { registerId: id } });
}
</script>

<template>
  <div
    v-for="ds in entries"
    :key="ds.id"
    class="rounded-lg transition-all duration-150"
    :class="currentDataset === ds.id ? 'bg-surface' : ''"
  >
    <button
      type="button"
      class="w-full text-left px-3 py-2 rounded-lg text-sm border-l-2 flex items-start gap-2"
      :class="currentDataset === ds.id
        ? 'text-ink-800 dark:text-ink-50'
        : 'border-transparent text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-700 hover:text-ink-800 dark:hover:text-ink-50'"
      :style="{ borderLeftColor: currentDataset === ds.id ? getColor(ds.id) : 'transparent' }"
      @click="navigate(ds.id, currentDataset)"
    >
      <span class="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" :style="{ backgroundColor: getColor(ds.id) }"></span>
      <div class="min-w-0 flex-1">
        <div class="font-medium truncate leading-snug">{{ localizedDatasetField(ds.id, 'title', ds.title) }}</div>
        <div
          v-if="ds.loaded"
          class="text-xs mt-0.5"
          :class="currentDataset === ds.id ? 'text-ink-400 dark:text-ink-300' : 'text-ink-300 dark:text-ink-400'"
        >
          {{ ds.conceptCount.toLocaleString() }} {{ t('home.concepts').toLowerCase() }}
        </div>
      </div>
    </button>
    <slot name="expanded" :entry="ds" :is-current="currentDataset === ds.id" />
  </div>
</template>
