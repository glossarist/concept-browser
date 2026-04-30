import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AdapterFactory } from '../adapters/factory';

const mockFetch = vi.fn();
global.fetch = mockFetch;

function mockJsonResponse(data: any) {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response);
}

describe('AdapterFactory', () => {
  let factory: AdapterFactory;

  beforeEach(() => {
    factory = new AdapterFactory();
    mockFetch.mockReset();
  });

  describe('discoverDatasets', () => {
    it('creates adapters from dataset registry', async () => {
      mockFetch.mockReturnValue(mockJsonResponse([
        { id: 'iev', manifestUrl: '/data/iev/manifest.json' },
        { id: 'isotc211', manifestUrl: '/data/isotc211/manifest.json' },
        { id: 'isotc204', manifestUrl: '/data/isotc204/manifest.json' },
      ]));

      const adapters = await factory.discoverDatasets('/datasets.json');
      expect(adapters.length).toBe(3);
      expect(adapters[0].registerId).toBe('iev');
      expect(factory.getAdapters().length).toBe(3);
    });

    it('throws on failed fetch', async () => {
      mockFetch.mockReturnValue(Promise.resolve({
        ok: false,
        status: 500,
      } as Response));

      await expect(factory.discoverDatasets('/bad-url')).rejects.toThrow('Failed to load dataset registry');
    });
  });

  describe('loadDataset', () => {
    it('loads manifest, index, and registers with UriRouter', async () => {
      // Setup: discover first
      mockFetch.mockReturnValueOnce(mockJsonResponse([
        { id: 'test', manifestUrl: '/data/test/manifest.json' },
      ]));
      await factory.discoverDatasets('/datasets.json');

      // Load manifest
      mockFetch.mockReturnValueOnce(mockJsonResponse({
        id: 'test',
        title: 'Test',
        languages: ['eng'],
        chunkSize: 500,
      }));

      // Load index
      mockFetch.mockReturnValueOnce(mockJsonResponse({
        registerId: 'test',
        conceptCount: 2,
        chunkSize: 500,
        chunks: [],
        concepts: [
          { id: '102-01-01', eng: 'equality', status: 'Standard' },
          { id: '102-01-02', eng: 'value', status: 'Standard' },
        ],
      }));

      const adapter = await factory.loadDataset('test');
      expect(adapter.manifest?.title).toBe('Test');
      expect(adapter.getConcepts().length).toBe(2);

      // UriRouter should now resolve
      const resolved = factory.resolveUri('https://glossarist.org/test/concept/102-01-01');
      expect(resolved?.adapter.registerId).toBe('test');
      expect(resolved?.conceptId).toBe('102-01-01');
    });

    it('returns undefined for unknown dataset', () => {
      expect(factory.getAdapter('nonexistent')).toBeUndefined();
    });

    it('resolveUri returns null when dataset not loaded', () => {
      expect(factory.resolveUri('https://glossarist.org/unknown/concept/123')).toBeNull();
    });
  });

  describe('cross-register resolution', () => {
    it('resolves URIs across multiple loaded datasets', async () => {
      mockFetch.mockReturnValueOnce(mockJsonResponse([
        { id: 'iev', manifestUrl: '/data/iev/manifest.json' },
        { id: 'isotc204', manifestUrl: '/data/isotc204/manifest.json' },
      ]));
      await factory.discoverDatasets('/datasets.json');

      // Load IEV
      mockFetch.mockReturnValueOnce(mockJsonResponse({
        id: 'iev', title: 'IEV', languages: ['eng'], chunkSize: 500,
      }));
      mockFetch.mockReturnValueOnce(mockJsonResponse({
        registerId: 'iev', conceptCount: 0, chunkSize: 500, chunks: [], concepts: [],
      }));
      await factory.loadDataset('iev');

      // Load TC 204
      mockFetch.mockReturnValueOnce(mockJsonResponse({
        id: 'isotc204', title: 'TC 204', languages: ['eng'], chunkSize: 500,
      }));
      mockFetch.mockReturnValueOnce(mockJsonResponse({
        registerId: 'isotc204', conceptCount: 0, chunkSize: 500, chunks: [], concepts: [],
      }));
      await factory.loadDataset('isotc204');

      // Cross-register resolution
      expect(factory.resolveUri('https://glossarist.org/iev/concept/103-01-02')?.adapter.registerId).toBe('iev');
      expect(factory.resolveUri('https://glossarist.org/isotc204/concept/3.1.1.1')?.adapter.registerId).toBe('isotc204');
    });
  });
});
