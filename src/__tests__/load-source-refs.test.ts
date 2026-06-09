import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getFactory, resetFactory } from '../adapters/factory';
import type { Resolution } from '../adapters/types';

type InternalResolution = Extract<Resolution, { type: 'internal' }>;

function asInternal(r: Resolution | null): InternalResolution | null {
  return r?.type === 'internal' ? (r as InternalResolution) : null;
}

describe('AdapterFactory — bibliography resolution from registry', () => {
  beforeEach(() => {
    resetFactory();
    vi.restoreAllMocks();
  });

  it('registers bibliography from registry ref/refAliases', async () => {
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
              ref: 'OIML V 2-200:2012',
              refAliases: ['VIM'],
            },
          ]),
        });
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });
    vi.stubGlobal('fetch', mockFetch);

    await factory.discoverDatasets('/datasets.json');

    // No source-refs.json fetch — bibliography comes from registry config
    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining('source-refs'));

    // ref resolves via bibliography config
    const result = factory.resolveCitation('OIML V 2-200:2012', '2.2', 'viml-2022');
    expect(result).toEqual({
      type: 'internal',
      registerId: 'vim-2012',
      conceptId: '2.2',
      crossDataset: true,
    });

    // refAlias resolves too
    const alias = factory.resolveCitation('VIM', '2.2', 'viml-2022');
    expect(asInternal(alias)?.registerId).toBe('vim-2012');

    // URN resolves directly via URI pattern matching (no bibliography entry needed)
    const urn = factory.resolveCitation('urn:oiml:pub:v:2:2012', '2.2', 'viml-2022');
    expect(asInternal(urn)?.registerId).toBe('vim-2012');
  });

  it('resolves without ref/refAliases when only datasetUri is present', async () => {
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
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });
    vi.stubGlobal('fetch', mockFetch);

    const adapters = await factory.discoverDatasets('/datasets.json');
    expect(adapters).toHaveLength(1);
  });

  it('skips registry entries without datasetUri for bibliography', async () => {
    const factory = getFactory();
    const mockFetch = vi.fn((url: string) => {
      if (url.endsWith('datasets.json')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([
            {
              id: 'ds1',
              manifestUrl: '/data/ds1/manifest.json',
              summary: { title: 'DS1', description: 'Test', conceptCount: 10, languages: ['eng'], owner: 'Test', tags: [] },
              ref: 'Some Ref',
              // No datasetUri — bibliography entry skipped
            },
          ]),
        });
      }
      return Promise.resolve({ ok: false, status: 404 } as Response);
    });
    vi.stubGlobal('fetch', mockFetch);

    await factory.discoverDatasets('/datasets.json');

    // ref without URN can't resolve — no datasetUri to route to
    const result = factory.resolveCitation('Some Ref', '1.1');
    expect(result).toBeNull();
  });
});
