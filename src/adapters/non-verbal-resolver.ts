/**
 * NonVerbalEntityResolver — the single runtime access point for non-verbal
 * entities.
 *
 * Responsibilities:
 *   - Fetch entity JSON-LD from `public/data/{ds}/{kind-dir}/{id}.json`.
 *   - Bridge to the TS model via `KIND_TO_BRIDGE`.
 *   - Cache per `(kind, datasetId, id)` with Promise dedup for concurrent
 *     callers.
 *   - Compute image URLs (basePath-aware for GitHub Pages).
 *   - Compute stable anchor IDs via the anchor SSOT.
 *
 * Components and the content-renderer go through this resolver; they never
 * call `fetch()` directly. The resolver is owned by `AdapterFactory` —
 * exactly one instance per app.
 */

import type { NonVerbalKind } from './non-verbal/types';
import type { NonVerbalEntity } from 'glossarist';
import { KIND_TO_DIR, KIND_TO_BRIDGE } from './non-verbal/kind';
import { anchorId } from '../utils/non-verbal-anchor';
import { NonVerbalEntityNotFoundError } from '../errors';

export type { NonVerbalKind } from './non-verbal/types';
export type { NonVerbalEntity } from 'glossarist';

export interface NonVerbalEntityResolverOptions {
  basePath?: string;
  fetcher?: (url: string) => Promise<Response>;
}

interface CacheEntry {
  promise: Promise<NonVerbalEntity | null>;
  resolved: NonVerbalEntity | null | undefined;
}

export class NonVerbalEntityResolver {
  private readonly cache = new Map<string, CacheEntry>();
  private readonly basePath: string;
  private readonly fetcher: (url: string) => Promise<Response>;

  constructor(opts: NonVerbalEntityResolverOptions = {}) {
    this.basePath = opts.basePath ?? import.meta.env.BASE_URL ?? '/';
    this.fetcher = opts.fetcher ?? ((url: string) => fetch(url));
  }

  resolve(kind: NonVerbalKind, datasetId: string, entityId: string): Promise<NonVerbalEntity | null> {
    const key = `${kind}|${datasetId}|${entityId}`;
    const existing = this.cache.get(key);
    if (existing) return existing.promise;

    const promise = (async () => {
      const dir = KIND_TO_DIR[kind];
      const url = `${this.basePath}data/${datasetId}/${dir}/${entityId}.json`;
      const resp = await this.fetcher(url);
      if (resp.status === 404) return null;
      if (!resp.ok) {
        throw NonVerbalEntityNotFoundError.make(datasetId, kind, entityId, resp.status);
      }
      const doc = (await resp.json()) as Record<string, unknown>;
      const entity = KIND_TO_BRIDGE[kind](doc);
      return entity;
    })();

    const entry: CacheEntry = { promise, resolved: undefined };
    promise.then(
      v => { entry.resolved = v; return v; },
      () => { this.cache.delete(key); return null; },
    );
    this.cache.set(key, entry);
    return promise;
  }

  /**
   * Synchronous peek at the cache. Returns the entity if the previous
   * `resolve` already completed, otherwise `undefined`. Useful for SSR or
   * pre-hydration checks where the cache is warm.
   */
  peek(kind: NonVerbalKind, datasetId: string, entityId: string): NonVerbalEntity | null | undefined {
    return this.cache.get(`${kind}|${datasetId}|${entityId}`)?.resolved;
  }

  resolveImageUrl(datasetId: string, src: string): string {
    const cleanSrc = src.startsWith('images/') ? src.slice('images/'.length) : src;
    return `${this.basePath}data/${datasetId}/images/${cleanSrc}`;
  }

  anchor(kind: NonVerbalKind, datasetId: string, entityId: string): string {
    return anchorId(kind, datasetId, entityId);
  }

  /**
   * Drop the cached entry for one entity. Locale switching does NOT need
   * this — the cached entity is the raw JSON-LD, and localization happens
   * at render time via the locale SSOT.
   */
  invalidate(kind: NonVerbalKind, datasetId: string, entityId: string): void {
    this.cache.delete(`${kind}|${datasetId}|${entityId}`);
  }

  clear(): void {
    this.cache.clear();
  }
}
