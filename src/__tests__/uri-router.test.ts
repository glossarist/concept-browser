import { describe, it, expect } from 'vitest';
import { UriRouter } from '../adapters/UriRouter';

describe('UriRouter', () => {
  it('resolves URIs for registered datasets', () => {
    const router = new UriRouter();
    router.registerDataset('iev', '/data/iev');

    const resolved = router.resolveUri('https://glossarist.org/iev/concept/103-01-02');
    expect(resolved).toEqual({ registerId: 'iev', conceptId: '103-01-02' });
  });

  it('resolves URIs with multi-part concept IDs', () => {
    const router = new UriRouter();
    router.registerDataset('isotc204', '/data/isotc204');

    const resolved = router.resolveUri('https://glossarist.org/isotc204/concept/3.1.1.1');
    expect(resolved).toEqual({ registerId: 'isotc204', conceptId: '3.1.1.1' });
  });

  it('returns null for unknown register', () => {
    const router = new UriRouter();
    router.registerDataset('iev', '/data/iev');

    expect(router.resolveUri('https://glossarist.org/unknown/concept/123')).toBeNull();
  });

  it('returns null for non-matching URI pattern', () => {
    const router = new UriRouter();
    router.registerDataset('iev', '/data/iev');

    expect(router.resolveUri('https://example.com/other')).toBeNull();
  });

  it('builds URIs from register and concept ID', () => {
    const router = new UriRouter();
    expect(router.buildUri('iev', '103-01-02')).toBe('https://glossarist.org/iev/concept/103-01-02');
  });

  it('lists all registered IDs', () => {
    const router = new UriRouter();
    router.registerDataset('iev', '/data/iev');
    router.registerDataset('isotc211', '/data/isotc211');

    expect(router.getRegisteredIds()).toEqual(['iev', 'isotc211']);
  });

  it('resolves across multiple registers', () => {
    const router = new UriRouter();
    router.registerDataset('iev', '/data/iev');
    router.registerDataset('isotc211', '/data/isotc211');
    router.registerDataset('isotc204', '/data/isotc204');

    expect(router.resolveUri('https://glossarist.org/iev/concept/102-01-01')?.registerId).toBe('iev');
    expect(router.resolveUri('https://glossarist.org/isotc211/concept/10')?.registerId).toBe('isotc211');
    expect(router.resolveUri('https://glossarist.org/isotc204/concept/3.1.1.1')?.registerId).toBe('isotc204');
  });

  describe('parseUri (static)', () => {
    it('extracts register and concept from any glossarist URI', () => {
      expect(UriRouter.parseUri('https://glossarist.org/iev/concept/103-01-02')).toEqual({
        registerId: 'iev', conceptId: '103-01-02',
      });
    });

    it('handles multi-part concept IDs', () => {
      expect(UriRouter.parseUri('https://glossarist.org/isotc204/concept/3.1.1.1')).toEqual({
        registerId: 'isotc204', conceptId: '3.1.1.1',
      });
    });

    it('returns null for non-matching URIs', () => {
      expect(UriRouter.parseUri('https://example.com/other')).toBeNull();
    });
  });
});
