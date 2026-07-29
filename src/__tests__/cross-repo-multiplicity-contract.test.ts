/**
 * Cross-repo MECE multiplicity table SSOT spec.
 *
 * Audit (AUDIT-2026-07-29 P2-1): pin that the multiplicity mapping
 * table is consistent with glossarist-js's SSOT (multiplicityFromPair).
 *
 * The concept-browser doesn't redefine the table — it re-exports
 * `multiplicityFromPair` from glossarist-js via
 * `src/utils/partitive-multiplicity.ts`. This spec ensures that
 * re-export stays correct, and that the 5 valid combinations and
 * the 1 invalid combination match the documented contract.
 *
 * Sister specs:
 *   - glossarist-js test/models/partitive-relation-v4.test.js
 *   - glossarist-ruby spec/unit/v3/multiplicity_spec.rb
 *   - concept-model spec/multiplicity_spec.rb
 *
 * All four must agree. This spec is the concept-browser side of
 * that cross-repo contract.
 */
import { describe, it, expect } from 'vitest';
import {
  partitiveMultiplicityName,
  rakeStrokeStyle,
  type PartitivePresence,
  type PartitiveCount,
} from '../utils/partitive-multiplicity';

describe('cross-repo MECE multiplicity SSOT contract', () => {
  // The 5 valid combinations are the source of truth. Any change
  // here MUST be mirrored in:
  //   - glossarist-js src/models/multiplicity.js (NAME_BY_PAIR)
  //   - glossarist-ruby lib/glossarist/v3/multiplicity.rb (NAME_BY_PAIR)
  //   - concept-model lib/glossarist/concept_model/multiplicity.rb (MAPPING)
  //   - concept-model schemas/v3/concept.yaml (partitive_member.not.allOf)
  //   - concept-model ontologies/shapes/glossarist.shacl.ttl (VacuousComboShape)
  const VALID_COMBINATIONS: Array<{
    presence: PartitivePresence;
    count: PartitiveCount;
    iso704Name: string;
  }> = [
    { presence: 'required', count: 'exactly_one',  iso704Name: 'compulsory' },
    { presence: 'optional', count: 'exactly_one',  iso704Name: 'optional' },
    { presence: 'required', count: 'multiple',     iso704Name: 'compulsory_multiple' },
    { presence: 'optional', count: 'multiple',     iso704Name: 'optional_multiple' },
    { presence: 'required', count: 'at_least_one', iso704Name: 'compulsory_at_least_one' },
  ];

  it('maps the 5 valid (presence, count) pairs to ISO 704 names', () => {
    for (const { presence, count, iso704Name } of VALID_COMBINATIONS) {
      expect(partitiveMultiplicityName(presence, count)).toBe(iso704Name);
    }
  });

  it('rejects the vacuous (optional, at_least_one) combination', () => {
    // This combination is invalid because "may exist, ≥1 if it does"
    // collapses to "may exist in any number" = (optional, multiple).
    // The model rejects it at construction; multiplicityFromPair
    // rejects it at name lookup. Both must surface the error.
    expect(() => partitiveMultiplicityName('optional', 'at_least_one'))
      .toThrow(/Invalid multiplicity combination/);
  });

  it('every valid combination produces a renderable rakeStrokeStyle', () => {
    // The renderer must accept every valid combination — no missing
    // branches in the switch. If multiplicityFromPair succeeds,
    // rakeStrokeStyle must succeed too.
    for (const { presence, count } of VALID_COMBINATIONS) {
      const style = rakeStrokeStyle(presence, count, false);
      expect(style.lineCount).toBeGreaterThanOrEqual(1);
      expect(style.lineCount).toBeLessThanOrEqual(2);
      expect(style.strokeWidth).toBeGreaterThan(0);
    }
  });

  it('the table has exactly 5 entries (no drift)', () => {
    expect(VALID_COMBINATIONS).toHaveLength(5);
  });

  it('no two pairs map to the same ISO 704 name', () => {
    const names = VALID_COMBINATIONS.map(c => c.iso704Name);
    expect(new Set(names).size).toBe(names.length);
  });
});
