/**
 * Concept URI construction — single source of truth.
 *
 * Previously duplicated in:
 *   scripts/generate-data.ts
 *   scripts/bridge-to-astro.ts
 *   scripts/build-edges.ts
 *
 * DRY: all three now import from here.
 *
 * The /dataset/ segment matches the Vue Router route pattern
 * /dataset/:register/concept/:conceptId used by the deployed SPA.
 */

export function buildConceptUri(uriBase: string, registerId: string, conceptId: string | number): string {
  return `${uriBase}/dataset/${registerId}/concept/${conceptId}`;
}

/** Prefix of every concept URI of a register (for keying node maps and
 *  matching edge endpoints against a register's URI space). */
export function buildConceptUriPrefix(uriBase: string, registerId: string): string {
  return `${uriBase}/dataset/${registerId}/concept/`;
}

/** Prefix of any URI belonging to a register (for the cross-ref index). */
export function buildDatasetUriPrefix(uriBase: string, registerId: string): string {
  return `${uriBase}/dataset/${registerId}/`;
}
