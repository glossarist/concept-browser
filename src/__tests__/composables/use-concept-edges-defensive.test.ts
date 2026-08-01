import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computed, ref } from 'vue';
import type { Router } from 'vue-router';
import { useConceptEdges } from '../../composables/use-concept-edges';
import { useVocabularyStore } from '../../stores/vocabulary';
import type { Manifest, GraphEdge } from '../../adapters/types';
import { makeManifest, setupPinia } from '../test-helpers';
import { getFactory, resetFactory } from '../../adapters/factory';

/**
 * Regression test for issue #171 — `TypeError: r.conceptGenericRelations.length
 * at hydration`.
 *
 * Bug (2026-08-01): on the live `glossarist/cie-eilv` deployment, every concept
 * page threw `TypeError: undefined is not an object (evaluating
 * 'r.conceptGenericRelations.length')` at hydration time. The concept detail
 * view failed to render. No unit test caught this because every existing test
 * passes a well-formed Concept instance.
 *
 * Root cause: any code path that made the `conceptGenericRelations` computed
 * throw (or made the destructured value undefined at hydration) crashed the
 * template's `v-if="conceptGenericRelations.length"` access. The fix has two
 * arms:
 *
 *   1. The composable wraps its computed getters in try/catch so a malformed
 *      concept never propagates an exception into the render path.
 *   2. The template uses `v-if="conceptGenericRelations?.length"` so an
 *      undefined destructured value is treated as "no relations" instead of
 *      throwing.
 *
 * This spec exercises the composable's defensive layer directly: malformed
 * concepts, partially-formed relations, and the null/undefined concept value
 * must all produce `[]` — never throw, never return `undefined`.
 */
describe('useConceptEdges — defensive projection (regression for #171)', () => {
  const URN_SOURCE = 'urn:glossarist:fixtures';
  const manifest: Manifest = makeManifest({
    id: 'fixtures',
    datasetUri: URN_SOURCE,
    uriBase: 'https://glossarist.org',
  });
  const noEdges: GraphEdge[] = [];
  const noopRouter = { push() {} } as unknown as Router;

  let store: ReturnType<typeof useVocabularyStore>;

  beforeEach(() => {
    setupPinia();
    resetFactory();
    store = useVocabularyStore();
    store.manifests.set(manifest.id, manifest);

    const factory = getFactory();
    factory.resolveRelatedRef = vi.fn((ref: { source: string | null; id: string | null } | null) =>
      ref?.source === URN_SOURCE && ref.id
        ? { registerId: manifest.id, conceptId: ref.id }
        : null,
    );
  });

  /**
   * The core regression: any malformed concept input must NOT propagate an
   * exception through the composable. The computed must always resolve to an
   * array (possibly empty). This is what the template's `?.length` defensive
   * access relies on — and what the prior crash violated.
   */
  it('never throws when concept.relations is malformed (issue #171)', () => {
    const malformedConcepts = [
      /* relations is undefined */
      { id: 'a', localization: () => null, languages: [], relatedConcepts: [] },
      /* relations is null */
      { id: 'b', relations: null, localization: () => null, languages: [], relatedConcepts: [] },
      /* relations contains a non-hyperedge object */
      { id: 'c', relations: [{ not: 'a relation' }], localization: () => null, languages: [], relatedConcepts: [] },
      /* relations contains a hyperedge whose comprehensive is missing */
      { id: 'd', relations: [{ members: [] }], localization: () => null, languages: [], relatedConcepts: [] },
      /* relations contains a hyperedge with null members */
      { id: 'e', relations: [{ comprehensive: { source: URN_SOURCE, id: '1.1' }, members: null }], localization: () => null, languages: [], relatedConcepts: [] },
      /* the concept itself is an empty object */
      {} as any,
    ];

    for (const concept of malformedConcepts) {
      const { conceptPartitiveRelations, conceptGenericRelations, conceptRelated } = useConceptEdges(
        computed(() => concept),
        computed(() => 'fixtures'),
        computed(() => manifest),
        computed(() => noEdges),
        noopRouter,
      );
      /* Each computed must resolve without throwing. */
      expect(() => conceptPartitiveRelations.value).not.toThrow();
      expect(() => conceptGenericRelations.value).not.toThrow();
      expect(() => conceptRelated.value).not.toThrow();
      /* And must produce an array (never undefined). */
      expect(Array.isArray(conceptPartitiveRelations.value)).toBe(true);
      expect(Array.isArray(conceptGenericRelations.value)).toBe(true);
      expect(Array.isArray(conceptRelated.value)).toBe(true);
    }
  });

  it('returns a complete return shape — every key always present', () => {
    /* The original issue text hypothesized an early-return path that omitted
       `conceptGenericRelations`. Pin the contract: every documented key is
       present in the return object, regardless of input. */
    const result = useConceptEdges(
      ref(null) as any,
      computed(() => 'fixtures'),
      computed(() => manifest),
      computed(() => noEdges),
      noopRouter,
    );
    const requiredKeys = [
      'conceptUriValue',
      'outgoingEdges',
      'incomingEdges',
      'edgeDisplayCache',
      'getEdgeDisplay',
      'designationFor',
      'edgeBadgeColor',
      'inverseEdgeType',
      'conceptRelated',
      'conceptPartitiveRelations',
      'conceptGenericRelations',
      'resolveRelatedRef',
      'getResolvedRef',
      'relatedLabel',
      'navigateEdge',
      'navigateRelated',
    ] as const;
    for (const key of requiredKeys) {
      expect(result, `missing key: ${key}`).toHaveProperty(key);
      expect(result[key as keyof typeof result], `undefined value for key: ${key}`).toBeDefined();
    }
  });

  it('returns [] (not undefined) when concept.relations entries throw on instanceof check', () => {
    /* Simulate the failure mode where a bundled class import ends up undefined
       at hydration — `r instanceof undefined` throws. The composable's try/catch
       must swallow it and yield []. */
    const Bomb = function () {} as any;
    Object.defineProperty(Bomb.prototype, Symbol.hasInstance, {
      value: () => { throw new Error('simulated instanceof failure'); },
    });
    const concept = {
      id: 'bomb',
      relations: [new Bomb()],
      localization: () => null,
      languages: [],
      relatedConcepts: [],
    };
    const { conceptGenericRelations, conceptPartitiveRelations } = useConceptEdges(
      computed(() => concept),
      computed(() => 'fixtures'),
      computed(() => manifest),
      computed(() => noEdges),
      noopRouter,
    );
    expect(() => conceptGenericRelations.value).not.toThrow();
    expect(() => conceptPartitiveRelations.value).not.toThrow();
    expect(conceptGenericRelations.value).toEqual([]);
    expect(conceptPartitiveRelations.value).toEqual([]);
  });
});
