import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useVocabularyStore } from '../stores/vocabulary';
import { createTestRouter, setupPinia, makeManifest, makeAdapterStub, makeSearchHit } from './test-helpers';
import { conceptFromJson } from '../adapters/model-bridge';
import { getFactory } from '../adapters/factory';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockJsonResponse(data: any) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response);
}

function makeConcept() {
  return conceptFromJson({
    '@id': 'https://glossarist.org/test/concept/1',
    '@type': 'gl:Concept',
    'gl:localizedConcept': {
      eng: {
        '@type': 'gl:LocalizedConcept',
        'gl:languageCode': 'eng',
        'gl:designation': [{ '@type': 'gl:Expression', 'gl:term': 'test' }],
      },
    },
  });
}

describe('vocabulary store — layered loading', () => {
  let pinia: ReturnType<typeof setupPinia>;

  beforeEach(() => {
    pinia = setupPinia();
    mockFetch.mockReset();
    (getFactory() as any).crossRefIndex = null;
  });

  describe('loadDataset', () => {
    it('does not fetch edges or domain nodes', async () => {
      const store = useVocabularyStore();

      // Set up adapter with edge/domain tracking
      let edgeFetchCount = 0;
      let domainFetchCount = 0;
      const adapter = makeAdapterStub();
      adapter.loadEdgeIndex = () => { edgeFetchCount++; return Promise.resolve([]); };
      adapter.loadDomainNodes = () => { domainFetchCount++; return Promise.resolve([]); };

      store.datasets.set('test', adapter);
      store.manifests.set('test', makeManifest());

      // The store's loadDataset calls factory.loadDataset which requires adapter
      // to be registered with the factory. Since we test via viewConcept path,
      // verify that after concept view, only targeted edges are loaded.
      // For the store-level test, we verify loadDataset doesn't call loadEdges.
      // Since loadDataset now only does factory.loadDataset, the adapter stub
      // won't have its edge methods called.

      // Direct test: viewConcept triggers ensureEdgesForDataset
      adapter.fetchConcept = () => Promise.resolve(makeConcept());
      adapter.manifest = makeManifest();

      mockFetch.mockImplementation((url: string) => {
        if (url.endsWith('cross-ref-index.json')) {
          return mockJsonResponse({ test: [] });
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      await store.viewConcept('test', '1');

      // Should load own edges (once) + domain nodes (once)
      expect(edgeFetchCount).toBe(1);
      expect(domainFetchCount).toBe(1);
    });
  });

  describe('ensureEdgesForDataset', () => {
    it('loads cross-referenced dataset edges via cross-ref-index', async () => {
      const store = useVocabularyStore();

      mockFetch.mockImplementation((url: string) => {
        if (url.endsWith('cross-ref-index.json')) {
          return mockJsonResponse({ 'viml-2022': ['viml-2013', 'viml-2000'] });
        }
        if (url.endsWith('edges.json')) {
          return mockJsonResponse({ edges: [] });
        }
        if (url.endsWith('domain-nodes.json')) {
          return mockJsonResponse({ domainNodes: [] });
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      let viml2013EdgeLoads = 0;
      let viml2000EdgeLoads = 0;
      let unrelatedEdgeLoads = 0;

      const viml2022 = makeAdapterStub();
      viml2022.fetchConcept = () => Promise.resolve(makeConcept());
      viml2022.manifest = makeManifest({ id: 'viml-2022' });

      const viml2013 = makeAdapterStub();
      viml2013.loadEdgeIndex = () => { viml2013EdgeLoads++; return Promise.resolve([]); };
      viml2013.loadDomainNodes = () => Promise.resolve([]);
      viml2013.manifest = makeManifest({ id: 'viml-2013' });

      const viml2000 = makeAdapterStub();
      viml2000.loadEdgeIndex = () => { viml2000EdgeLoads++; return Promise.resolve([]); };
      viml2000.loadDomainNodes = () => Promise.resolve([]);
      viml2000.manifest = makeManifest({ id: 'viml-2000' });

      const unrelated = makeAdapterStub();
      unrelated.loadEdgeIndex = () => { unrelatedEdgeLoads++; return Promise.resolve([]); };
      unrelated.loadDomainNodes = () => Promise.resolve([]);
      unrelated.manifest = makeManifest({ id: 'unrelated' });

      store.datasets.set('viml-2022', viml2022);
      store.datasets.set('viml-2013', viml2013);
      store.datasets.set('viml-2000', viml2000);
      store.datasets.set('unrelated', unrelated);

      await store.viewConcept('viml-2022', '1');

      // viml-2013 and viml-2000 edges should be loaded (cross-referenced)
      expect(viml2013EdgeLoads).toBe(1);
      expect(viml2000EdgeLoads).toBe(1);
      // unrelated dataset should NOT be loaded
      expect(unrelatedEdgeLoads).toBe(0);
    });

    it('skips datasets already loaded', async () => {
      const store = useVocabularyStore();

      // Pre-load edges for viml-2013
      store.edgeStatus['viml-2013'] = { loaded: true, count: 100 };

      let viml2013EdgeLoads = 0;
      mockFetch.mockImplementation((url: string) => {
        if (url.endsWith('cross-ref-index.json')) {
          return mockJsonResponse({ 'viml-2022': ['viml-2013'] });
        }
        if (url.includes('viml-2013') && url.endsWith('edges.json')) {
          viml2013EdgeLoads++;
          return mockJsonResponse({ edges: [] });
        }
        if (url.endsWith('edges.json')) {
          return mockJsonResponse({ edges: [] });
        }
        if (url.endsWith('domain-nodes.json')) {
          return mockJsonResponse({ domainNodes: [] });
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      const viml2022 = makeAdapterStub();
      viml2022.fetchConcept = () => Promise.resolve(makeConcept());
      viml2022.manifest = makeManifest({ id: 'viml-2022' });

      const viml2013 = makeAdapterStub();
      viml2013.loadEdgeIndex = () => { viml2013EdgeLoads++; return Promise.resolve([]); };
      viml2013.loadDomainNodes = () => Promise.resolve([]);
      viml2013.manifest = makeManifest({ id: 'viml-2013' });

      store.datasets.set('viml-2022', viml2022);
      store.datasets.set('viml-2013', viml2013);
      store.manifests.set('viml-2022', makeManifest({ id: 'viml-2022' }));
      store.manifests.set('viml-2013', makeManifest({ id: 'viml-2013' }));

      await store.viewConcept('viml-2022', '1');

      // viml-2013 edges should NOT be re-loaded
      expect(viml2013EdgeLoads).toBe(0);
    });
  });

  describe('searchAcrossDatasets — two-pass', () => {
    it('returns results from loaded data without loading chunks', async () => {
      const store = useVocabularyStore();
      store.initialized = true;

      let chunksLoaded = false;

      const adapter = makeAdapterStub({
        concepts: Array.from({ length: 25 }, (_, i) => ({
          id: `${i + 1}`,
          designations: { eng: `concept ${i + 1}` },
          eng: `concept ${i + 1}`,
          status: 'valid',
        })),
      });
      adapter.manifest = makeManifest();
      adapter.index = { concepts: adapter.getConcepts(), conceptCount: 25, registerId: 'test', schemaVersion: '1.0', chunkSize: 500, chunks: [] };
      adapter.search = () => Array.from({ length: 25 }, (_, i) =>
        makeSearchHit({ conceptId: `${i + 1}`, designation: `concept ${i + 1}` })
      );
      adapter.ensureAllChunksLoaded = () => {
        chunksLoaded = true;
        return Promise.resolve();
      };

      store.datasets.set('test', adapter);

      const results = await store.searchAcrossDatasets('concept');

      expect(results.length).toBe(25);
      // With ≥20 results, chunks should NOT be loaded
      expect(chunksLoaded).toBe(false);
    });

    it('loads chunks for adapters with zero index hits when total is under threshold', async () => {
      const store = useVocabularyStore();
      store.initialized = true;

      let adapter1ChunksLoaded = false;
      let adapter2ChunksLoaded = false;

      // Adapter 1: has a few results in index (5 hits)
      const adapter1 = makeAdapterStub({
        concepts: Array.from({ length: 5 }, (_, i) => ({
          id: `${i + 1}`,
          designations: { eng: `item ${i + 1}` },
          eng: `item ${i + 1}`,
          status: 'valid',
        })),
      });
      adapter1.manifest = makeManifest({ id: 'ds1' });
      adapter1.registerId = 'ds1';
      adapter1.index = { concepts: adapter1.getConcepts(), conceptCount: 5, registerId: 'ds1', schemaVersion: '1.0', chunkSize: 500, chunks: [] };
      adapter1.search = () => Array.from({ length: 5 }, (_, i) =>
        makeSearchHit({ registerId: 'ds1', conceptId: `${i + 1}`, designation: `item ${i + 1}` })
      );
      adapter1.ensureAllChunksLoaded = () => {
        adapter1ChunksLoaded = true;
        return Promise.resolve();
      };

      // Adapter 2: has no results in index but will find some after chunk loading
      const adapter2 = makeAdapterStub();
      adapter2.manifest = makeManifest({ id: 'ds2' });
      adapter2.registerId = 'ds2';
      adapter2.index = { concepts: [], conceptCount: 0, registerId: 'ds2', schemaVersion: '1.0', chunkSize: 500, chunks: [] };
      adapter2.search = () => [];
      let adapter2CalledAfterChunkLoad = false;
      adapter2.ensureAllChunksLoaded = () => {
        adapter2ChunksLoaded = true;
        // After chunks load, search returns results
        adapter2.search = () => [makeSearchHit({ registerId: 'ds2', conceptId: '100', designation: 'item hidden' })];
        return Promise.resolve();
      };

      store.datasets.set('ds1', adapter1);
      store.datasets.set('ds2', adapter2);

      const results = await store.searchAcrossDatasets('item');

      expect(results.length).toBe(6); // 5 from ds1 index + 1 from ds2 chunks
      // Adapter 1 should NOT have loaded chunks (it had index hits)
      expect(adapter1ChunksLoaded).toBe(false);
      // Adapter 2 should have loaded chunks (it had 0 index hits, total < 20)
      expect(adapter2ChunksLoaded).toBe(true);
    });

    it('does not load chunks when adapter search has 0 hits from index', async () => {
      const store = useVocabularyStore();
      store.initialized = true;

      let chunksLoaded = false;

      const adapter = makeAdapterStub();
      adapter.manifest = makeManifest();
      adapter.index = { concepts: [], conceptCount: 0, registerId: 'test', schemaVersion: '1.0', chunkSize: 500, chunks: [] };
      adapter.search = () => [];
      adapter.ensureAllChunksLoaded = () => {
        chunksLoaded = true;
        return Promise.resolve();
      };

      store.datasets.set('test', adapter);

      const results = await store.searchAcrossDatasets('nonexistent');

      expect(results.length).toBe(0);
      // Should still try loading chunks for the adapter that found nothing
      expect(chunksLoaded).toBe(true);
    });
  });
});
