/**
 * ISO 704:2022 §5.5.4.2 — partitive multiplicity model (MECE).
 *
 * Two independent axes:
 *
 *   presence: 'required' | 'optional'
 *     Is this part always present?
 *
 *   count: 'exactly_one' | 'at_least_one' | 'multiple'
 *     How many instances?
 *
 * 6 combinations, 5 visually distinct (optional + at_least_one
 * collapses to 2-dashed = same as optional + multiple) and the
 * invalid combo (optional, at_least_one) is rejected at construction
 * by glossarist-js.
 *
 * Types are re-exported from glossarist-js — the model is the SSOT.
 * The render-ready `rakeStrokeStyle(presence, count, isDelimiting)`
 * helper is purely a browser-rendering concern; everything else
 * (presence, count, is_delimiting fields, MULTIPLICITY name lookup via
 * multiplicityFromPair, validity via isValidPresence / isValidCount)
 * comes from `glossarist/models`.
 */

import {
  PARTITIVE_PRESENCE,
  PARTITIVE_COUNT,
  multiplicityFromPair,
  isValidPresence,
  isValidCount,
  type PartitivePresence,
  type PartitiveCount,
} from 'glossarist/models';

// ── Two independent axes (re-exported SSOT) ────────────────────────────

export { PARTITIVE_PRESENCE, PARTITIVE_COUNT };
export type { PartitivePresence, PartitiveCount };
export { isValidPresence as isPartitivePresence, isValidCount as isPartitiveCount };

/** ISO 704 name for a (presence, count) pair. Throws on invalid combos. */
export const partitiveMultiplicityName = multiplicityFromPair;

// ── Render-ready stroke style (rendering-only concern) ─────────────────

export interface RakeStrokeStyle {
  readonly lineCount: 1 | 2;
  readonly primaryDashed: boolean;
  readonly secondaryDashed: boolean;
  readonly strokeWidth: number;
}

export const NORMAL_STROKE_WIDTH = 1.5;
export const DELIMITING_STROKE_WIDTH = 4.5;

/**
 * Compute the render-ready stroke style.
 *
 * Pure function — consumed by both the sidebar rake diagram
 * (PartitiveRelationDiagram) and the sphere rake bundles
 * (RelationSphere.drawRakeBundles).
 *
 * Derivation:
 *   presence=required  → primary line is solid
 *   presence=optional  → primary line is dashed
 *   count=exactly_one  → 1 line
 *   count=multiple     → 2 lines, both same style as primary
 *   count=at_least_one → 2 lines: primary + dashed ("possibly more")
 */
export function rakeStrokeStyle(
  presence: PartitivePresence,
  count: PartitiveCount,
  isDelimiting: boolean,
): RakeStrokeStyle {
  const primaryDashed = presence === 'optional';
  const width = isDelimiting ? DELIMITING_STROKE_WIDTH : NORMAL_STROKE_WIDTH;

  if (count === 'exactly_one') {
    return { lineCount: 1, primaryDashed, secondaryDashed: false, strokeWidth: width };
  }
  // multiple or at_least_one
  const secondaryDashed = count === 'at_least_one' ? true : primaryDashed;
  return { lineCount: 2, primaryDashed, secondaryDashed, strokeWidth: width };
}

// ── Human-readable labels (UI concern) ────────────────────────────────

export function presenceLabel(p: PartitivePresence): string {
  return p === 'optional' ? 'Optional' : 'Required';
}

export function countLabel(c: PartitiveCount): string {
  switch (c) {
    case 'exactly_one': return 'Exactly one';
    case 'at_least_one': return 'At least one';
    case 'multiple': return 'Multiple';
    default: return '';
  }
}
