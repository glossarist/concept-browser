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
