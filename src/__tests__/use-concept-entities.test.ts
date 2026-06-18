import { describe, it, expect } from 'vitest';
import { Concept } from 'glossarist';
import { computed } from 'vue';
import { useConceptEntities } from '../composables/use-concept-entities';

function makeConcept(args: {
  figures?: unknown[];
  tables?: unknown[];
  formulas?: unknown[];
}): Concept {
  return Concept.fromJSON({
    id: '2-1-145',
    localizations: { eng: { language_code: 'eng' } },
    figures: args.figures ?? [],
    tables: args.tables ?? [],
    formulas: args.formulas ?? [],
  });
}

describe('useConceptEntities', () => {
  it('returns an empty list when the concept has no structural refs', () => {
    const concept = computed(() => makeConcept({}));
    const datasetId = computed(() => 'iala-2023');
    const refs = useConceptEntities(concept, datasetId);
    expect(refs.value).toEqual([]);
  });

  it('pulls figure refs from concept.figures', () => {
    const concept = computed(() => makeConcept({
      figures: [{ ref: 'mixed-reflection' }],
    }));
    const refs = useConceptEntities(concept, computed(() => 'iala-2023'));
    expect(refs.value).toHaveLength(1);
    expect(refs.value[0]).toMatchObject({
      kind: 'figure',
      entityId: 'mixed-reflection',
      anchor: 'figure-iala-2023-mixed-reflection',
    });
  });

  it('pulls table and formula refs alongside figures', () => {
    const concept = computed(() => makeConcept({
      figures: [{ ref: 'fig-1' }],
      tables: [{ ref: 'tbl-1' }],
      formulas: [{ ref: 'fml-1' }],
    }));
    const refs = useConceptEntities(concept, computed(() => 'ds'));
    const kinds = refs.value.map(r => r.kind);
    expect(kinds).toEqual(expect.arrayContaining(['figure', 'table', 'formula']));
  });

  it('preserves display override', () => {
    const concept = computed(() => makeConcept({
      figures: [{ ref: 'dispersion-prism', display: 'Figure 3' }],
    }));
    const refs = useConceptEntities(concept, computed(() => 'ds'));
    expect(refs.value[0].display).toBe('Figure 3');
  });

  it('sets display to null when no override is provided', () => {
    const concept = computed(() => makeConcept({
      figures: [{ ref: 'foo' }],
    }));
    const refs = useConceptEntities(concept, computed(() => 'ds'));
    expect(refs.value[0].display).toBeNull();
  });

  it('recomputes when datasetId changes', () => {
    const concept = computed(() => makeConcept({
      figures: [{ ref: 'foo' }],
    }));
    const datasetId = computed(() => 'first');
    const refs = useConceptEntities(concept, datasetId);
    expect(refs.value[0].anchor).toBe('figure-first-foo');
  });
});
