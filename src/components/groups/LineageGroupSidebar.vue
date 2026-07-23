<script setup lang="ts">
/**
 * LineageGroupSidebar — timeline-style entries for edition series.
 * Invoked via DatasetGroupRenderer dispatch when group.kind === 'lineage'.
 *
 * Slot `expanded` receives `{ entry, isCurrent }` per entry so callers
 * can render shared per-entry content (sub-pages, sections, etc.)
 * without touching this component.
 */
import { useRouter } from 'vue-router';

defineProps<{
  entries: Array<{
    id: string;
    title: string;
    ref?: string;
    loaded: boolean;
    conceptCount: number;
    year?: number;
    status?: string;
    isCurrent?: boolean;
  }>;
  currentDataset: string;
}>();

const router = useRouter();

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
      class="series-entry w-full text-left flex items-center gap-2 pl-6 pr-3 py-1.5 rounded-md text-sm border-l-2 transition-all duration-150"
      :class="currentDataset === ds.id
        ? 'bg-amber-50/70 dark:bg-amber-400/10 border-l-[3px] text-ink-900 dark:text-ink-50 font-semibold'
        : 'border-transparent text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-700/40 hover:text-ink-900 dark:hover:text-ink-50'"
      :style="currentDataset === ds.id ? { borderLeftColor: 'var(--gold-accent, #B8935A)' } : {}"
      @click="navigate(ds.id, currentDataset)"
    >
      <span class="flex-1 truncate text-[13.5px] font-medium leading-snug">{{ ds.ref || ds.title || ds.id }}</span>
      <span
        v-if="ds.status && ds.status !== 'valid'"
        class="text-[9px] uppercase tracking-wide italic text-ink-400 dark:text-ink-400"
      >{{ ds.status }}</span>
      <span
        v-if="ds.isCurrent"
        class="current-star flex-shrink-0"
        title="Current edition"
      >✦</span>
    </button>
    <slot name="expanded" :entry="ds" :is-current="currentDataset === ds.id" />
  </div>
</template>
