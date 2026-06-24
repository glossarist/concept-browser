/**
 * Normalize bibliography data into the { bibliography: [...] } shape
 * expected by BibliographyData.fromJSON.
 *
 * Accepts either:
 *   - A bare array of entries (the canonical YAML source form).
 *   - An already-wrapped { bibliography: [...] } object.
 *   - Anything else (treated as empty).
 */
export function normalizeBibliography(raw) {
  if (Array.isArray(raw)) return { bibliography: raw };
  if (raw && Array.isArray(raw.bibliography)) return raw;
  return { bibliography: [] };
}
