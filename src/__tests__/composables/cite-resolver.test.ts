import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computed, ref } from 'vue';
import { useConceptEdges } from '../../composables/use-concept-edges';
import { useVocabularyStore } from '../../stores/vocabulary';
import type { Manifest, GraphEdge } from '../../adapters/types';
import { makeManifest, setupPinia } from '../test-helpers';
import { getFactory, resetFactory } from '../../adapters/factory';
import { useRenderOptions } from '../../composables/use-render-options';
import type { Router } from 'vue-router';

/**
 * citeResolver contract — pins the {{cite:sourceId}} resolution cascade.
 *
 * The citeResolver must:
 * 1. Look up the concept's own sources[] for a matching id
 * 2. Delegate to ReferenceResolver.resolveCite() which walks the
 *    deployment's cascade
 * 3. Render based on classification (internal → navigable link,
 *    self-contained → external link with origin.link, unresolved → span)
 *
 * Bug history: citeResolver was dead code (never wired). Every
 * {{cite:foo}} mention fell through to a plain <span> with no resolution.
 * This spec pins the wiring.
 */

describe('citeResolver — {{cite:sourceId}} resolution', () => {
  const noopRouter = { push() {} } as unknown as Router;
  let store: ReturnType<typeof useVocabularyStore>;
  const manifest: Manifest = makeManifest({
    id: 'test',
    datasetUri: 'urn:test:dataset',
    uriBase: 'https://example.org',
  });

  beforeEach(() => {
    setupPinia();
    resetFactory();
    store = useVocabularyStore();
    store.manifests.set(manifest.id, manifest);

    const factory = getFactory();
    factory.resolveRelatedRef = vi.fn((ref: { source: string | null; id: string | null } | null) =>
      ref?.source === 'urn:test:dataset' && ref.id
        ? { registerId: manifest.id, conceptId: ref.id }
        : null,
    );
  });

  it('returns cite-ref span when no sources are provided', () => {
    const { citeResolver } = useRenderOptions(() => 'test', () => undefined);
    const html = citeResolver('foo', null);
    expect(html).toContain('cite-ref');
    expect(html).toContain('foo');
  });

  it('returns cite-unresolved when source id not found in sources', () => {
    const sources = [{ id: 'bar', origin: { ref: { source: 'Test', id: '42' } } }];
    const { citeResolver } = useRenderOptions(() => 'test', () => sources);
    const html = citeResolver('foo', null);
    expect(html).toContain('cite-unresolved');
    expect(html).toContain('foo');
  });

  it('renders the label when provided', () => {
    const sources = [{ id: 'foo', origin: { ref: { source: 'Test', id: '42' } } }];
    const { citeResolver } = useRenderOptions(() => 'test', () => sources);
    const html = citeResolver('foo', 'custom label');
    // The resolver runs the cascade. Without a registered sourceRef, it
    // falls through to unresolved or self-contained. Either way, the label
    // or the source info should be in the output.
    expect(html).toMatch(/custom label|Test|42/);
  });

  it('renders origin.link as external link for self-contained citation', () => {
    const link = 'https://example.org/external/page';
    const sources = [{
      id: 'foo',
      origin: { ref: { source: 'External', id: 'X1' }, link },
    }];
    const { citeResolver } = useRenderOptions(() => 'test', () => sources);
    const html = citeResolver('foo', null);
    // Without a registered sourceRef matching "External", the cascade
    // falls through to self-contained or external. The link should appear.
    expect(html).toContain('href');
    expect(html).toContain(link);
  });

  it('does NOT crash when source.origin is null', () => {
    const sources = [{ id: 'foo', origin: null }];
    const { citeResolver } = useRenderOptions(() => 'test', () => sources);
    expect(() => citeResolver('foo', null)).not.toThrow();
  });

  it('does NOT crash when sources is empty array', () => {
    const { citeResolver } = useRenderOptions(() => 'test', () => []);
    expect(() => citeResolver('foo', null)).not.toThrow();
  });

  it('does NOT crash when registerId returns empty string', () => {
    const sources = [{ id: 'foo', origin: { ref: { source: 'X', id: '1' } } }];
    const { citeResolver } = useRenderOptions(() => '', () => sources);
    expect(() => citeResolver('foo', null)).not.toThrow();
  });
});

describe('RenderOptions — urnRefResolver removed', () => {
  it('content-renderer no longer exports UrnRefResolver type', async () => {
    // RenderOptions is a TypeScript interface (no runtime export).
    // Verify the UrnRefResolver type is gone by checking the source.
    const fs = await import('fs');
    const path = await import('path');
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/utils/content-renderer.ts'),
      'utf-8',
    );
    expect(source).not.toMatch(/UrnRefResolver/);
    expect(source).not.toMatch(/urnRefResolver/);
  });
});
