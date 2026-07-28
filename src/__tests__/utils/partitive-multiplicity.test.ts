/**
 * MECE refactor of partitive-multiplicity (ISO 704:2022).
 *
 * Two orthogonal axes: presence × count, plus isDelimiting.
 * Visual derivation lives in rakeStrokeStyle — the test pins its
 * truth table so future rendering edits stay aligned with the spec.
 */
import { describe, it, expect } from 'vitest';
import {
  PRESENCE_VALUES,
  COUNT_VALUES,
  isPartitivePresence,
  isPartitiveCount,
  presenceLabel,
  countLabel,
  rakeStrokeStyle,
  NORMAL_STROKE_WIDTH,
  DELIMITING_STROKE_WIDTH,
  type PartitivePresence,
  type PartitiveCount,
} from '../../utils/partitive-multiplicity';

describe('presence axis', () => {
  it('has exactly 2 values: required, optional', () => {
    expect([...PRESENCE_VALUES]).toEqual(['required', 'optional']);
  });

  it('isPartitivePresence narrows known values', () => {
    expect(isPartitivePresence('required')).toBe(true);
    expect(isPartitivePresence('optional')).toBe(true);
    expect(isPartitivePresence('unknown')).toBe(false);
    expect(isPartitivePresence(null)).toBe(false);
    expect(isPartitivePresence(42)).toBe(false);
  });

  it('presenceLabel returns human-readable labels', () => {
    expect(presenceLabel('required')).toBe('Required');
    expect(presenceLabel('optional')).toBe('Optional');
  });
});

describe('count axis', () => {
  it('has exactly 3 values: exactly_one, at_least_one, multiple', () => {
    expect([...COUNT_VALUES]).toEqual(['exactly_one', 'at_least_one', 'multiple']);
  });

  it('isPartitiveCount narrows known values', () => {
    expect(isPartitiveCount('exactly_one')).toBe(true);
    expect(isPartitiveCount('at_least_one')).toBe(true);
    expect(isPartitiveCount('multiple')).toBe(true);
    expect(isPartitiveCount('unknown')).toBe(false);
    expect(isPartitiveCount(null)).toBe(false);
  });

  it('countLabel returns human-readable labels', () => {
    expect(countLabel('exactly_one')).toBe('Exactly one');
    expect(countLabel('at_least_one')).toBe('At least one');
    expect(countLabel('multiple')).toBe('Multiple');
  });
});

describe('rakeStrokeStyle (MECE rendering truth table)', () => {
  const presenceCases: PartitivePresence[] = ['required', 'optional'];
  const countCases: PartitiveCount[] = ['exactly_one', 'at_least_one', 'multiple'];
  const delimitingCases = [false, true];

  for (const presence of presenceCases) {
    for (const count of countCases) {
      for (const isDelimiting of delimitingCases) {
        const expectedWidth = isDelimiting ? DELIMITING_STROKE_WIDTH : NORMAL_STROKE_WIDTH;
        const expectedPrimaryDashed = presence === 'optional';
        const expectedLineCount: 1 | 2 = count === 'exactly_one' ? 1 : 2;
        // When lineCount=1, secondaryDashed is unused (no second line).
        // Implementation choice: set it to false as the default.
        // When lineCount=2:
        //   - at_least_one: secondary always dashed ("possibly more")
        //   - multiple: secondary mirrors primary
        const expectedSecondaryDashed = expectedLineCount === 1
          ? false
          : count === 'at_least_one'
            ? true
            : expectedPrimaryDashed;

        it(`${presence} × ${count}${isDelimiting ? ' / delimiting' : ''}`, () => {
          expect(rakeStrokeStyle(presence, count, isDelimiting)).toEqual({
            lineCount: expectedLineCount,
            primaryDashed: expectedPrimaryDashed,
            secondaryDashed: expectedSecondaryDashed,
            strokeWidth: expectedWidth,
          });
        });
      }
    }
  }

  it('delimiting strokeWidth is 3× normal (per ISO 704 convention)', () => {
    expect(DELIMITING_STROKE_WIDTH / NORMAL_STROKE_WIDTH).toBe(3);
  });

  it('exactly_one always produces a single line, regardless of presence', () => {
    for (const presence of presenceCases) {
      const style = rakeStrokeStyle(presence, 'exactly_one', false);
      expect(style.lineCount).toBe(1);
      expect(style.primaryDashed).toBe(presence === 'optional');
    }
  });

  it('at_least_one differs from multiple by secondary line dash pattern', () => {
    for (const presence of presenceCases) {
      const atleastOne = rakeStrokeStyle(presence, 'at_least_one', false);
      const multiple = rakeStrokeStyle(presence, 'multiple', false);
      expect(atleastOne.lineCount).toBe(2);
      expect(multiple.lineCount).toBe(2);
      // at_least_one: secondary always dashed (possibly more)
      expect(atleastOne.secondaryDashed).toBe(true);
      // multiple: secondary matches primary
      expect(multiple.secondaryDashed).toBe(multiple.primaryDashed);
    }
  });
});
