/**
 * useCurationQueues — loads curation.json for a dataset register
 * (issue #260). Mirrors use-dataset-stats.ts: one static fetch of the
 * build-time worklist file, exposed as a ref. A 404 means the register
 * was built by an older generator without curation data — surfaced as
 * `missing` so the UI can show a hint instead of an error.
 */
import { ref, watch, type Ref } from 'vue';
import type { DatasetCuration } from '../adapters/curation-queues';

export function useCurationQueues(
  registerId: Ref<string> | (() => string),
  baseUrl: string = import.meta.env.BASE_URL,
) {
  const curation = ref<DatasetCuration | null>(null);
  const loading = ref(false);
  const missing = ref(false);
  const error = ref<string | null>(null);

  const resolved = typeof registerId === 'function' ? registerId() : registerId.value;

  async function load(id: string) {
    if (!id) return;
    loading.value = true;
    missing.value = false;
    error.value = null;
    try {
      const resp = await fetch(`${baseUrl}data/${id}/curation.json`);
      if (resp.status === 404) {
        curation.value = null;
        missing.value = true;
      } else if (resp.ok) {
        curation.value = await resp.json() as DatasetCuration;
      } else {
        curation.value = null;
        error.value = `HTTP ${resp.status}`;
      }
    } catch (e: unknown) {
      curation.value = null;
      error.value = e instanceof Error ? e.message : String(e);
    } finally {
      loading.value = false;
    }
  }

  if (typeof registerId === 'function') {
    load(resolved);
  } else {
    watch(registerId, id => load(id), { immediate: true });
  }

  function reload() {
    const id = typeof registerId === 'function' ? registerId() : registerId.value;
    load(id);
  }

  return { curation, loading, missing, error, reload };
}
