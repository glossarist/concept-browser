import { describe, it, expect } from 'vitest';
// glossarist-js 0.4.26's top-level d.ts doesn't re-export the MECE
// PartitiveRelation/PartitiveMember classes; import from glossarist/models
// (extended by our local augmentation) so the types are correct.
import type {
  PartitiveRelation,
  PartitiveMember,
  ConceptRef,
} from 'glossarist/models';
import {
  PartitiveRelation as PartitiveRelationModel,
  PartitiveMember as PartitiveMemberModel,
  ConceptRef as ConceptRefModel,
} from 'glossarist/models';

/**
 * Verifies glossarist-js 0.4.26's MECE-native PartitiveRelation model
 * (ISO 704:2022 presence × count + is_delimiting).
 *
 * The concept-browser consumes these fields directly (no migration
 * bridge). These specs pin the runtime contract so a regression in
 * upstream is caught here.
 */

function makeRef(source: string, id: string): ConceptRef {
  return ConceptRefModel.fromJSON({ source, id }) as ConceptRef;
}

function makePartitive(
  source: string,
  id: string,
  fields: { presence?: 'required' | 'optional'; count?: 'exactly_one' | 'at_least_one' | 'multiple'; isDelimiting?: boolean } = {},
): PartitiveMember {
  const data: {
    ref: ConceptRef;
    presence?: 'required' | 'optional';
    count?: 'exactly_one' | 'at_least_one' | 'multiple';
    is_delimiting?: boolean;
  } = { ref: makeRef(source, id) };
  if (fields.presence) data.presence = fields.presence;
  if (fields.count) data.count = fields.count;
  if (fields.isDelimiting) data.is_delimiting = fields.isDelimiting;
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

describe('useConceptEdges — MECE PartitiveRelation (glossarist 0.4.26)', () => {
  describe('PartitiveMember (ISO 704:2022 presence × count + delimiting)', () => {
    it('presence defaults to required, count defaults to exactly_one', () => {
      const m = makePartitive('test', '1.1');
      expect(m.presence).toBe('required');
      expect(m.isRequired).toBe(true);
      expect(m.isOptional).toBe(false);
    });

    it('count defaults to exactly_one', () => {
      const m = makePartitive('test', '1.1');
      expect(m.count).toBe('exactly_one');
    });

    it('presence=optional is preserved', () => {
      const m = makePartitive('test', '1.1', { presence: 'optional' });
      expect(m.presence).toBe('optional');
      expect(m.isOptional).toBe(true);
      expect(m.isRequired).toBe(false);
    });

    it('count=multiple is preserved', () => {
      const m = makePartitive('test', '1.1', { count: 'multiple' });
      expect(m.count).toBe('multiple');
    });

    it('count=at_least_one is preserved', () => {
      const m = makePartitive('test', '1.1', { count: 'at_least_one' });
      expect(m.count).toBe('at_least_one');
    });

    it('is_delimiting defaults to false', () => {
      const m = makePartitive('test', '1.1');
      expect(m.is_delimiting).toBe(false);
      expect(m.isDelimiting).toBe(false);
    });

    it('is_delimiting is preserved when set to true', () => {
      const m = makePartitive('test', '1.1', { isDelimiting: true });
      expect(m.is_delimiting).toBe(true);
      expect(m.isDelimiting).toBe(true);
    });

    it('rejects the vacuous (presence=optional, count=at_least_one)', () => {
      expect(() =>
        makePartitive('test', '1.1', { presence: 'optional', count: 'at_least_one' }),
      ).toThrow(/collapses to optional \+ multiple/);
    });
  });

  describe('PartitiveRelation', () => {
    it('accepts 2 members with default axes', () => {
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

    it('round-trips through toJSON with MECE fields', () => {
      const r = makeRelation({
        comprehensive: makeRef('test', '1.3'),
        partitives: [
          makePartitive('test', '1.4', { presence: 'required', count: 'multiple' }),
          makePartitive('test', '1.5', { presence: 'optional', isDelimiting: true }),
        ],
        completeness: 'partial',
        criterion: { eng: 'physical structure' },
      });
      const json = r.toJSON() as {
        comprehensive: unknown;
        partitives: Array<{ presence?: string; count?: string; is_delimiting?: boolean; ref: unknown }>;
        completeness: string;
        criterion?: Record<string, string>;
      };
      expect(json.comprehensive).toBeDefined();
      expect(json.partitives).toHaveLength(2);
      expect(json.partitives[0].count).toBe('multiple');
      expect(json.partitives[1].presence).toBe('optional');
      expect(json.partitives[1].is_delimiting).toBe(true);
      expect(json.completeness).toBe('partial');
      expect(json.criterion).toEqual({ eng: 'physical structure' });
    });
  });
});
