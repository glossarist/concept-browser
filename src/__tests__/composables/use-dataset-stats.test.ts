import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, nextTick } from 'vue';
import { useDatasetStats } from '../../composables/use-dataset-stats';

const okResponse = (body: unknown) => ({
  ok: true,
  json: async () => body,
});
const notFoundResponse = () => ({ ok: false, json: async () => null });

describe('useDatasetStats', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('starts with null stats', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(okResponse(null) as any);
    const { stats, loading } = useDatasetStats(() => 'reg-1', '/');
    expect(stats.value).toBeNull();
    await nextTick();
    await nextTick();
    await nextTick();
    expect(loading.value).toBe(false);
  });

  it('loads stats.json for the resolved registerId', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse({
        sourceCount: 5,
        sources: [],
        relationshipCount: 12,
        relationshipTypes: { supersedes: 3 },
      }) as any,
    );
    const { stats } = useDatasetStats(() => 'reg-1', '/');
    await nextTick();
    await nextTick();
    expect(fetchMock).toHaveBeenCalledWith('/data/reg-1/stats.json');
    expect(stats.value?.sourceCount).toBe(5);
    expect(stats.value?.relationshipCount).toBe(12);
  });

  it('handles 404 gracefully (stats stays null)', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(notFoundResponse() as any);
    const { stats, error } = useDatasetStats(() => 'reg-1', '/');
    await nextTick();
    await nextTick();
    expect(stats.value).toBeNull();
    expect(error.value).toBeNull();
  });

  it('handles network errors and exposes error message', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('network down'));
    const { stats, error } = useDatasetStats(() => 'reg-1', '/');
    await nextTick();
    await nextTick();
    await nextTick();
    expect(stats.value).toBeNull();
    expect(error.value).toBe('network down');
  });

  it('reacts to registerId change (Ref form)', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse({ sourceCount: 1, sources: [], relationshipCount: 0, relationshipTypes: {} }) as any,
    );
    const registerId = ref('reg-a');
    useDatasetStats(registerId, '/');
    await nextTick();
    expect(fetchMock).toHaveBeenLastCalledWith('/data/reg-a/stats.json');

    registerId.value = 'reg-b';
    await nextTick();
    await nextTick();
    expect(fetchMock).toHaveBeenLastCalledWith('/data/reg-b/stats.json');
  });

  it('reload() re-fetches the same id', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      okResponse({ sourceCount: 7, sources: [], relationshipCount: 0, relationshipTypes: {} }) as any,
    );
    const { reload } = useDatasetStats(() => 'reg-1', '/');
    await nextTick();
    await nextTick();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    reload();
    await nextTick();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
