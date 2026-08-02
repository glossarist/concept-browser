// @ts-check
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';

/**
 * @typedef {Object} BuildCacheEntry
 * @property {string} hash
 * @property {unknown} value
 * @property {string} storedAt
 */

export class BuildCache {
  private cacheDir: string;

  constructor(cacheDir: string) {
    this.cacheDir = cacheDir;
  }

  /** @template T @param {string} key @returns {Promise<BuildCacheEntry<T> | null>} */
  async get(key) {
    const path = this.pathFor(key);
    try {
      const text = await readFile(path, 'utf8');
      return JSON.parse(text);
    } catch {
      return null;
    }
  }

  /**
   * @template T
   * @param {string} key
   * @param {T} value
   * @param {string} hash
   */
  async set(key, value, hash) {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    const entry = { hash, value, storedAt: new Date().toISOString() };
    await writeFile(path, JSON.stringify(entry));
  }

  /**
   * @template T
   * @param {string} key
   * @param {string} hash
   * @param {() => Promise<T>} producer
   * @returns {Promise<{ value: T; hit: boolean }>}
   */
  async readThrough(key, hash, producer) {
    const cached = await this.get(key);
    if (cached && cached.hash === hash) {
      return { value: cached.value, hit: true };
    }
    const value = await producer();
    await this.set(key, value, hash);
    return { value, hit: false };
  }

  /** @param {string} key @returns {string} */
  pathFor(key) {
    const safe = key.replace(/[^a-zA-Z0-9._-]/g, '_');
    return `${this.cacheDir}/${safe}.json`;
  }

  /** @param {string} input @returns {string} */
  static hash(input) {
    return createHash('sha256').update(input).digest('hex').slice(0, 16);
  }
}
