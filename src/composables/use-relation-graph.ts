/**
 * useRelationGraph — loads relation-graph.json for a register (issue #259).
 *
 * Mirrors use-dataset-stats.ts: single fetch of the build-time wire
 * file, exposed as a ref. The file is emitted by scripts/build-edges.ts;
 * a 404 means the register has no concept-to-concept relations and the
 * UI renders its empty state (not an error).
 */
import { ref, watch, type Ref } from 'vue';
import type { RelationGraphWire } from '../utils/relation-graph';

export function useRelationGraph(
  registerId: Ref<string> | (() => string),
  baseUrl: string = import.meta.env.BASE_URL,
) {
  const graph = ref<RelationGraphWire | null>(null);
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
      const resp = await fetch(`${baseUrl}data/${id}/relation-graph.json`);
      if (resp.status === 404) {
        graph.value = null;
        missing.value = true;
      } else if (resp.ok) {
        graph.value = await resp.json() as RelationGraphWire;
      } else {
        graph.value = null;
        error.value = `HTTP ${resp.status}`;
      }
    } catch (e: unknown) {
      graph.value = null;
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

  return { graph, loading, missing, error, reload };
}
