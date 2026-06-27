import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { BuildCache } from '../../../scripts/lib/build-cache.mjs';

const SUITE_DIR = join(tmpdir(), `build-cache-${process.pid}-${Date.now()}`);

beforeEach(() => {
  mkdirSync(SUITE_DIR, { recursive: true });
});

afterEach(() => {
  rmSync(SUITE_DIR, { recursive: true, force: true });
});

describe('BuildCache', () => {
  it('returns null for a missing key', async () => {
    const cache = new BuildCache(SUITE_DIR);
    expect(await cache.get('missing')).toBeNull();
  });

  it('round-trips a value through set/get', async () => {
    const cache = new BuildCache(SUITE_DIR);
    await cache.set('concept-3.1.1', { ttl: '@prefix' }, 'aaa');
    const entry = await cache.get('concept-3.1.1');
    expect(entry?.value).toEqual({ ttl: '@prefix' });
    expect(entry?.hash).toBe('aaa');
  });

  it('readThrough invokes the producer on a miss', async () => {
    const cache = new BuildCache(SUITE_DIR);
    let calls = 0;
    const { value, hit } = await cache.readThrough('k', 'h1', async () => {
      calls++;
      return { ok: true };
    });
    expect(hit).toBe(false);
    expect(calls).toBe(1);
    expect(value).toEqual({ ok: true });
  });

  it('readThrough skips the producer on a hit', async () => {
    const cache = new BuildCache(SUITE_DIR);
    await cache.set('k', { ok: true }, 'h1');
    let calls = 0;
    const { value, hit } = await cache.readThrough('k', 'h1', async () => {
      calls++;
      return { ok: false };
    });
    expect(hit).toBe(true);
    expect(calls).toBe(0);
    expect(value).toEqual({ ok: true });
  });

  it('readThrough re-invokes the producer when the hash differs', async () => {
    const cache = new BuildCache(SUITE_DIR);
    await cache.set('k', 'old', 'h1');
    const { value, hit } = await cache.readThrough('k', 'h2', async () => 'new');
    expect(hit).toBe(false);
    expect(value).toBe('new');
  });

  it('hash is stable for the same input', () => {
    expect(BuildCache.hash('hello')).toBe(BuildCache.hash('hello'));
  });

  it('hash differs for different inputs', () => {
    expect(BuildCache.hash('hello')).not.toBe(BuildCache.hash('world'));
  });

  it('sanitizes unsafe key characters in the on-disk path', async () => {
    const cache = new BuildCache(SUITE_DIR);
    await cache.set('this/has spaces&symbols', 1, 'h');
    const entry = await cache.get('this/has spaces&symbols');
    expect(entry?.value).toBe(1);
  });
});
