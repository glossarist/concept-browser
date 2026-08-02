/**
 * Concept URI construction — single source of truth.
 *
 * Previously duplicated in:
 *   scripts/generate-data.ts
 *   scripts/bridge-to-astro.ts
 *   scripts/build-edges.ts
 *
 * DRY: all three now import from here.
 */

export function buildConceptUri(uriBase: string, registerId: string, conceptId: string | number): string {
  return `${uriBase}/${registerId}/concept/${conceptId}`;
}
