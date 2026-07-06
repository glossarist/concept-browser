/**
 * Register-wins resolution for dataset content fields. Returns the
 * first non-empty value among the arguments. Empty arrays and empty
 * strings are treated as absent so a `[]` in register falls through
 * to site-config.
 *
 * Used by generate-data.mjs to apply a single, uniform precedence
 * rule across all dataset metadata fields (TODO.refactor/38).
 */

export function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === 'string' && v === '') continue;
    return v;
  }
  return undefined;
}
