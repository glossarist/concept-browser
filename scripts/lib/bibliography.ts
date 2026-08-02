/**
 * Normalize bibliography data into the { bibliography: [...] } shape
 * expected by BibliographyData.fromJSON.
 *
 * Accepts either:
 *   - A bare array of entries (the canonical YAML source form).
 *   - An already-wrapped { bibliography: [...] } object.
 *   - Anything else (treated as empty).
 *
 * Ported from origin/fix/bibliography-yaml-array-wrap (2026-06-25).
 * That branch fell 153 commits behind main and was deleted in the
 * 2026-07-29 stale-branch purge; this is the unmerged work.
 */
export function normalizeBibliography(raw) {
  if (Array.isArray(raw)) return { bibliography: raw };
  if (raw && Array.isArray(raw.bibliography)) return raw;
  return { bibliography: [] };
}
