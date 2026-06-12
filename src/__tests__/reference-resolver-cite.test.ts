import { describe, it, expect, beforeEach } from 'vitest';
import { createResolverPair } from './test-helpers';

describe('ReferenceResolver — resolveCite edge cases', () => {
  let resolver: ReturnType<typeof createResolverPair>['resolver'];
  let uriRouter: ReturnType<typeof createResolverPair>['uriRouter'];

  beforeEach(() => {
    const pair = createResolverPair();
    resolver = pair.resolver;
    uriRouter = pair.uriRouter;
    uriRouter.registerDataset('vim-2012', '', '', ['urn:oiml:pub:v:2:2012*']);
    resolver.registerSourceRef('VIM', 'vim-2012', 'urn:oiml:pub:v:2:2012');
  });

  it('handles citation with camelCase locality (backward compat)', () => {
    const result = resolver.resolveCite({
      ref: { source: 'VIM' },
      locality: { referenceFrom: '2.2' } as any,
    });
    expect(result.classification).toBe('internal-citation');
    expect(result.resolved).toEqual({ registerId: 'vim-2012', conceptId: '2.2' });
  });

  it('handles citation with snake_case locality', () => {
    const result = resolver.resolveCite({
      ref: { source: 'VIM' },
      locality: { reference_from: '2.2' },
    });
    expect(result.classification).toBe('internal-citation');
    expect(result.resolved).toEqual({ registerId: 'vim-2012', conceptId: '2.2' });
  });

  it('resolves source without locality to empty conceptId (document-level)', () => {
    // When no locality is provided, the resolver resolves to the source document itself
    const result = resolver.resolveCite({
      ref: { source: 'VIM' },
      locality: null,
    });
    expect(result.classification).toBe('internal-citation');
    expect(result.resolved).not.toBeNull();
    expect(result.resolved!.registerId).toBe('vim-2012');
  });

  it('handles citation with null ref source', () => {
    const result = resolver.resolveCite({
      ref: { source: null, id: '3.1' },
      locality: null,
    });
    expect(result.classification).toBe('unresolved-citation');
  });

  it('handles undefined citation', () => {
    const result = resolver.resolveCite(undefined as any);
    expect(result.classification).toBe('unresolved-citation');
    expect(result.resolved).toBeNull();
  });

  it('classification and resolved always agree — internal implies non-null resolved', () => {
    // If classification is internal-citation, resolved must be non-null
    const internal = resolver.resolveCite({
      ref: { source: 'VIM' },
      locality: { reference_from: '2.2' },
    });
    if (internal.classification === 'internal-citation') {
      expect(internal.resolved).not.toBeNull();
    }
  });

  it('classification and resolved always agree — non-internal implies null resolved', () => {
    const external = resolver.resolveCite({
      ref: { source: 'Unknown' },
      locality: null,
    });
    if (external.classification !== 'internal-citation') {
      expect(external.resolved).toBeNull();
    }
  });

  it('resolves with sourceDatasetId for cross-dataset detection', () => {
    const result = resolver.resolveCite(
      { ref: { source: 'VIM' }, locality: { reference_from: '2.2' } },
      'vim-2012',
    );
    // Same dataset — still resolves internally
    expect(result.classification).toBe('internal-citation');
    expect(result.resolved!.registerId).toBe('vim-2012');
  });
});

describe('ReferenceResolver — URI pattern matching', () => {
  it('matches URN patterns with wildcard', () => {
    const { resolver, uriRouter } = createResolverPair();
    uriRouter.registerDataset('iso-10303', '', '', ['urn:iso:std:iso:10303:*']);

    const result = resolver.resolveReference('urn:iso:std:iso:10303:3.1.1.1');
    expect(result.type).toBe('internal');
    if (result.type === 'internal') {
      expect(result.registerId).toBe('iso-10303');
      expect(result.conceptId).toBe('3.1.1.1');
    }
  });

  it('matches HTTPS patterns with wildcard', () => {
    const { resolver, uriRouter } = createResolverPair();
    uriRouter.registerDataset('iev', '', '', ['https://glossarist.org/iev/*']);

    const result = resolver.resolveReference('https://glossarist.org/iev/concept/103-01-02');
    expect(result.type).toBe('internal');
    if (result.type === 'internal') {
      expect(result.registerId).toBe('iev');
      expect(result.conceptId).toBe('103-01-02');
    }
  });

  it('returns unresolved for unknown URIs', () => {
    const { resolver } = createResolverPair();
    const result = resolver.resolveReference('https://unknown.example.com/concept/1');
    expect(result.type).toBe('unresolved');
  });

});
