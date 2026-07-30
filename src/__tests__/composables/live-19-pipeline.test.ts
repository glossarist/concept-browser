import { describe, it, expect, beforeEach, vi } from 'vitest';
import { computed } from 'vue';
import type { Router } from 'vue-router';
import { useConceptEdges } from '../../composables/use-concept-edges';
import { useVocabularyStore } from '../../stores/vocabulary';
import { conceptFromJson } from '../../adapters/model-bridge';
import type { Manifest, GraphEdge } from '../../adapters/types';
import { makeManifest, setupPinia } from '../test-helpers';
import { getFactory, resetFactory } from '../../adapters/factory';

/**
 * End-to-end pipeline test using the actual live JSON-LD shape from
 * the deployed oimlsmart/vocab site (vim-2012 concept 1.9).
 *
 * Reproduces the live bug: 1.9 has gl:genericRelations but the sphere
 * renders nothing because conceptGenericRelations is empty.
 */
describe('1.9 live pipeline — generic projection through model-bridge', () => {
  const URN = 'urn:oiml:pub:v:2:2012';
  const manifest: Manifest = makeManifest({
    id: 'vim-2012',
    datasetUri: URN,
    uriBase: 'https://oimlsmart.github.io/vocab',
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
      ref?.source === URN && ref.id
        ? { registerId: manifest.id, conceptId: ref.id }
        : null,
    );
  });

  it('projects gl:genericRelations → conceptGenericRelations through conceptFromJson', () => {
    const liveJson = {
      '@context': 'https://glossarist.org/ns/context.jsonld',
      '@id': 'https://oimlsmart.github.io/vocab/vim-2012/concept/1.9',
      '@type': 'gl:Concept',
      'gl:identifier': '1.9',
      'gl:status': 'valid',
      'gl:localizedConcept': {
        eng: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'eng',
          'gl:entryStatus': 'valid',
          'gl:designation': [{ '@type': 'gl:Expression', 'gl:normativeStatus': 'preferred', 'gl:term': 'measurement unit' }],
          'gl:definition': [{ '@type': 'gl:DetailedDefinition', 'gl:content': 'real scalar quantity' }],
        },
      },
      'gl:related': [
        { '@type': 'gl:RelatedConcept', 'gl:relationshipType': 'broader_generic',
          'gl:ref': { '@type': 'gl:ConceptRef', 'gl:source': URN, 'gl:id': '1.12' } },
      ],
      'gl:genericRelations': [
        {
          '@type': 'gl:GenericRelation',
          'gl:comprehensive': { '@type': 'gl:ConceptRef', 'gl:source': URN, 'gl:id': '1.9' },
          'gl:criterion': { eng: 'by magnitude relationship to a reference measurement unit' },
          'gl:hasGeneric': [
            { '@type': 'gl:GenericMember',
              'gl:ref': { '@type': 'gl:ConceptRef', 'gl:source': URN, 'gl:id': '1.17' },
              'gl:presence': 'required', 'gl:count': 'at_least_one',
              'gl:delimitingCharacteristic': { eng: 'multiple of a unit' } },
            { '@type': 'gl:GenericMember',
              'gl:ref': { '@type': 'gl:ConceptRef', 'gl:source': URN, 'gl:id': '1.18' },
              'gl:presence': 'required', 'gl:count': 'at_least_one',
              'gl:delimitingCharacteristic': { eng: 'submultiple of a unit' } },
            { '@type': 'gl:GenericMember',
              'gl:ref': { '@type': 'gl:ConceptRef', 'gl:source': URN, 'gl:id': '1.12' },
              'gl:presence': 'required', 'gl:count': 'at_least_one',
              'gl:delimitingCharacteristic': { eng: 'coherent derived unit' } },
          ],
          'gl:completeness': 'partial',
        },
      ],
    };

    const concept = conceptFromJson(liveJson as any);

    /* Sanity: model-bridge produced a Concept with relations. */
    expect(concept).toBeTruthy();

    /* Project through useConceptEdges, exactly as ConceptView does. */
    const { conceptGenericRelations } = useConceptEdges(
      computed(() => concept),
      computed(() => 'vim-2012'),
      computed(() => manifest),
      computed(() => noEdges),
      noopRouter,
    );

    const rels = conceptGenericRelations.value;
    /* This is the live-bug assertion: must NOT be empty. */
    expect(rels).toHaveLength(1);
    expect(rels[0].members).toHaveLength(3);
    expect(rels[0].members.map(m => m.uri)).toEqual([
      'https://oimlsmart.github.io/vocab/vim-2012/concept/1.17',
      'https://oimlsmart.github.io/vocab/vim-2012/concept/1.18',
      'https://oimlsmart.github.io/vocab/vim-2012/concept/1.12',
    ]);
  });
});
