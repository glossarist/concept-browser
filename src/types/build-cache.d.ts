declare module '*/scripts/lib/build-cache.mjs' {
  export interface BuildCacheEntry<T = unknown> {
    hash: string;
    value: T;
    storedAt: string;
  }

  export class BuildCache {
    constructor(cacheDir: string);
    get<T = unknown>(key: string): Promise<BuildCacheEntry<T> | null>;
    set<T = unknown>(key: string, value: T, hash: string): Promise<void>;
    readThrough<T>(
      key: string,
      hash: string,
      producer: () => Promise<T>,
    ): Promise<{ value: T; hit: boolean }>;
    pathFor(key: string): string;
    static hash(input: string): string;
  }
}
