/**
 * Partitive relation styling — colors and labels for one-to-many
 * partitive decompositions.
 *
 * Independent of relationship-categories.ts (which handles binary edges).
 * The visual encoding for PartitiveRelation comes from two orthogonal
 * axes per ISO 704:2022:
 *
 *   1. completeness (complete / partial) — relation-level metadata,
 *      affects overall opacity. Partial relations have a continued
 *      backline ("more exist but aren't shown").
 *   2. multiplicity + is_delimiting (per-member) — see
 *      partitive-multiplicity.ts for the registry + rakeStrokeStyle().
 *
 * This module owns:
 *   - relation-level color/badge (completeness-driven)
 *   - human-readable labels for badges
 *
 * It does NOT encode multiplicity visuals — those live in
 * partitive-multiplicity.ts (separated so renderers can consume the
 * pure rakeStrokeStyle() helper without pulling badge strings).
 */

const BASE_LIGHT = '#0d9488';
const BASE_DARK = '#2dd4bf';

export interface PartitiveRelationStyle {
  color: string;
  badgeClass: string;
  opacity: number;
}

/**
 * Relation-level style (color + opacity) driven by completeness.
 *
 * Per-member multiplicity + delimiting rendering is via
 * `rakeStrokeStyle()` from partitive-multiplicity.ts, not here —
 * this helper is for the relation's overall frame + header badges.
 */
export function partitiveRelationStyle(
  completeness: 'complete' | 'partial',
  isDark: boolean,
): PartitiveRelationStyle {
  return {
    color: isDark ? BASE_DARK : BASE_LIGHT,
    badgeClass: 'badge-teal',
    opacity: completeness === 'partial' ? 0.6 : 1.0,
  };
}

export function completenessLabel(completeness: 'complete' | 'partial'): string {
  return completeness === 'partial' ? 'Partial' : 'Complete';
}
