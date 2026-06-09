import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getFactory, resetFactory } from '../adapters/factory';

describe('AdapterFactory.loadSourceRefs', () => {
  beforeEach(() => {
    resetFactory();
    vi.restoreAllMocks();
  });

  it('registers source refs from source-refs.json', async () => {
    const factory = getFactory();
    const mockFetch = vi.fn((url: string) => {
      if (url.endsWith('datasets.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'vim-2012',
              manifestUrl: '/data/vim-2012/manifest.json',
              summary: {
                title: 'VIM 2012',
                description: 'Vocabulary of metrology',
                conceptCount: 144,
                languages: ['eng', 'fra'],
                owner: 'OIML',
                tags: [],
              },
              datasetUri: 'urn:oiml:pub:v:2:2012',
              uriBase: 'https://glossarist.org',
              uriAliases: ['urn:oiml:pub:v:2:2012*'],
            },
          ]),
        });
      }
      if (url.endsWith('source-refs.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            'OIML V2-200:2012': 'vim-2012',
            'VIM': 'vim-2012',
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });
    vi.stubGlobal('fetch', mockFetch);

    await factory.discoverDatasets('/datasets.json');

    // Should have fetched datasets.json + source-refs.json
    expect(mockFetch).toHaveBeenCalledWith('/data/source-refs.json');

    // Source refs should be registered — resolveCitation should now work
    const result = factory.resolveCitation('OIML V2-200:2012', '2.2', 'viml-2022');
    expect(result).toEqual({
      type: 'internal',
      registerId: 'vim-2012',
      conceptId: '2.2',
      crossDataset: true,
    });

    const aliasResult = factory.resolveCitation('VIM', '2.2', 'viml-2022');
    expect(aliasResult?.registerId).toBe('vim-2012');
  });

  it('gracefully handles missing source-refs.json', async () => {
    const factory = getFactory();
    const mockFetch = vi.fn((url: string) => {
      if (url.endsWith('datasets.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'ds1',
              manifestUrl: '/data/ds1/manifest.json',
              summary: {
                title: 'DS1',
                description: 'Test',
                conceptCount: 10,
                languages: ['eng'],
                owner: 'Test',
                tags: [],
              },
            },
          ]),
        });
      }
      // source-refs.json returns 404
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });
    vi.stubGlobal('fetch', mockFetch);

    // Should not throw
    const adapters = await factory.discoverDatasets('/datasets.json');
    expect(adapters).toHaveLength(1);
  });

  it('gracefully handles malformed source-refs.json', async () => {
    const factory = getFactory();
    const mockFetch = vi.fn((url: string) => {
      if (url.endsWith('datasets.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'ds1',
              manifestUrl: '/data/ds1/manifest.json',
              summary: {
                title: 'DS1',
                description: 'Test',
                conceptCount: 10,
                languages: ['eng'],
                owner: 'Test',
                tags: [],
              },
            },
          ]),
        });
      }
      if (url.endsWith('source-refs.json')) {
        // Malformed JSON
        return Promise.resolve({
          ok: true,
          json: () => Promise.reject(new Error('Invalid JSON')),
        });
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });
    vi.stubGlobal('fetch', mockFetch);

    // Should not throw
    const adapters = await factory.discoverDatasets('/datasets.json');
    expect(adapters).toHaveLength(1);
  });

  it('skips source refs for unknown datasets', async () => {
    const factory = getFactory();
    const mockFetch = vi.fn((url: string) => {
      if (url.endsWith('datasets.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'vim-2012',
              manifestUrl: '/data/vim-2012/manifest.json',
              summary: {
                title: 'VIM 2012',
                description: 'Vocabulary',
                conceptCount: 144,
                languages: ['eng', 'fra'],
                owner: 'OIML',
                tags: [],
              },
              datasetUri: 'urn:oiml:pub:v:2:2012',
              uriBase: 'https://glossarist.org',
              uriAliases: ['urn:oiml:pub:v:2:2012*'],
            },
          ]),
        });
      }
      if (url.endsWith('source-refs.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            'OIML V2-200:2012': 'vim-2012', // known dataset
            'Unknown Source': 'nonexistent-dataset', // unknown dataset
          }),
        });
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });
    vi.stubGlobal('fetch', mockFetch);

    await factory.discoverDatasets('/datasets.json');

    // Known source resolves
    const known = factory.resolveCitation('OIML V2-200:2012', '2.2');
    expect(known?.type).toBe('internal');

    // Unknown dataset source — not registered (no adapter for nonexistent-dataset)
    const unknown = factory.resolveCitation('Unknown Source', '1.1');
    expect(unknown).toBeNull();
  });
});
