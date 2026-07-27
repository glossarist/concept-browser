import { describe, it, expect } from 'vitest';
// glossarist 0.4.24's top-level d.ts doesn't re-export the v3
// PartitiveRelation/PartitiveMember classes; import from glossarist/models
// (which our local augmentation extends) so the types are correct.
import type { PartitiveRelation, PartitiveMember, ConceptRef } from 'glossarist/models';
import {
  PartitiveRelation as PartitiveRelationModel,
  PartitiveMember as PartitiveMemberModel,
  ConceptRef as ConceptRefModel,
} from 'glossarist/models';

/**
 * Verifies glossarist-js 0.4.24's native v3 PartitiveRelation model
 * (ISO 704:2022 multiplicity + is_delimiting).
 *
 * The concept-browser now consumes this directly (no migration adapter,
 * no `as any` bridge). These specs lock in the contract so an upstream
 * regression is caught here.
 */

function makeRef(source: string, id: string): ConceptRef {
  return ConceptRefModel.fromJSON({ source, id }) as ConceptRef;
}

function makePartitive(
  source: string,
  id: string,
  multiplicity?: 'compulsory' | 'optional' | 'compulsory_multiple' | 'optional_multiple' | 'compulsory_at_least_one',
  isDelimiting?: boolean,
): PartitiveMember {
  const data: {
    ref: ConceptRef;
    multiplicity?: typeof multiplicity;
    is_delimiting?: boolean;
  } = { ref: makeRef(source, id) };
  if (multiplicity) data.multiplicity = multiplicity;
  if (isDelimiting) data.is_delimiting = isDelimiting;
  return PartitiveMemberModel.fromJSON(data as unknown as Record<string, unknown>) as PartitiveMember;
}

function makeRelation(opts: {
  comprehensive: ConceptRef;
  partitives: PartitiveMember[];
  completeness?: 'complete' | 'partial';
  criterion?: Record<string, string>;
}): PartitiveRelation {
  return PartitiveRelationModel.fromJSON(opts as unknown as Record<string, unknown>) as PartitiveRelation;
}

describe('useConceptEdges — native v3 PartitiveRelation (glossarist 0.4.24)', () => {
  describe('PartitiveMember (ISO 704:2022 multiplicity + delimiting)', () => {
    it('multiplicity defaults to compulsory when omitted', () => {
      const m = makePartitive('test', '1.1');
      expect(m.multiplicity).toBe('compulsory');
      expect(m.isCompulsory).toBe(true);
    });

    it('multiplicity is preserved when set to optional', () => {
      const m = makePartitive('test', '1.1', 'optional');
      expect(m.multiplicity).toBe('optional');
      expect(m.isOptional).toBe(true);
    });

    it('is_delimiting defaults to false', () => {
      const m = makePartitive('test', '1.1');
      expect(m.is_delimiting).toBe(false);
      expect(m.isDelimiting).toBe(false);
    });

    it('is_delimiting is preserved when set to true', () => {
      const m = makePartitive('test', '1.1', 'compulsory', true);
      expect(m.is_delimiting).toBe(true);
    });

    it('multiplicity + is_delimiting are orthogonal axes', () => {
      const m = makePartitive('test', '1.1', 'compulsory_multiple', true);
      expect(m.multiplicity).toBe('compulsory_multiple');
      expect(m.is_delimiting).toBe(true);
    });
  });

  describe('PartitiveRelation', () => {
    it('accepts 2 compulsory members with completeness=complete', () => {
      const r = makeRelation({
        comprehensive: makeRef('test', '1.3'),
        partitives: [makePartitive('test', '1.4'), makePartitive('test', '1.5')],
      });
      expect(r.partitives).toHaveLength(2);
      expect(r.completeness).toBe('complete');
      expect(r.isComplete).toBe(true);
      expect(r.isPartial).toBe(false);
    });

    it('completeness=partial is preserved', () => {
      const r = makeRelation({
        comprehensive: makeRef('test', '1.3'),
        partitives: [makePartitive('test', '1.4'), makePartitive('test', '1.5')],
        completeness: 'partial',
      });
      expect(r.completeness).toBe('partial');
      expect(r.isPartial).toBe(true);
    });

    it('member with compulsory_multiple has isCompulsory false', () => {
      const m = makePartitive('test', '1.4', 'compulsory_multiple');
      expect(m.isCompulsory).toBe(false);
      expect(m.multiplicity).not.toBe('compulsory');
    });

    it('all compulsory-single members have isCompulsory true', () => {
      const r = makeRelation({
        comprehensive: makeRef('test', '1.3'),
        partitives: [makePartitive('test', '1.4'), makePartitive('test', '1.5')],
      });
      expect(r.partitives[0].isCompulsory).toBe(true);
      expect(r.partitives[1].isCompulsory).toBe(true);
    });

    it('isCoordinate true when ≥2 partitives', () => {
      const r = makeRelation({
        comprehensive: makeRef('test', '1.3'),
        partitives: [makePartitive('test', '1.4'), makePartitive('test', '1.5')],
      });
      expect(r.isCoordinate).toBe(true);
    });

    it('rejects < 2 partitives (ISO 704 requirement)', () => {
      expect(() => makeRelation({
        comprehensive: makeRef('test', '1.3'),
        partitives: [makePartitive('test', '1.4')],
      })).toThrow(/≥2 partitives/);
    });

    it('round-trips through toJSON with v3 fields', () => {
      const r = makeRelation({
        comprehensive: makeRef('test', '1.3'),
        partitives: [
          makePartitive('test', '1.4', 'compulsory', false),
          makePartitive('test', '1.5', 'compulsory_multiple', true),
        ],
        completeness: 'partial',
        criterion: { eng: 'physical structure' },
      });
      const json = r.toJSON() as {
        comprehensive: unknown;
        partitives: Array<{ multiplicity?: string; is_delimiting?: boolean; ref: unknown }>;
        completeness: string;
        criterion?: Record<string, string>;
      };
      expect(json.comprehensive).toBeDefined();
      expect(json.partitives).toHaveLength(2);
      // compulsory is the default multiplicity — not emitted in toJSON
      expect(json.partitives[0].multiplicity).toBeUndefined();
      expect(json.partitives[1].multiplicity).toBe('compulsory_multiple');
      expect(json.partitives[1].is_delimiting).toBe(true);
      expect(json.completeness).toBe('partial');
      expect(json.criterion).toEqual({ eng: 'physical structure' });
    });
  });
});
