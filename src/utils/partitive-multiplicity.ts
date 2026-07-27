/**
 * ISO 704:2022 §5.5.4.2 — partitive multiplicity + delimiting model.
 *
 * Multiplicity (5 values) encodes part-count semantics:
 *   - compulsory          : exactly one, required
 *   - optional            : zero or one
 *   - compulsory_multiple : two or more, required
 *   - optional_multiple   : zero or more
 *   - at_least_one        : one or more (required, count unknown)
 *
 * Delimiting (boolean) is orthogonal — a delimiting part behaves like a
 * delimiting characteristic in generic relations: it distinguishes the
 * comprehensive concept from coordinate concepts. Visual encoding:
 * 3× stroke width (4.5 px vs 1.5 px).
 *
 * Adding a new multiplicity value = add one entry to PARTITIVE_MULTIPLICITY.
 * Renderers consume RakeStrokeStyle via rakeStrokeStyle(); never inspect
 * the raw multiplicity string. OCP + MECE + DRY.
 */

export const PARTITIVE_MULTIPLICITY = {
  compulsory:           { lines: 1, pattern: 'solid',  label: 'Compulsory' },
  optional:             { lines: 1, pattern: 'dashed',  label: 'Optional' },
  compulsory_multiple:  { lines: 2, pattern: 'solid',  label: 'Compulsory multiple' },
  optional_multiple:    { lines: 2, pattern: 'dashed',  label: 'Optional multiple' },
  at_least_one:         { lines: 2, pattern: 'mixed',   label: 'At least one' },
} as const;

export type PartitiveMultiplicity = keyof typeof PARTITIVE_MULTIPLICITY;

export const PARTITIVE_MULTIPLICITY_VALUES: readonly PartitiveMultiplicity[] =
  Object.keys(PARTITIVE_MULTIPLICITY) as PartitiveMultiplicity[];

export function isPartitiveMultiplicity(value: unknown): value is PartitiveMultiplicity {
  return typeof value === 'string' && value in PARTITIVE_MULTIPLICITY;
}

export type LinePattern = 'solid' | 'dashed' | 'mixed';

export interface MultiplicityDefinition {
  /** Number of parallel lines used to render the multiplicity. */
  readonly lines: 1 | 2;
  /** Dash pattern: solid, dashed, or mixed (one solid + one dashed). */
  readonly pattern: LinePattern;
  /** Human-readable label for legends and badges. */
  readonly label: string;
}

export function multiplicityDefinition(m: PartitiveMultiplicity): MultiplicityDefinition {
  return PARTITIVE_MULTIPLICITY[m];
}

// ── RakeStrokeStyle — the render-ready form consumed by all renderers ────

export interface RakeStrokeStyle {
  /** 1 or 2 parallel lines. */
  readonly lineCount: 1 | 2;
  /** Primary (always-present) line dash. */
  readonly primaryDashed: boolean;
  /** Secondary line dash (only meaningful when lineCount === 2). */
  readonly secondaryDashed: boolean;
  /** Stroke width in px. 1.5 normal, 4.5 (3×) when is_delimiting. */
  readonly strokeWidth: number;
}

export const NORMAL_STROKE_WIDTH = 1.5;
export const DELIMITING_STROKE_WIDTH = 4.5;   // 3× normal per ISO 704

/**
 * Compute the render-ready stroke style for a partitive member.
 *
 * Pure function — same inputs always yield the same RakeStrokeStyle.
 * Consumed by both the sidebar rake diagram (PartitiveRelationDiagram)
 * and the sphere rake bundles (RelationSphere.drawRakeBundles).
 */
export function rakeStrokeStyle(
  multiplicity: PartitiveMultiplicity,
  isDelimiting: boolean,
): RakeStrokeStyle {
  const def = PARTITIVE_MULTIPLICITY[multiplicity];
  return {
    lineCount: def.lines,
    primaryDashed: def.pattern === 'dashed',
    secondaryDashed: def.pattern === 'dashed' || def.pattern === 'mixed',
    strokeWidth: isDelimiting ? DELIMITING_STROKE_WIDTH : NORMAL_STROKE_WIDTH,
  };
}

// ── Migration from glossarist 0.4.20 certainty → ISO 704 multiplicity ────

/**
 * glossarist 0.4.20 carries per-member `certainty: 'confirmed' | 'possible'`
 * (a v0.4 abstraction that conflated "this member exists" with "we're sure
 * about it"). ISO 704:2022 replaces that with the multiplicity enum.
 *
 * Until glossarist publishes native multiplicity support, this helper maps
 * the legacy field to the closest ISO 704 multiplicity:
 *   - confirmed → compulsory
 *   - possible  → optional
 *
 * Once glossarist publishes multiplicity natively, the bridge can read
 * it directly and this helper can be deleted.
 */
export function multiplicityFromCertainty(certainty: 'confirmed' | 'possible' | null | undefined): PartitiveMultiplicity {
  return certainty === 'possible' ? 'optional' : 'compulsory';
}
