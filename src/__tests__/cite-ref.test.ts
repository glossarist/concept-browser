import { describe, it, expect } from 'vitest';
import { parseMention } from 'glossarist';

describe('parseMention — cite-ref detection', () => {
  it('parses cite:key form', () => {
    const result = parseMention('cite:iso-10303-2');
    expect(result.kind).toBe('cite-ref');
    expect(result.key).toBe('iso-10303-2');
    expect(result.label).toBeNull();
  });

  it('parses cite:key,label form', () => {
    const result = parseMention('cite:vim-term,entity data type');
    expect(result.kind).toBe('cite-ref');
    expect(result.key).toBe('vim-term');
    expect(result.label).toBe('entity data type');
  });

  it('parses cite:key with quoted label', () => {
    const result = parseMention('cite:foo,"quoted, label"');
    expect(result.kind).toBe('cite-ref');
    expect(result.key).toBe('foo');
    expect(result.label).toBe('quoted, label');
  });

  it('parses bare numeric id as numeric', () => {
    const result = parseMention('3.1.1');
    expect(result.kind).toBe('numeric');
    expect(result.id).toBe('3.1.1');
  });

  it('parses dashed numeric id as numeric', () => {
    const result = parseMention('103-01-02');
    expect(result.kind).toBe('numeric');
    expect(result.id).toBe('103-01-02');
  });

  it('classifies URN mentions as urn-ref (glossarist >= 0.3.7)', () => {
    const result = parseMention('urn:iso:std:iso:10303:-2:ed-1:en:term:foo,bar');
    expect(result.kind).toBe('urn-ref');
    expect(result.uri).toBe('urn:iso:std:iso:10303:-2:ed-1:en:term:foo');
    expect(result.label).toBe('bar');
  });

  it('classifies IEV-style mentions as designation (glossarist >= 0.3.7)', () => {
    const result = parseMention('term, IEV:103-01-02');
    expect(result.kind).toBe('designation');
    expect(result.id).toBe('term');
    expect(result.label).toBe('IEV:103-01-02');
  });
});

describe('extractInlineRefs — cite-ref integration', () => {
  // Test the build-time extractInlineRefs function indirectly by
  // verifying parseMention handles the forms the build script uses.
  it('cite:key with trailing comma and empty label', () => {
    const result = parseMention('cite:foo,');
    expect(result.kind).toBe('cite-ref');
    expect(result.key).toBe('foo');
  });

  it('cite:key without comma has no label', () => {
    const result = parseMention('cite:bar');
    expect(result.kind).toBe('cite-ref');
    expect(result.key).toBe('bar');
    expect(result.label).toBeNull();
  });
});

describe('ReferenceResolver — resolveCite integration', () => {
  it('resolves cite-ref citation with source match to internal', async () => {
    const { ReferenceResolver } = await import('../adapters/ReferenceResolver');
    const { UriRouter } = await import('../adapters/UriRouter');
    const uriRouter = new UriRouter();
    const resolver = new ReferenceResolver(uriRouter);
    uriRouter.registerDataset('vim-2012', '', '', ['urn:oiml:pub:v:2:2012*']);
    resolver.registerSourceRef('VIM', 'vim-2012', 'urn:oiml:pub:v:2:2012');

    const citation = {
      ref: { source: 'VIM' },
      locality: { type: 'definition', reference_from: '2.2' },
    };

    const result = resolver.resolveCite(citation);
    expect(result.classification).toBe('internal-citation');
    expect(result.resolved).toEqual({ registerId: 'vim-2012', conceptId: '2.2' });
  });

  it('classifies citation with link but no resolution as self-contained', async () => {
    const { ReferenceResolver } = await import('../adapters/ReferenceResolver');
    const { UriRouter } = await import('../adapters/UriRouter');
    const resolver = new ReferenceResolver(new UriRouter());

    const citation = {
      ref: { source: 'Unknown' },
      locality: null,
      link: 'https://example.com',
    };

    const result = resolver.resolveCite(citation);
    expect(result.classification).toBe('self-contained-citation');
  });

  it('classifies citation without ref source as unresolved', async () => {
    const { ReferenceResolver } = await import('../adapters/ReferenceResolver');
    const { UriRouter } = await import('../adapters/UriRouter');
    const resolver = new ReferenceResolver(new UriRouter());

    const result = resolver.resolveCite({ ref: null, locality: null });
    expect(result.classification).toBe('unresolved-citation');
  });
});
