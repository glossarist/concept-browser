import { describe, it, expect } from 'vitest';
import {
  PARTITIVE_MULTIPLICITY,
  PARTITIVE_MULTIPLICITY_VALUES,
  isPartitiveMultiplicity,
  multiplicityDefinition,
  rakeStrokeStyle,
  multiplicityFromCertainty,
  NORMAL_STROKE_WIDTH,
  DELIMITING_STROKE_WIDTH,
  type PartitiveMultiplicity,
} from '../../utils/partitive-multiplicity';

describe('partitive-multiplicity registry', () => {
  it('has exactly 5 ISO 704:2022 multiplicity values', () => {
    expect(PARTITIVE_MULTIPLICITY_VALUES).toEqual([
      'compulsory',
      'optional',
      'compulsory_multiple',
      'optional_multiple',
      'compulsory_at_least_one',
    ]);
  });

  it('compulsory: 1 line, solid', () => {
    expect(multiplicityDefinition('compulsory')).toEqual({
      lines: 1, pattern: 'solid', label: 'Compulsory',
    });
  });

  it('optional: 1 line, dashed', () => {
    expect(multiplicityDefinition('optional')).toEqual({
      lines: 1, pattern: 'dashed', label: 'Optional',
    });
  });

  it('compulsory_multiple: 2 lines, solid', () => {
    expect(multiplicityDefinition('compulsory_multiple')).toEqual({
      lines: 2, pattern: 'solid', label: 'Compulsory multiple',
    });
  });

  it('optional_multiple: 2 lines, dashed', () => {
    expect(multiplicityDefinition('optional_multiple')).toEqual({
      lines: 2, pattern: 'dashed', label: 'Optional multiple',
    });
  });

  it('compulsory_at_least_one: 2 lines, mixed (one solid + one dashed)', () => {
    expect(multiplicityDefinition('compulsory_at_least_one')).toEqual({
      lines: 2, pattern: 'mixed', label: 'At least one',
    });
  });

  it('isPartitiveMultiplicity narrows known values', () => {
    expect(isPartitiveMultiplicity('compulsory')).toBe(true);
    expect(isPartitiveMultiplicity('compulsory_at_least_one')).toBe(true);
    expect(isPartitiveMultiplicity('unknown')).toBe(false);
    expect(isPartitiveMultiplicity(null)).toBe(false);
    expect(isPartitiveMultiplicity(42)).toBe(false);
  });
});

describe('rakeStrokeStyle', () => {
  const cases: Array<{
    name: string;
    multiplicity: PartitiveMultiplicity;
    isDelimiting: boolean;
    expected: {
      lineCount: 1 | 2;
      primaryDashed: boolean;
      secondaryDashed: boolean;
      strokeWidth: number;
    };
  }> = [
    // 5 multiplicity × 2 delimiting = 10 variants
    { name: 'compulsory / non-delimiting',          multiplicity: 'compulsory',          isDelimiting: false, expected: { lineCount: 1, primaryDashed: false, secondaryDashed: false, strokeWidth: NORMAL_STROKE_WIDTH } },
    { name: 'compulsory / delimiting',              multiplicity: 'compulsory',          isDelimiting: true,  expected: { lineCount: 1, primaryDashed: false, secondaryDashed: false, strokeWidth: DELIMITING_STROKE_WIDTH } },
    { name: 'optional / non-delimiting',            multiplicity: 'optional',            isDelimiting: false, expected: { lineCount: 1, primaryDashed: true,  secondaryDashed: true,  strokeWidth: NORMAL_STROKE_WIDTH } },
    { name: 'optional / delimiting',                multiplicity: 'optional',            isDelimiting: true,  expected: { lineCount: 1, primaryDashed: true,  secondaryDashed: true,  strokeWidth: DELIMITING_STROKE_WIDTH } },
    { name: 'compulsory_multiple / non-delimiting', multiplicity: 'compulsory_multiple', isDelimiting: false, expected: { lineCount: 2, primaryDashed: false, secondaryDashed: false, strokeWidth: NORMAL_STROKE_WIDTH } },
    { name: 'compulsory_multiple / delimiting',     multiplicity: 'compulsory_multiple', isDelimiting: true,  expected: { lineCount: 2, primaryDashed: false, secondaryDashed: false, strokeWidth: DELIMITING_STROKE_WIDTH } },
    { name: 'optional_multiple / non-delimiting',   multiplicity: 'optional_multiple',   isDelimiting: false, expected: { lineCount: 2, primaryDashed: true,  secondaryDashed: true,  strokeWidth: NORMAL_STROKE_WIDTH } },
    { name: 'optional_multiple / delimiting',       multiplicity: 'optional_multiple',   isDelimiting: true,  expected: { lineCount: 2, primaryDashed: true,  secondaryDashed: true,  strokeWidth: DELIMITING_STROKE_WIDTH } },
    { name: 'compulsory_at_least_one / non-delimiting',        multiplicity: 'compulsory_at_least_one',        isDelimiting: false, expected: { lineCount: 2, primaryDashed: false, secondaryDashed: true,  strokeWidth: NORMAL_STROKE_WIDTH } },
    { name: 'compulsory_at_least_one / delimiting',            multiplicity: 'compulsory_at_least_one',        isDelimiting: true,  expected: { lineCount: 2, primaryDashed: false, secondaryDashed: true,  strokeWidth: DELIMITING_STROKE_WIDTH } },
  ];

  for (const c of cases) {
    it(`${c.name} → ${JSON.stringify(c.expected)}`, () => {
      expect(rakeStrokeStyle(c.multiplicity, c.isDelimiting)).toEqual(c.expected);
    });
  }

  it('delimiting strokeWidth is exactly 3× normal (per ISO 704)', () => {
    expect(DELIMITING_STROKE_WIDTH / NORMAL_STROKE_WIDTH).toBe(3);
  });
});

describe('multiplicityFromCertainty (glossarist 0.4.20 migration)', () => {
  it('confirmed → compulsory', () => {
    expect(multiplicityFromCertainty('confirmed')).toBe('compulsory');
  });

  it('possible → optional', () => {
    expect(multiplicityFromCertainty('possible')).toBe('optional');
  });

  it('null / undefined → compulsory (default)', () => {
    expect(multiplicityFromCertainty(null)).toBe('compulsory');
    expect(multiplicityFromCertainty(undefined)).toBe('compulsory');
  });
});
