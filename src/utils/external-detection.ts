/**
 * External concept detection — ISO 704:2022 external concepts.
 *
 * An "external concept" is one referenced from this dataset but defined
 * elsewhere (status: 'external'). In diagrams, external concepts are
 * shown in parentheses with a dashed border per ISO 704:2022 §5.5.4.3.1.
 *
 * Detection requires concept resolution (looking up the referenced
 * concept's status), which is a consumer concern — the model itself
 * stays pure. These utility functions take a conceptStore/lookup
 * callback provided by the caller.
 */

export interface ConceptLike {
  status?: string | null;
  relatedConcepts?: ReadonlyArray<{ type?: string | null }>;
}

export interface ConceptStoreLike {
  lookup(ref: { source?: string | null; id?: string | null }): ConceptLike | null;
}

export interface RefLike {
  source?: string | null;
  id?: string | null;
}

/**
 * Check if a member's concept resolves to status: external.
 */
export function isExternalConcept(
  ref: RefLike | null | undefined,
  store: ConceptStoreLike | null | undefined,
): boolean {
  if (!ref || !store) return false;
  const concept = store.lookup(ref);
  return concept?.status === 'external';
}

/**
 * Check if an external concept has a provided_by edge for resolution.
 * Without provided_by, the reference dangles — the decomposition is
 * incomplete.
 */
export function hasProvidedBy(
  ref: RefLike | null | undefined,
  store: ConceptStoreLike | null | undefined,
): boolean {
  if (!ref || !store) return false;
  const concept = store.lookup(ref);
  if (!concept?.relatedConcepts) return false;
  return concept.relatedConcepts.some(rc => rc.type === 'provided_by');
}

/**
 * Check if an external concept's reference dangles (no provided_by edge).
 */
export function isDanglingExternal(
  ref: RefLike | null | undefined,
  store: ConceptStoreLike | null | undefined,
): boolean {
  return isExternalConcept(ref, store) && !hasProvidedBy(ref, store);
}

/**
 * Format a label for an external concept — parenthetical per ISO 704.
 * Returns `"(label)"` for external concepts, `label` for internal.
 */
export function formatExternalLabel(
  label: string,
  isExternal: boolean,
): string {
  return isExternal ? `(${label})` : label;
}
