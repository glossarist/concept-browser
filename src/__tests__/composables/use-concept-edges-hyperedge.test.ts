import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computed, ref } from 'vue';
import type { Router } from 'vue-router';
import { useConceptEdges } from '../../composables/use-concept-edges';
import { useVocabularyStore } from '../../stores/vocabulary';
import type { Manifest, GraphEdge } from '../../adapters/types';
import { makeManifest, setupPinia } from '../test-helpers';
import { fixtureByName } from '../__fixtures__/concepts';
import { getFactory, resetFactory } from '../../adapters/factory';

/**
 * Regression test for the sphere-view hyperedge projection.
 *
 * Bug (2026-07-30): ConceptView.vue read `concept.partitiveRelations`
 * — a field glossarist 0.4.34 REMOVED. The field was silently
 * `undefined`, the sphere rendered no rake, and no test caught it.
 *
 * Fix: ConceptView consumes `useConceptEdges.conceptPartitiveRelations`,
 * which reads the unified `concept.relations` array and filters by
 * `instanceof PartitiveHyperedge`. This spec pins that contract —
 * if glossarist ever renames or removes `.relations`, this fails.
 */
describe('useConceptEdges — hyperedge projection (regression)', () => {
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

  it('projects a PartitiveHyperedge from concept.relations', () => {
    const { concept } = fixtureByName('with-partitive-hyperedge');
    const { conceptPartitiveRelations } = useConceptEdges(
      computed(() => concept),
      computed(() => 'fixtures'),
      computed(() => manifest),
      computed(() => noEdges),
      noopRouter,
    );

    const rels = conceptPartitiveRelations.value;
    expect(rels).toHaveLength(1);

    const [rel] = rels;
    expect(rel.comprehensive).toBe('https://glossarist.org/fixtures/concept/1.3');
    expect(rel.partitives).toHaveLength(3);
    expect(rel.partitives.map(m => m.uri)).toEqual([
      'https://glossarist.org/fixtures/concept/1.22',
      'https://glossarist.org/fixtures/concept/1.4',
      'https://glossarist.org/fixtures/concept/1.5',
    ]);
    expect(rel.partitives[1].presence).toBe('required');
    expect(rel.partitives[1].count).toBe('multiple');
  });

  it('returns [] when concept is null (loading state)', () => {
    const { conceptPartitiveRelations, conceptGenericRelations } = useConceptEdges(
      computed(() => null),
      computed(() => 'fixtures'),
      computed(() => manifest),
      computed(() => noEdges),
      noopRouter,
    );
    expect(conceptPartitiveRelations.value).toEqual([]);
    expect(conceptGenericRelations.value).toEqual([]);
  });

  it('returns [] when manifest is null', () => {
    const { concept } = fixtureByName('with-partitive-hyperedge');
    const { conceptPartitiveRelations } = useConceptEdges(
      computed(() => concept),
      computed(() => 'fixtures'),
      computed(() => null),
      computed(() => noEdges),
      noopRouter,
    );
    expect(conceptPartitiveRelations.value).toEqual([]);
  });

  it('would have caught the .partitiveRelations regression', () => {
    // Simulate the pre-fix behavior: the old code read concept.partitiveRelations
    // (undefined in glossarist 0.4.34+) and produced an empty array.
    // This spec proves the projection now reads concept.relations instead.
    const { concept } = fixtureByName('with-partitive-hyperedge');
    expect((concept as any).partitiveRelations).toBeUndefined();
    expect((concept as any).relations).toHaveLength(1);

    const { conceptPartitiveRelations } = useConceptEdges(
      computed(() => concept),
      computed(() => 'fixtures'),
      computed(() => manifest),
      computed(() => noEdges),
      noopRouter,
    );
    expect(conceptPartitiveRelations.value.length).toBe(1);
  });

  it('projects a GenericHyperedge from concept.relations', () => {
    const { concept } = fixtureByName('with-generic-hyperedge');
    const { conceptGenericRelations } = useConceptEdges(
      computed(() => concept),
      computed(() => 'fixtures'),
      computed(() => manifest),
      computed(() => noEdges),
      noopRouter,
    );

    const rels = conceptGenericRelations.value;
    expect(rels).toHaveLength(1);

    const [rel] = rels;
    expect(rel.comprehensive).toBe('https://glossarist.org/fixtures/concept/1.9');
    expect(rel.members).toHaveLength(3);
    expect(rel.members.map(m => m.uri)).toEqual([
      'https://glossarist.org/fixtures/concept/1.17',
      'https://glossarist.org/fixtures/concept/1.18',
      'https://glossarist.org/fixtures/concept/1.12',
    ]);
    /* ISO 704:2022 §5.5.4.2.1 — every generic member carries a
       delimiting characteristic. Pin the field is projected. */
    expect(rel.members[0].delimitingCharacteristic).toEqual({ eng: 'multiple of a unit' });
    expect(rel.members[1].delimitingCharacteristic).toEqual({ eng: 'submultiple of a unit' });
    expect(rel.criterion).toEqual({ eng: 'by magnitude relationship to a reference unit' });
  });
});
