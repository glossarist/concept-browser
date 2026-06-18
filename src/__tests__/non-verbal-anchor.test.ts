import { describe, it, expect } from 'vitest';
import {
  anchorId,
  ANCHOR_KIND_SELECTORS,
} from '../utils/non-verbal-anchor';

describe('non-verbal-anchor', () => {
  describe('anchorId', () => {
    it('joins kind + datasetId + entityId with hyphens', () => {
      expect(anchorId('figure', 'iala-2023', 'mixed-reflection'))
        .toBe('figure-iala-2023-mixed-reflection');
    });

    it('uses the kind name as prefix (not an alias)', () => {
      expect(anchorId('table', 'iso', 'standard-wavelengths'))
        .toBe('table-iso-standard-wavelengths');
      expect(anchorId('formula', 'iso', 'e-mc2'))
        .toBe('formula-iso-e-mc2');
    });
  });

  describe('ANCHOR_KIND_SELECTORS', () => {
    it('contains one selector per kind', () => {
      expect(ANCHOR_KIND_SELECTORS).toContain('a[href^="#figure-"]');
      expect(ANCHOR_KIND_SELECTORS).toContain('a[href^="#table-"]');
      expect(ANCHOR_KIND_SELECTORS).toContain('a[href^="#formula-"]');
    });

    it('has exactly three selectors (one per kind)', () => {
      expect(ANCHOR_KIND_SELECTORS.length).toBe(3);
    });
  });
});
