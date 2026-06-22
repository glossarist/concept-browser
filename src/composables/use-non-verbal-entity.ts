/**
 * useNonVerbalEntity — composable that fetches one non-verbal entity
 * through the resolver and tracks loading / not-found / error state.
 *
 * Components call this; they never touch `fetch()` directly. Locale is
 * reactive — changing it does NOT refetch (the resolver caches the raw
 * JSON-LD; localization happens at render time via the locale SSOT).
 */
import { ref, watch, shallowRef } from 'vue';
import { getFactory } from '../adapters/factory';
import type { NonVerbalKind } from '../adapters/non-verbal/types';
import type { NonVerbalEntity } from 'glossarist';

export type LoadState = 'loading' | 'loaded' | 'not-found' | 'error';

export interface UseNonVerbalEntityOptions {
  immediate?: boolean;
}

export function useNonVerbalEntity(
  kind: () => NonVerbalKind,
  datasetId: () => string,
  entityId: () => string,
  _opts: UseNonVerbalEntityOptions = {},
) {
  const entity = shallowRef<NonVerbalEntity | null>(null);
  const state = ref<LoadState>('loading');
  const error = ref<string | null>(null);

  async function load() {
    const k = kind();
    const ds = datasetId();
    const id = entityId();
    if (!k || !ds || !id) {
      state.value = 'not-found';
      entity.value = null;
      return;
    }
    state.value = 'loading';
    error.value = null;
    try {
      const e = await getFactory().nonVerbalResolver.resolve(k, ds, id);
      entity.value = e;
      state.value = e ? 'loaded' : 'not-found';
    } catch (err) {
      state.value = 'error';
      error.value = err instanceof Error ? err.message : String(err);
      entity.value = null;
    }
  }

  watch(
    [kind, datasetId, entityId],
    () => { void load(); },
    { immediate: true },
  );

  return { entity, state, error, reload: load };
}
