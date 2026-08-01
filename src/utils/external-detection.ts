/**
 * External concept detection — ISO 704:2022 external concepts.
 *
 * The detection logic now lives upstream in glossarist@0.4.52 — this
 * file is a thin re-export so consumers don't have to know which package
 * the functions live in. The signature is also richer upstream: it
 * understands `MemberLike` (with nested `.ref`) and `HyperedgeLike`
 * shapes, matching the actual glossarist-js model.
 *
 * The only thing kept locally is `formatExternalLabel` — it's a pure
 * UI concern (parentheses per ISO 704 §5.5.4.3.1) and doesn't belong
 * in the model library.
 *
 * ISO 704:2022 §5.5.4.3.1: external concepts are shown in parentheses
 * with a dashed border in diagrams.
 */

import {
  isExternalConcept,
  isExternalMember as glsIsExternalMember,
  isExternalComprehensive as glsIsExternalComprehensive,
  getExternalMembers as glsGetExternalMembers,
  hasProvidedBy,
  hasDanglingExternal as glsHasDanglingExternal,
} from 'glossarist';
import type {
  ExternalConceptLike,
  ConceptStore,
} from 'glossarist';

export type {
  ExternalConceptLike,
  ConceptStore,
};

export {
  isExternalConcept,
  hasProvidedBy,
};

/**
 * Defensive wrappers around the upstream hyperedge-aware queries.
 * glossarist@0.4.52 throws on null `store` (it indexes into it
 * unconditionally). UI consumers may have no store available (e.g.,
 * during initial render before the vocabulary store is loaded) —
 * return false / [] instead of propagating the throw.
 */
export function isExternalMember(
  member: { ref?: unknown } | null | undefined,
  store: ConceptStore | null | undefined,
): boolean {
  if (!member || !store) return false;
  return glsIsExternalMember(member as Parameters<typeof glsIsExternalMember>[0], store);
}

export function isExternalComprehensive(
  hyperedge: { comprehensive?: unknown; members?: readonly unknown[] },
  store: ConceptStore | null | undefined,
): boolean {
  if (!hyperedge || !store) return false;
  return glsIsExternalComprehensive(
    hyperedge as Parameters<typeof glsIsExternalComprehensive>[0],
    store,
  );
}

export function getExternalMembers(
  hyperedge: { comprehensive?: unknown; members?: readonly unknown[] },
  store: ConceptStore | null | undefined,
): { ref?: unknown }[] {
  if (!hyperedge || !store) return [];
  return glsGetExternalMembers(
    hyperedge as Parameters<typeof glsGetExternalMembers>[0],
    store,
  );
}

export function hasDanglingExternal(
  hyperedge: { comprehensive?: unknown; members?: readonly unknown[] },
  store: ConceptStore | null | undefined,
): boolean {
  if (!hyperedge || !store) return false;
  return glsHasDanglingExternal(
    hyperedge as Parameters<typeof glsHasDanglingExternal>[0],
    store,
  );
}

/**
 * Format a label for an external concept — parenthetical per ISO 704.
 * Returns `"(label)"` for external concepts, `label` for internal.
 *
 * Kept locally because it's a pure UI concern (rendering decision), not
 * a model-layer classification.
 */
export function formatExternalLabel(
  label: string,
  isExternal: boolean,
): string {
  return isExternal ? `(${label})` : label;
}
