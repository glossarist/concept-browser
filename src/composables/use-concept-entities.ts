/**
 * useConceptEntities — pulls the structural non-verbal entity refs
 * (`figures`, `tables`, `formulas`) from a Concept model instance and
 * projects them into a uniform `{ kind, entityId, display }` shape that
 * the list component can render without knowing about each kind.
 *
 * Per plan 02: structural refs live on `ManagedConceptData` (concept
 * level), not on `LocalizedConcept`. The Concept model owns the raw
 * arrays and the lazy getters that materialize them — this composable
 * is a pure projection layer, not a source of truth.
 *
 * MECE: this composable reads; it does not fetch (the resolver does),
 * does not render (the component does), and does not own the wire
 * format (the bridge does).
 */
import { computed, type ComputedRef } from 'vue';
import type { Concept } from 'glossarist';
import type { NonVerbalKind } from '../adapters/non-verbal/types';
import { anchorId } from '../utils/non-verbal-anchor';

export interface StructuralEntityRef {
  kind: NonVerbalKind;
  entityId: string;
  display: string | null;
  anchor: string;
}

const KIND_TO_CONCEPT_FIELD: Readonly<Record<NonVerbalKind, 'figures' | 'tables' | 'formulas'>> = {
  figure: 'figures',
  table: 'tables',
  formula: 'formulas',
};

/**
 * glossarist-js's published `.d.ts` omits Concept's lazy getters for
 * structural refs (`figures`, `tables`, `formulas`), but the runtime
 * exposes them per TODO.figures/02. Cast through `unknown` once at
 * this boundary so consumers see a typed shape.
 */
interface ConceptWithEntityRefs {
  readonly figures: ReadonlyArray<{ entityId: string | null; display: string | null }>;
  readonly tables: ReadonlyArray<{ entityId: string | null; display: string | null }>;
  readonly formulas: ReadonlyArray<{ entityId: string | null; display: string | null }>;
}

export function useConceptEntities(
  concept: ComputedRef<Concept>,
  datasetId: ComputedRef<string>,
): ComputedRef<StructuralEntityRef[]> {
  return computed(() => {
    const ds = datasetId.value;
    const c = concept.value as unknown as ConceptWithEntityRefs;
    const out: StructuralEntityRef[] = [];
    for (const kind of Object.keys(KIND_TO_CONCEPT_FIELD) as NonVerbalKind[]) {
      const refs = c[KIND_TO_CONCEPT_FIELD[kind]];
      if (!refs || refs.length === 0) continue;
      for (const r of refs) {
        const entityId = r.entityId;
        if (!entityId) continue;
        out.push({
          kind,
          entityId,
          display: r.display ?? null,
          anchor: anchorId(kind, ds, entityId),
        });
      }
    }
    return out;
  });
}
