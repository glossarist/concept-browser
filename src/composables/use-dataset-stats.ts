/**
 * useDatasetStats — loads stats.json for a dataset register.
 *
 * Single source of truth for the DatasetStats wire shape; both
 * DatasetView (summary badges) and StatsView (full table) consume it.
 */
import { ref, watch, type Ref } from 'vue';
import type { DatasetStats } from '../adapters/dataset-stats';

export function useDatasetStats(
  registerId: Ref<string> | (() => string),
  baseUrl: string = import.meta.env.BASE_URL,
) {
  const stats = ref<DatasetStats | null>(null);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const resolved = typeof registerId === 'function' ? registerId() : registerId.value;

  async function load(id: string) {
    if (!id) return;
    loading.value = true;
    error.value = null;
    try {
      const resp = await fetch(`${baseUrl}data/${id}/stats.json`);
      if (resp.ok) {
        stats.value = await resp.json() as DatasetStats;
      } else {
        stats.value = null;
      }
    } catch (e: unknown) {
      stats.value = null;
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  if (typeof registerId === 'function') {
    // Re-fetch on app boot only; callers can call reload() to refresh.
    load(resolved);
  } else {
    watch(registerId, id => load(id), { immediate: true });
  }

  function reload() {
    const id = typeof registerId === 'function' ? registerId() : registerId.value;
    load(id);
  }

  return { stats, loading, error, reload };
}
