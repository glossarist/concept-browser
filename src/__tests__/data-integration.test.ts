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
        datasetUri: 'https://glossarist.org/test/*',
        uriBase: 'https://glossarist.org',
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

      // Resolver should now resolve internal URIs
      const resolved = factory.resolve('https://glossarist.org/test/concept/102-01-01');
      expect(resolved.type).toBe('internal');
      if (resolved.type === 'internal') {
        expect(resolved.registerId).toBe('test');
        expect(resolved.conceptId).toBe('102-01-01');
      }
    });

    it('returns undefined for unknown dataset', () => {
      expect(factory.getAdapter('nonexistent')).toBeUndefined();
    });

    it('resolve returns unresolved when dataset not loaded', () => {
      const resolved = factory.resolve('https://glossarist.org/unknown/concept/123');
      expect(resolved.type).toBe('unresolved');
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
        id: 'iev', datasetUri: 'urn:iec:std:iec:60050:*', uriBase: 'https://glossarist.org', title: 'IEV', languages: ['eng'], chunkSize: 500,
      }));
      mockFetch.mockReturnValueOnce(mockJsonResponse({
        registerId: 'iev', conceptCount: 0, chunkSize: 500, chunks: [], concepts: [],
      }));
      await factory.loadDataset('iev');

      // Load TC 204
      mockFetch.mockReturnValueOnce(mockJsonResponse({
        id: 'isotc204', datasetUri: 'urn:iso:std:iso:14812:*', uriBase: 'https://glossarist.org', title: 'TC 204', languages: ['eng'], chunkSize: 500,
      }));
      mockFetch.mockReturnValueOnce(mockJsonResponse({
        registerId: 'isotc204', conceptCount: 0, chunkSize: 500, chunks: [], concepts: [],
      }));
      await factory.loadDataset('isotc204');

      // Cross-register resolution
      const ievRes = factory.resolve('https://glossarist.org/iev/concept/103-01-02');
      expect(ievRes.type).toBe('internal');
      if (ievRes.type === 'internal') expect(ievRes.registerId).toBe('iev');

      const tcRes = factory.resolve('https://glossarist.org/isotc204/concept/3.1.1.1');
      expect(tcRes.type).toBe('internal');
      if (tcRes.type === 'internal') expect(tcRes.registerId).toBe('isotc204');
    });
  });
});
