/**
 * useNavigation — loads navigation.json for a dataset register
 * (issue #261). Mirrors use-curation-queues.ts: one static fetch of the
 * build-time tree/facet file, exposed as a ref. A 404 means the register
 * was built by an older generator without navigation data — surfaced as
 * `missing` so the UI can show a hint instead of an error.
 */
import { ref, watch, type Ref } from 'vue';
import type { DatasetNavigation } from '../adapters/navigation-index';

export function useNavigation(
  registerId: Ref<string> | (() => string),
  baseUrl: string = import.meta.env.BASE_URL,
) {
  const navigation = ref<DatasetNavigation | null>(null);
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
      const resp = await fetch(`${baseUrl}data/${id}/navigation.json`);
      if (resp.status === 404) {
        navigation.value = null;
        missing.value = true;
      } else if (resp.ok) {
        navigation.value = await resp.json() as DatasetNavigation;
      } else {
        navigation.value = null;
        error.value = `HTTP ${resp.status}`;
      }
    } catch (e: unknown) {
      navigation.value = null;
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

  return { navigation, loading, missing, error, reload };
}
