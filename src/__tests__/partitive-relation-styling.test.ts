import { describe, it, expect } from 'vitest';
import {
  partitiveRelationStyle,
  completenessLabel,
} from '../utils/partitive-relation-styling';

describe('partitive-relation-styling', () => {
  describe('partitiveRelationStyle (relation-level frame)', () => {
    it('returns teal color in light mode', () => {
      expect(partitiveRelationStyle('complete', false).color).toBe('#0d9488');
    });

    it('returns teal color in dark mode', () => {
      expect(partitiveRelationStyle('complete', true).color).toBe('#2dd4bf');
    });

    it('returns full opacity for complete', () => {
      expect(partitiveRelationStyle('complete', false).opacity).toBe(1.0);
    });

    it('returns reduced opacity for partial', () => {
      expect(partitiveRelationStyle('partial', false).opacity).toBe(0.6);
    });

    it('uses teal badge class regardless of completeness', () => {
      expect(partitiveRelationStyle('complete', false).badgeClass).toBe('badge-teal');
      expect(partitiveRelationStyle('partial', false).badgeClass).toBe('badge-teal');
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
});
