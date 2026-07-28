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
 * collapses to 2-dashed = same as optional + multiple).
 *
 * Adding a new count value (e.g. 'exactly_three') is one entry —
 * no enum explosion, no switch edits.
 */

// ── Two independent axes ─────────────────────────────────────────────

export const PRESENCE_VALUES = ['required', 'optional'] as const;
export type PartitivePresence = (typeof PRESENCE_VALUES)[number];

export const COUNT_VALUES = ['exactly_one', 'at_least_one', 'multiple'] as const;
export type PartitiveCount = (typeof COUNT_VALUES)[number];

export function isPartitivePresence(v: unknown): v is PartitivePresence {
  return v === 'required' || v === 'optional';
}
export function isPartitiveCount(v: unknown): v is PartitiveCount {
  return v === 'exactly_one' || v === 'at_least_one' || v === 'multiple';
}

/**
 * Legacy 5-value multiplicity enum (pre-MECE). glossarist 0.4.24's
 * PartitiveMember still uses this internally. The bridge migrates
 * legacy ↔ MECE via LEGACY_MULTIPLICITY_TO_AXES.
 *
 * DEPRECATED — remove when glossarist-js ships MECE-native fields.
 */
export const LEGACY_MULTIPLICITY_VALUES = [
  'compulsory',
  'optional',
  'compulsory_multiple',
  'optional_multiple',
  'compulsory_at_least_one',
] as const;
export type PartitiveMultiplicity = (typeof LEGACY_MULTIPLICITY_VALUES)[number];

export const LEGACY_MULTIPLICITY_TO_AXES: Record<
  PartitiveMultiplicity,
  { presence: PartitivePresence; count: PartitiveCount }
> = {
  compulsory:               { presence: 'required', count: 'exactly_one' },
  optional:                 { presence: 'optional', count: 'exactly_one' },
  compulsory_multiple:      { presence: 'required', count: 'multiple' },
  optional_multiple:        { presence: 'optional', count: 'multiple' },
  compulsory_at_least_one:  { presence: 'required', count: 'at_least_one' },
};

export function isPartitiveMultiplicity(v: unknown): v is PartitiveMultiplicity {
  return typeof v === 'string'
    && (LEGACY_MULTIPLICITY_VALUES as readonly string[]).includes(v);
}

/**
 * Split a legacy 5-value multiplicity into the MECE 2-axis model.
 * Returns required/exactly_one for unknown values (safest default).
 */
export function splitLegacyMultiplicity(
  m: PartitiveMultiplicity,
): { presence: PartitivePresence; count: PartitiveCount } {
  return LEGACY_MULTIPLICITY_TO_AXES[m] ?? { presence: 'required', count: 'exactly_one' };
}

// ── Render-ready stroke style (derived from the two axes) ────────────

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

// ── Human-readable labels ────────────────────────────────────────────

export function presenceLabel(p: PartitivePresence): string {
  return p === 'optional' ? 'Optional' : 'Required';
}

export function countLabel(c: PartitiveCount): string {
  switch (c) {
    case 'exactly_one': return 'Exactly one';
    case 'at_least_one': return 'At least one';
    case 'multiple': return 'Multiple';
  }
}
