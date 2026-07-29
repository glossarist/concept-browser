import { describe, it, expect } from 'vitest';
import { UriRouter } from '../adapters/UriRouter';

describe('UriRouter', () => {
  const URI_BASE = 'https://glossarist.org';

  function register(router: UriRouter, registerId: string, baseUrl: string = `/data/${registerId}`) {
    router.registerDataset(registerId, baseUrl, URI_BASE, [`${URI_BASE}/${registerId}/*`]);
  }

  it('resolves URIs for registered datasets', () => {
    const router = new UriRouter();
    register(router, 'iev');

    const resolved = router.resolveUri('https://glossarist.org/iev/concept/103-01-02');
    expect(resolved).toEqual({ registerId: 'iev', conceptId: '103-01-02' });
  });

  it('resolves URIs with multi-part concept IDs', () => {
    const router = new UriRouter();
    register(router, 'isotc204');

    const resolved = router.resolveUri('https://glossarist.org/isotc204/concept/3.1.1.1');
    expect(resolved).toEqual({ registerId: 'isotc204', conceptId: '3.1.1.1' });
  });

  it('returns null for unknown register', () => {
    const router = new UriRouter();
    register(router, 'iev');

    expect(router.resolveUri('https://glossarist.org/unknown/concept/123')).toBeNull();
  });

  it('returns null for non-matching URI pattern', () => {
    const router = new UriRouter();
    register(router, 'iev');

    expect(router.resolveUri('https://example.com/other')).toBeNull();
  });

  it('builds URIs from register and concept ID', () => {
    const router = new UriRouter();
    register(router, 'iev');
    expect(router.buildUri('iev', '103-01-02')).toBe('https://glossarist.org/iev/concept/103-01-02');
  });

  it('lists all registered IDs', () => {
    const router = new UriRouter();
    register(router, 'iev');
    register(router, 'isotc211');

    expect(router.getRegisteredIds()).toEqual(['iev', 'isotc211']);
  });

  it('resolves across multiple registers', () => {
    const router = new UriRouter();
    register(router, 'iev');
    register(router, 'isotc211');
    register(router, 'isotc204');

    expect(router.resolveUri('https://glossarist.org/iev/concept/102-01-01')?.registerId).toBe('iev');
    expect(router.resolveUri('https://glossarist.org/isotc211/concept/10')?.registerId).toBe('isotc211');
    expect(router.resolveUri('https://glossarist.org/isotc204/concept/3.1.1.1')?.registerId).toBe('isotc204');
  });

  it('resolves URN patterns with wildcard', () => {
    const router = new UriRouter();
    router.registerDataset('iso-10303', '', '', ['urn:iso:std:iso:10303:*']);

    const resolved = router.resolveUri('urn:iso:std:iso:10303:3.1.1.1');
    expect(resolved).toEqual({ registerId: 'iso-10303', conceptId: '3.1.1.1' });
  });

  it('resolves URN prefix to registerId', () => {
    const router = new UriRouter();
    router.registerDataset('iso-10303', '', '', ['urn:iso:std:iso:10303:*']);

    expect(router.resolveUrn('urn:iso:std:iso:10303')).toBe('iso-10303');
    expect(router.resolveUrn('urn:unknown:prefix')).toBeNull();
  });

  it('returns uriBase for registered dataset', () => {
    const router = new UriRouter();
    register(router, 'iev');
    expect(router.getUriBase('iev')).toBe(URI_BASE);
    expect(router.getUriBase('unknown')).toBe('');
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

  describe('SSOT: UriRouter.buildConceptUri is the single concept-URI constructor', () => {
    // Per AUDIT-2026-07-29 P1-1: ConceptIdentity, the conceptUri()
    // bridge, and UriRouter.buildConceptUri must all funnel through
    // UriRouter.buildConceptUri. No inline template literals for
    // `${uriBase}/${registerId}/concept/${id}` outside UriRouter.

    it('UriRouter.buildConceptUri constructs the canonical URI', () => {
      expect(UriRouter.buildConceptUri('https://x.org', 'vim', '1.3'))
        .toBe('https://x.org/vim/concept/1.3');
    });

    it('UriRouter.buildDomainUri constructs the canonical domain URI', () => {
      expect(UriRouter.buildDomainUri('https://x.org', 'vim', 'physics'))
        .toBe('https://x.org/vim/domain/physics');
    });

    it('ConceptIdentity.uri delegates to UriRouter.buildConceptUri', async () => {
      const { ConceptIdentity } = await import('../adapters/concept-identity');
      const id = new ConceptIdentity('1.3', 'vim', 'https://x.org');
      expect(id.uri).toBe(UriRouter.buildConceptUri('https://x.org', 'vim', '1.3'));
    });

    it('ConceptIdentity.domainUri delegates to UriRouter.buildDomainUri', async () => {
      const { ConceptIdentity } = await import('../adapters/concept-identity');
      const id = new ConceptIdentity('1.3', 'vim', 'https://x.org');
      expect(id.domainUri('physics')).toBe(UriRouter.buildDomainUri('https://x.org', 'vim', 'physics'));
    });
  });
});
