<script setup lang="ts">
/**
 * LineageGroupSidebar — timeline-style entries for edition series.
 * Replaces the inline v-if="group.kind === 'lineage'" template in
 * AppSidebar. Open/closed: new group kinds get their own component.
 */
import { useRouter } from 'vue-router';

const props = defineProps<{
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

function navigate(id: string) {
  if (id === props.currentDataset) return;
  router.push({ name: 'dataset', params: { registerId: id } });
}
</script>

<template>
  <div class="series-timeline">
    <button
      v-for="ds in entries"
      :key="ds.id"
      type="button"
      class="series-entry w-full text-left flex items-center gap-2 pl-6 pr-3 py-1.5 rounded-md text-sm border-l-2 transition-all duration-150"
      :class="currentDataset === ds.id
        ? 'bg-amber-50/70 dark:bg-amber-400/10 border-l-[3px] text-ink-900 dark:text-ink-50 font-semibold'
        : 'border-transparent text-ink-600 dark:text-ink-300 hover:bg-ink-50 dark:hover:bg-ink-700/40 hover:text-ink-900 dark:hover:text-ink-50'"
      :style="currentDataset === ds.id ? { borderLeftColor: 'var(--group-kind-lineage-light, #B8935A)' } : {}"
      @click="navigate(ds.id)"
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
  </div>
</template>

<style scoped>
.series-entry {
  position: relative;
}
.current-star {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  line-height: 1;
  color: var(--group-kind-lineage-light, #B8935A);
  filter: drop-shadow(0 0 4px rgba(184, 147, 90, 0.45));
}
:global(.dark) .current-star {
  color: var(--group-kind-lineage-dark, #D4AF6E);
  filter: drop-shadow(0 0 4px rgba(212, 175, 110, 0.55));
}
</style>