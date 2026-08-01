import { describe, it, expect } from 'vitest';
import {
  isExternalConcept,
  hasProvidedBy,
  isDanglingExternal,
  formatExternalLabel,
  type ConceptStoreLike,
} from '../../utils/external-detection';

const mockStore: ConceptStoreLike = {
  lookup(ref) {
    if (ref?.id === 'ext-1') {
      return { status: 'external', relatedConcepts: [{ type: 'provided_by' }] };
    }
    if (ref?.id === 'ext-2') {
      return { status: 'external', relatedConcepts: [] };
    }
    if (ref?.id === 'int-1') {
      return { status: 'valid', relatedConcepts: [] };
    }
    return null;
  },
};

describe('external-detection', () => {
  describe('isExternalConcept', () => {
    it('returns true when the concept status is external', () => {
      expect(isExternalConcept({ source: 's', id: 'ext-1' }, mockStore)).toBe(true);
    });

    it('returns false when the concept status is valid', () => {
      expect(isExternalConcept({ source: 's', id: 'int-1' }, mockStore)).toBe(false);
    });

    it('returns false when the concept is not found', () => {
      expect(isExternalConcept({ source: 's', id: 'unknown' }, mockStore)).toBe(false);
    });

    it('returns false when ref is null', () => {
      expect(isExternalConcept(null, mockStore)).toBe(false);
    });

    it('returns false when store is null', () => {
      expect(isExternalConcept({ source: 's', id: 'ext-1' }, null)).toBe(false);
    });
  });

  describe('hasProvidedBy', () => {
    it('returns true when the external concept has a provided_by edge', () => {
      expect(hasProvidedBy({ source: 's', id: 'ext-1' }, mockStore)).toBe(true);
    });

    it('returns false when the external concept has no provided_by edge', () => {
      expect(hasProvidedBy({ source: 's', id: 'ext-2' }, mockStore)).toBe(false);
    });

    it('returns false when the concept is not found', () => {
      expect(hasProvidedBy({ source: 's', id: 'unknown' }, mockStore)).toBe(false);
    });
  });

  describe('isDanglingExternal', () => {
    it('returns false when the external concept has provided_by (resolved)', () => {
      expect(isDanglingExternal({ source: 's', id: 'ext-1' }, mockStore)).toBe(false);
    });

    it('returns true when the external concept has no provided_by (dangling)', () => {
      expect(isDanglingExternal({ source: 's', id: 'ext-2' }, mockStore)).toBe(true);
    });

    it('returns false for internal concepts', () => {
      expect(isDanglingExternal({ source: 's', id: 'int-1' }, mockStore)).toBe(false);
    });
  });

  describe('formatExternalLabel', () => {
    it('wraps the label in parentheses for external concepts', () => {
      expect(formatExternalLabel('precision condition', true)).toBe('(precision condition)');
    });

    it('returns the label as-is for internal concepts', () => {
      expect(formatExternalLabel('measurement unit', false)).toBe('measurement unit');
    });
  });
});
