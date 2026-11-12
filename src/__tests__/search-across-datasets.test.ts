import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useVocabularyStore } from '../stores/vocabulary';
import type { DatasetAdapter } from '../adapters/DatasetAdapter';
import type { Manifest, SearchHit } from '../adapters/types';

const discoverDatasets = vi.fn();
vi.mock('../adapters/factory', () => ({
  getFactory: () => ({ discoverDatasets, getAdapters: () => [], loadDataset: vi.fn() }),
}));

function adapter(registerId: string, indexRows: SearchHit[], laterRows: SearchHit[] = [], options: { failLoad?: boolean; manifest?: boolean } = {}) {
  const index = { concepts: [...indexRows] };
  const search = vi.fn((query: string) => index.concepts
    .filter((row) => row.designation.toLowerCase().includes(query.toLowerCase())));
  const ensureAllChunksLoaded = vi.fn(async () => {
    await Promise.resolve();
    if (options.failLoad) throw new Error('chunk unavailable');
    index.concepts.push(...laterRows);
  });
  return {
    adapter: {
      registerId,
      manifest: options.manifest === false ? null : { id: registerId } as Manifest,
      index,
      loadIndex: vi.fn(async () => undefined),
      search,
      ensureAllChunksLoaded,
    } as unknown as DatasetAdapter,
    search,
    ensureAllChunksLoaded,
  };
}

const hit = (registerId: string, conceptId: string, designation: string, status = 'valid'): SearchHit => ({
  registerId, conceptId, designation, status, language: 'eng', matchField: 'designation',
});

describe('searchAcrossDatasets', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    discoverDatasets.mockReset();
  });

  it('returns both location concepts on first and repeated searches', async () => {
    const large = adapter('large', [hit('large', '276', 'location', 'superseded'), hit('large', '999', 'place-name')], [hit('large', '2345', 'location'), hit('large', '1280', 'place')]);
    const other = adapter('other', [], [hit('other', '1280', 'place')]);
    discoverDatasets.mockResolvedValue([large.adapter, other.adapter]);
    const store = useVocabularyStore();
    const locationHits = await store.searchAcrossDatasets('location');
    expect(locationHits.map(({ conceptId, status }) => [conceptId, status])).toEqual([['276', 'superseded'], ['2345', 'valid']]);
    const repeatedLocationHits = await store.searchAcrossDatasets('location');
    expect(repeatedLocationHits.map(({ conceptId, status }) => [conceptId, status])).toEqual([['276', 'superseded'], ['2345', 'valid']]);
    expect(large.ensureAllChunksLoaded).toHaveBeenCalledTimes(2);

  });

  it('finds later place concepts even when chunk zero has a matching term', async () => {
    const freshLarge = adapter('large', [hit('large', '999', 'place-name')], [hit('large', '1280', 'place')]);
    const freshOther = adapter('other', [], [hit('other', '1280', 'place')]);
    discoverDatasets.mockResolvedValue([freshLarge.adapter, freshOther.adapter]);
    const placeHits = await useVocabularyStore().searchAcrossDatasets('place');
    expect(placeHits.map(({ registerId, conceptId }) => [registerId, conceptId])).toEqual([['large', '999'], ['large', '1280'], ['other', '1280']]);
  });

  it('preserves loaded hits when a later chunk fails and continues searching other datasets', async () => {
    const loadedHit = hit('partial', '276', 'location', 'superseded');
    const partial = adapter('partial', [loadedHit], [], { failLoad: true });
    const healthyHit = hit('healthy', '2345', 'location');
    const healthy = adapter('healthy', [], [healthyHit]);
    discoverDatasets.mockResolvedValue([partial.adapter, healthy.adapter]);

    const store = useVocabularyStore();
    const results = await store.searchAcrossDatasets('location');

    expect(partial.ensureAllChunksLoaded).toHaveBeenCalledOnce();
    expect(results).toEqual([loadedHit, healthyHit]);
    expect(store.searchWarning).toBe('search.incomplete');

    partial.ensureAllChunksLoaded.mockResolvedValue(undefined);
    await store.searchAcrossDatasets('location');
    expect(store.searchWarning).toBeNull();
  });

  it('continues after more than 20 hits and isolates chunk load and search failures', async () => {
    const crowdedRows = Array.from({ length: 21 }, (_, i) => hit('crowded', `needle-${i}`, 'needle'));
    const crowded = adapter('crowded', crowdedRows);
    const late = adapter('late', [], [hit('late', 'late-1', 'needle')]);
    const brokenLoad = adapter('broken-load', [], [], { failLoad: true });
    const noManifest = adapter('no-manifest', [], [hit('no-manifest', 'skip', 'needle')], { manifest: false });
    const brokenSearch = adapter('broken-search', []);
    brokenSearch.search.mockImplementation(() => { throw new Error('search failed'); });
    discoverDatasets.mockResolvedValue([crowded.adapter, brokenLoad.adapter, noManifest.adapter, brokenSearch.adapter, late.adapter]);

    const results = await useVocabularyStore().searchAcrossDatasets('needle');
    expect(results.map(({ registerId, conceptId }) => [registerId, conceptId])).toContainEqual(['late', 'late-1']);
    expect(results).toHaveLength(22);
    expect(late.ensureAllChunksLoaded).toHaveBeenCalledOnce();
    expect(brokenLoad.ensureAllChunksLoaded).toHaveBeenCalledOnce();
    expect(noManifest.ensureAllChunksLoaded).not.toHaveBeenCalled();
  });
});
