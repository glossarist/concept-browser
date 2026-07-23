import { describe, it, expect } from 'vitest';
import type { PartitiveRelation, PartitiveMember, TypeSharedPlurality, ConceptRef } from 'glossarist';
import {
  PartitiveRelation as PartitiveRelationModel,
  PartitiveMember as PartitiveMemberModel,
  TypeSharedPlurality as TypeSharedPluralityModel,
  ConceptRef as ConceptRefModel,
} from 'glossarist/models';

/**
 * Verifies glossarist-js's native v2 PartitiveRelation model.
 *
 * The concept-browser now consumes this directly (no `as any`
 * bridge). These specs lock in the contract so an upstream
 * regression is caught here.
 */

function makeRef(source: string, id: string): ConceptRef {
  return ConceptRefModel.fromJSON({ source, id }) as ConceptRef;
}

function makePartitive(source: string, id: string, certainty?: 'confirmed' | 'possible'): PartitiveMember {
  const data: { ref: ConceptRef; certainty?: 'confirmed' | 'possible' } = { ref: makeRef(source, id) };
  if (certainty) data.certainty = certainty;
  return PartitiveMemberModel.fromJSON(data as unknown as Record<string, unknown>) as PartitiveMember;
}

function makePlurality(isShared: boolean, isUncertain = false): TypeSharedPlurality {
  return TypeSharedPluralityModel.fromJSON({ isShared, isUncertain }) as TypeSharedPlurality;
}

function makeRelation(opts: {
  comprehensive: ConceptRef;
  partitives: PartitiveMember[];
  completeness?: 'complete' | 'partial';
  plurality?: TypeSharedPlurality | null;
  criterion?: Record<string, string>;
}): PartitiveRelation {
  return PartitiveRelationModel.fromJSON(opts as unknown as Record<string, unknown>) as PartitiveRelation;
}

describe('native v2 PartitiveRelation model (glossarist 0.4.20)', () => {
  it('PartitiveMember.certainty defaults to confirmed when omitted', () => {
    const m = makePartitive('test', '1.4');
    expect(m.certainty).toBe('confirmed');
  });

  it('PartitiveMember.certainty is preserved when set to possible', () => {
    const m = makePartitive('test', '1.4', 'possible');
    expect(m.certainty).toBe('possible');
    expect(m.isPossible).toBe(true);
  });

  it('PartitiveMember.ref exposes the typed ConceptRef', () => {
    const m = makePartitive('test', '1.4');
    expect(m.ref.source).toBe('test');
    expect(m.ref.id).toBe('1.4');
  });

  it('PartitiveRelation has completeness default of complete', () => {
    const r = makeRelation({
      comprehensive: makeRef('test', '1.3'),
      partitives: [makePartitive('test', '1.4'), makePartitive('test', '1.5')],
    });
    expect(r.completeness).toBe('complete');
    expect(r.isComplete).toBe(true);
  });

  it('PartitiveRelation preserves explicit partial completeness', () => {
    const r = makeRelation({
      comprehensive: makeRef('test', '1.3'),
      partitives: [makePartitive('test', '1.4'), makePartitive('test', '1.5')],
      completeness: 'partial',
    });
    expect(r.completeness).toBe('partial');
    expect(r.isPartial).toBe(true);
  });

  it('PartitiveRelation accepts plurality', () => {
    const r = makeRelation({
      comprehensive: makeRef('test', '1.3'),
      partitives: [makePartitive('test', '1.4'), makePartitive('test', '1.5')],
      plurality: makePlurality(true, true),
    });
    expect(r.hasPlurality()).toBe(true);
    expect(r.plurality?.isShared).toBe(true);
    expect(r.plurality?.isUncertain).toBe(true);
  });

  it('PartitiveRelation accepts criterion as localized hash', () => {
    const r = makeRelation({
      comprehensive: makeRef('test', '1.3'),
      partitives: [makePartitive('test', '1.4'), makePartitive('test', '1.5')],
      criterion: { eng: 'physical structure', fra: 'structure physique' },
    });
    expect(r.hasCriterion()).toBe(true);
    expect(r.criterion?.eng).toBe('physical structure');
  });

  it('rejects < 2 partitives (ISO 704 requirement)', () => {
    expect(() => makeRelation({
      comprehensive: makeRef('test', '1.3'),
      partitives: [makePartitive('test', '1.4')],
    })).toThrow(/≥2 partitives/);
  });

  it('rejects self-loops', () => {
    expect(() => makeRelation({
      comprehensive: makeRef('test', '1.3'),
      partitives: [
        makePartitive('test', '1.3'),
        makePartitive('test', '1.4'),
      ],
    })).toThrow(/self-loop/);
  });

  it('round-trips through toJSON with v2 shape', () => {
    const r = makeRelation({
      comprehensive: makeRef('test', '1.3'),
      partitives: [makePartitive('test', '1.4'), makePartitive('test', '1.5', 'possible')],
      completeness: 'partial',
      plurality: makePlurality(true),
      criterion: { eng: 'criterion text' },
    });
    const json = r.toJSON();
    expect(json.completeness).toBe('partial');
    expect(json.partitives).toHaveLength(2);
    expect(json.partitives[1].certainty).toBe('possible');
    expect(json.plurality?.is_shared).toBe(true);
    expect(json.criterion?.eng).toBe('criterion text');
  });
});
