<script setup lang="ts">
/**
 * DefaultGroupSidebar — flat list of dataset entries with expansion.
 * Used for topic, family, collection, and default group kinds.
 * Replaces the inline v-else template in AppSidebar.
 */
import { useRouter } from 'vue-router';
import { useI18n } from '../../i18n';

const props = defineProps<{
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

function navigate(id: string) {
  if (id === props.currentDataset) return;
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
      class="w-full text-left px-3 py-2 rounded-lg text-sm border-l-2"
      :class="currentDataset === ds.id
        ? 'text-ink-800 dark:text-ink-50'
        : 'border-transparent text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-700 hover:text-ink-800 dark:hover:text-ink-50'"
      @click="navigate(ds.id)"
    >
      <div class="font-medium truncate leading-snug">{{ ds.title }}</div>
      <div v-if="ds.loaded" class="text-xs mt-0.5 text-ink-300 dark:text-ink-400">
        {{ ds.conceptCount.toLocaleString() }} {{ t('home.concepts').toLowerCase() }}
      </div>
    </button>
  </div>
</template>