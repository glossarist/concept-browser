import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BibliographyAdapter } from '../adapters/bibliography-adapter';

function makeResponse(status: number, body: unknown): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe('BibliographyAdapter', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for findById before load', () => {
    const a = new BibliographyAdapter('iso', {
      basePath: '/',
      fetcher: async () => makeResponse(200, { bibliography: [] }),
    });
    expect(a.findById('ref-1')).toBeNull();
    expect(a.all()).toEqual([]);
  });

  it('loads bibliography once and deduplicates subsequent calls', async () => {
    let calls = 0;
    const fetcher = vi.fn(async () => {
      calls++;
      return makeResponse(200, {
        bibliography: [
          { id: 'ref-1', title: 'ISO Standard', type: 'misc' },
        ],
      });
    });
    const a = new BibliographyAdapter('iso', { basePath: '/', fetcher });
    await a.load();
    await a.load();
    expect(calls).toBe(1);
    expect(a.findById('ref-1')?.id).toBe('ref-1');
  });

  it('treats 404 as missing bibliography — no throw, findById returns null', async () => {
    const fetcher = vi.fn(async () => makeResponse(404, {}));
    const a = new BibliographyAdapter('iso', { basePath: '/', fetcher });
    await expect(a.load()).resolves.toBeUndefined();
    expect(a.findById('ref-1')).toBeNull();
  });

  it('swallows network errors — loaded becomes true to prevent retry storms', async () => {
    const fetcher = vi.fn(async () => { throw new Error('boom'); });
    const a = new BibliographyAdapter('iso', { basePath: '/', fetcher });
    await a.load();
    expect(a.all()).toEqual([]);
    await a.load();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('clear() resets state so the next load() refetches', async () => {
    let calls = 0;
    const fetcher = vi.fn(async () => {
      calls++;
      return makeResponse(200, { bibliography: [{ id: 'x' }] });
    });
    const a = new BibliographyAdapter('iso', { basePath: '/', fetcher });
    await a.load();
    a.clear();
    expect(a.findById('x')).toBeNull();
    await a.load();
    expect(calls).toBe(2);
  });

  it('builds URLs from basePath + datasetId', async () => {
    const fetcher = vi.fn(async () => makeResponse(200, { bibliography: [] }));
    const a = new BibliographyAdapter('isotc204', { basePath: '/cb/', fetcher });
    await a.load();
    expect(fetcher).toHaveBeenCalledWith('/cb/data/isotc204/bibliography.json');
  });
});
