import { describe, it, expect, beforeEach } from 'vitest';
import { createResolverPair } from './test-helpers';
import type { ReferenceResolver } from '../adapters/ReferenceResolver';
import type { UriRouter } from '../adapters/UriRouter';

describe('ReferenceResolver', () => {
  let resolver: ReferenceResolver;
  let uriRouter: UriRouter;

  beforeEach(() => {
    const pair = createResolverPair();
    resolver = pair.resolver;
    uriRouter = pair.uriRouter;
  });

  describe('resolveReference', () => {
    it('resolves internal URI for provided dataset', () => {
      uriRouter.registerDataset('isotc204', '', '', ['urn:iso:std:iso:14812:*', 'https://glossarist.org/isotc204/*']);
      const result = resolver.resolveReference('https://glossarist.org/isotc204/concept/3.1.1.1');
      expect(result).toEqual({
        type: 'internal',
        registerId: 'isotc204',
        conceptId: '3.1.1.1',
        crossDataset: false,
      });
    });

    it('resolves URN to internal for provided dataset', () => {
      uriRouter.registerDataset('isotc204', '', '', ['urn:iso:std:iso:14812:*']);
      const result = resolver.resolveReference('urn:iso:std:iso:14812:3.1.1.1');
      expect(result).toEqual({
        type: 'internal',
        registerId: 'isotc204',
        conceptId: '3.1.1.1',
        crossDataset: false,
      });
    });

    it('sets crossDataset=true when source dataset differs', () => {
      uriRouter.registerDataset('iev', '', '', ['urn:iec:std:iec:60050:*']);
      uriRouter.registerDataset('isotc204', '', '', ['urn:iso:std:iso:14812:*']);
      const result = resolver.resolveReference('urn:iec:std:iec:60050:103-01-02', 'isotc204');
      expect(result).toEqual({
        type: 'internal',
        registerId: 'iev',
        conceptId: '103-01-02',
        crossDataset: true,
      });
    });

    it('resolves to site via routing table', () => {
      resolver.loadRouting([
        {
          uri: 'https://glossarist.org/iev/*',
          type: 'site',
          baseUrl: 'https://www.geolexica.org',
          label: 'Geolexica Hub',
        },
      ]);
      const result = resolver.resolveReference('https://glossarist.org/iev/concept/103-01-02');
      expect(result).toEqual({
        type: 'site',
        baseUrl: 'https://www.geolexica.org',
        conceptUri: 'https://glossarist.org/iev/concept/103-01-02',
        label: 'Geolexica Hub',
      });
    });

    it('resolves to url via routing table with {conceptId} substitution', () => {
      resolver.loadRouting([
        {
          uri: 'urn:iec:std:iec:60050:*',
          type: 'url',
          url: 'https://electropedia.org/iev/iev.nsf/display?openform&ievref={conceptId}',
          label: 'IEC Electropedia',
        },
      ]);
      const result = resolver.resolveReference('urn:iec:std:iec:60050:103-01-02');
      expect(result).toEqual({
        type: 'url',
        url: 'https://electropedia.org/iev/iev.nsf/display?openform&ievref=103-01-02',
        label: 'IEC Electropedia',
      });
    });

    it('resolves to url without conceptId placeholder', () => {
      resolver.loadRouting([
        {
          uri: 'https://glossarist.org/legacy/*',
          type: 'url',
          url: 'https://example.com/obp/concepts',
          label: 'Legacy concepts',
        },
      ]);
      const result = resolver.resolveReference('https://glossarist.org/legacy/concept/123');
      expect(result).toEqual({
        type: 'url',
        url: 'https://example.com/obp/concepts',
        label: 'Legacy concepts',
      });
    });

    it('prefers provided dataset over routing', () => {
      uriRouter.registerDataset('iev', '', '', ['urn:iec:std:iec:60050:*']);
      resolver.loadRouting([
        {
          uri: 'urn:iec:std:iec:60050:*',
          type: 'url',
          url: 'https://electropedia.org/{conceptId}',
          label: 'External',
        },
      ]);
      const result = resolver.resolveReference('urn:iec:std:iec:60050:103-01-02');
      expect(result.type).toBe('internal');
    });

    it('returns unresolved for unknown URIs', () => {
      const result = resolver.resolveReference('https://glossarist.org/unknown/concept/123');
      expect(result).toEqual({ type: 'unresolved', uri: 'https://glossarist.org/unknown/concept/123' });
    });

    it('returns unresolved for non-matching URNs', () => {
      const result = resolver.resolveReference('urn:other:scheme:123');
      expect(result).toEqual({ type: 'unresolved', uri: 'urn:other:scheme:123' });
    });
  });
});
