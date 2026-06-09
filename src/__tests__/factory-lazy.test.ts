import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getFactory, resetFactory } from '../adapters/factory';
import { setupPinia } from './test-helpers';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockJsonResponse(data: any) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response);
}

describe('AdapterFactory — lazy discovery', () => {
  let pinia: ReturnType<typeof setupPinia>;

  beforeEach(() => {
    pinia = setupPinia();
    resetFactory();
    mockFetch.mockReset();
  });

  afterEach(() => {
    resetFactory();
  });

  it('skips manifest fetch when summary is present', async () => {
    const factory = getFactory();

    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith('datasets.json')) {
        return mockJsonResponse([
          {
            id: 'ds1',
            manifestUrl: '/data/ds1/manifest.json',
            summary: {
              title: 'Dataset 1',
              description: 'First dataset',
              conceptCount: 100,
              languages: ['eng'],
              owner: 'Test',
              tags: [],
              color: '#ff0000',
            },
          },
        ]);
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });

    const adapters = await factory.discoverDatasets('/datasets.json');

    expect(adapters.length).toBe(1);
    expect(adapters[0].manifest).not.toBeNull();
    expect(adapters[0].manifest!.title).toBe('Dataset 1');
    expect(adapters[0].manifest!.conceptCount).toBe(100);
    // Should NOT fetch manifest.json — only datasets.json + source-refs.json
    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch).toHaveBeenCalledWith('/datasets.json');
  });

  it('fetches manifests when no summary is present', async () => {
    const factory = getFactory();

    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith('datasets.json')) {
        return mockJsonResponse([
          { id: 'ds1', manifestUrl: '/data/ds1/manifest.json' },
        ]);
      }
      if (url.endsWith('manifest.json')) {
        return mockJsonResponse({
          id: 'ds1',
          title: 'Full Dataset',
          description: 'Full description',
          owner: 'Test',
          baseUrl: '/data/ds1',
          languages: ['eng'],
          conceptCount: 50,
          chunkSize: 500,
        });
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });

    const adapters = await factory.discoverDatasets('/datasets.json');

    expect(adapters.length).toBe(1);
    expect(adapters[0].manifest!.title).toBe('Full Dataset');
    // Should fetch datasets.json, manifest.json, and source-refs.json
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('loads full manifest in loadDataset after summary discovery', async () => {
    const factory = getFactory();

    let callCount = 0;
    mockFetch.mockImplementation((url: string) => {
      if (url.endsWith('datasets.json')) {
        return mockJsonResponse([
          {
            id: 'ds1',
            manifestUrl: '/data/ds1/manifest.json',
            summary: {
              title: 'Summary Title',
              description: '',
              conceptCount: 10,
              languages: ['eng'],
              owner: '',
              tags: [],
            },
          },
        ]);
      }
      if (url.endsWith('manifest.json')) {
        return mockJsonResponse({
          id: 'ds1',
          title: 'Full Title',
          description: 'Full description',
          owner: 'Test',
          baseUrl: '/data/ds1',
          languages: ['eng', 'fra'],
          conceptCount: 50,
          chunkSize: 500,
          datasetUri: 'urn:test:ds1',
        });
      }
      if (url.endsWith('index.json')) {
        return mockJsonResponse({
          registerId: 'ds1',
          schemaVersion: '1.0',
          conceptCount: 50,
          chunkSize: 500,
          chunks: [],
          concepts: [],
        });
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });

    // Discover with summary — no manifest fetch (datasets.json + source-refs.json)
    const adapters = await factory.discoverDatasets('/datasets.json');
    expect(adapters[0].manifest!.title).toBe('Summary Title');
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Load full dataset — fetches full manifest + index
    const loaded = await factory.loadDataset('ds1');
    expect(loaded.manifest!.title).toBe('Full Title');
    expect(loaded.manifest!.conceptCount).toBe(50);
    expect(loaded.manifest!.languages).toEqual(['eng', 'fra']);
  });

  describe('loadCrossRefIndex', () => {
    it('fetches and caches cross-ref-index', async () => {
      const factory = getFactory();

      mockFetch.mockImplementation((url: string) => {
        if (url.endsWith('cross-ref-index.json')) {
          return mockJsonResponse({ 'ds1': ['ds2', 'ds3'] });
        }
        return Promise.resolve({ ok: false, status: 404 } as Response);
      });

      const index = await factory.loadCrossRefIndex();
      expect(index).toEqual({ 'ds1': ['ds2', 'ds3'] });

      // Second call should use cache
      const index2 = await factory.loadCrossRefIndex();
      expect(index2).toEqual({ 'ds1': ['ds2', 'ds3'] });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('returns empty object on fetch failure', async () => {
      const factory = getFactory();
      mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response);

      const index = await factory.loadCrossRefIndex();
      expect(index).toEqual({});
    });
  });
});
