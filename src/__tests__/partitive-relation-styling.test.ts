import { describe, it, expect } from 'vitest';
import {
  partitiveRelationStyle,
  pluralityColor,
  completenessLabel,
  certaintyLabel,
} from '../utils/partitive-relation-styling';
import type { TypeSharedPluralityWire } from '../adapters/types';

describe('partitive-relation-styling', () => {
  describe('partitiveRelationStyle', () => {
    it('returns full opacity for complete', () => {
      expect(partitiveRelationStyle('complete', null, false).opacity).toBe(1.0);
    });

    it('returns reduced opacity for partial', () => {
      expect(partitiveRelationStyle('partial', null, false).opacity).toBe(0.6);
    });

    it('uses teal badge class for complete with no plurality', () => {
      expect(partitiveRelationStyle('complete', null, false).badgeClass).toBe('badge-teal');
    });

    it('uses blue badge class for isShared plurality', () => {
      const p: TypeSharedPluralityWire = { isShared: true, isUncertain: false };
      expect(partitiveRelationStyle('complete', p, false).badgeClass).toBe('badge-blue');
    });

    it('uses yellow badge class when isShared + isUncertain', () => {
      const p: TypeSharedPluralityWire = { isShared: true, isUncertain: true };
      expect(partitiveRelationStyle('complete', p, false).badgeClass).toBe('badge-yellow');
    });

    it('returns different colors in dark mode', () => {
      const light = partitiveRelationStyle('complete', null, false);
      const dark = partitiveRelationStyle('complete', null, true);
      expect(light.color).not.toBe(dark.color);
    });

    it('ignores plurality when isShared is false', () => {
      const p: TypeSharedPluralityWire = { isShared: false, isUncertain: true };
      expect(partitiveRelationStyle('complete', p, false).badgeClass).toBe('badge-teal');
    });
  });

  describe('pluralityColor', () => {
    it('returns blue for isShared', () => {
      const p: TypeSharedPluralityWire = { isShared: true, isUncertain: false };
      expect(pluralityColor(p, false)).toBe('#3b82f6');
    });

    it('returns amber when isUncertain', () => {
      const p: TypeSharedPluralityWire = { isShared: true, isUncertain: true };
      expect(pluralityColor(p, false)).toBe('#f59e0b');
    });

    it('returns dark-mode variants', () => {
      expect(pluralityColor({ isShared: true, isUncertain: false }, true)).toBe('#60a5fa');
      expect(pluralityColor({ isShared: true, isUncertain: true }, true)).toBe('#fbbf24');
    });
  });

  describe('completenessLabel', () => {
    it('labels complete', () => {
      expect(completenessLabel('complete')).toBe('Complete');
    });

    it('labels partial', () => {
      expect(completenessLabel('partial')).toBe('Partial');
    });
  });

  describe('certaintyLabel', () => {
    it('labels confirmed', () => {
      expect(certaintyLabel('confirmed')).toBe('Confirmed');
    });

    it('labels possible', () => {
      expect(certaintyLabel('possible')).toBe('Possible');
    });
  });
});
