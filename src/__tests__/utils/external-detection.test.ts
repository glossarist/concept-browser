import { describe, it, expect } from 'vitest';
import {
  isExternalConcept,
  isExternalMember,
  isExternalComprehensive,
  getExternalMembers,
  hasProvidedBy,
  hasDanglingExternal,
  formatExternalLabel,
  type ConceptStore,
  type ExternalConceptLike,
} from '../../utils/external-detection';
import { checkExtensionalCompleteness } from 'glossarist';

/**
 * External-detection + extensional-completeness contract tests.
 *
 * glossarist@0.4.52 promoted these utilities from concept-browser's
 * local src/utils/external-detection.ts into the upstream library.
 * This spec pins:
 *   1. The local module re-exports the upstream functions (no drift).
 *   2. The upstream signatures work as documented.
 *   3. `formatExternalLabel` (the UI-only helper) stays local.
 *   4. `checkExtensionalCompleteness` flags ISO 704:2022 §6.4.5.1
 *      open-ended patterns in extensional definitions.
 */

const extResolved: ExternalConceptLike = { status: 'external', related: [{ type: 'provided_by' }] };
const extDangling: ExternalConceptLike = { status: 'external', related: [] };
const internal: ExternalConceptLike = { status: 'valid', related: [] };

const store: ConceptStore = {
  lookup(ref) {
    if (ref?.id === 'ext-resolved') return extResolved;
    if (ref?.id === 'ext-dangling') return extDangling;
    if (ref?.id === 'int-1') return internal;
    return null;
  },
};

describe('external-detection (re-exports from glossarist@0.4.52)', () => {
  describe('isExternalConcept', () => {
    it('returns true when concept.status === "external"', () => {
      expect(isExternalConcept(extResolved)).toBe(true);
      expect(isExternalConcept(extDangling)).toBe(true);
    });

    it('returns false for internal concepts', () => {
      expect(isExternalConcept(internal)).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isExternalConcept(null)).toBe(false);
      expect(isExternalConcept(undefined)).toBe(false);
    });
  });

  describe('isExternalMember', () => {
    it('returns true when the member ref resolves to an external concept', () => {
      expect(isExternalMember({ ref: { source: 's', id: 'ext-resolved' } }, store)).toBe(true);
    });

    it('returns false when the member ref resolves to an internal concept', () => {
      expect(isExternalMember({ ref: { source: 's', id: 'int-1' } }, store)).toBe(false);
    });

    it('returns false when store is null', () => {
      expect(isExternalMember({ ref: { source: 's', id: 'ext-resolved' } }, null)).toBe(false);
    });

    it('returns false when ref is missing', () => {
      expect(isExternalMember({}, store)).toBe(false);
      expect(isExternalMember(null, store)).toBe(false);
    });
  });

  describe('isExternalComprehensive', () => {
    it('returns true when the comprehensive ref resolves to external', () => {
      const hyperedge = {
        comprehensive: { source: 's', id: 'ext-resolved' },
        members: [],
      };
      expect(isExternalComprehensive(hyperedge, store)).toBe(true);
    });

    it('returns false when the comprehensive ref resolves to internal', () => {
      const hyperedge = {
        comprehensive: { source: 's', id: 'int-1' },
        members: [],
      };
      expect(isExternalComprehensive(hyperedge, store)).toBe(false);
    });
  });

  describe('getExternalMembers', () => {
    it('returns only the members whose refs resolve to external', () => {
      const hyperedge = {
        comprehensive: { source: 's', id: 'int-1' },
        members: [
          { ref: { source: 's', id: 'ext-resolved' } },
          { ref: { source: 's', id: 'int-1' } },
          { ref: { source: 's', id: 'ext-dangling' } },
        ],
      };
      const external = getExternalMembers(hyperedge, store);
      expect(external).toHaveLength(2);
      expect(external.map(m => (m.ref as { id?: string } | undefined)?.id)).toEqual(['ext-resolved', 'ext-dangling']);
    });
  });

  describe('hasProvidedBy', () => {
    it('returns true when the concept has a provided_by edge', () => {
      expect(hasProvidedBy(extResolved)).toBe(true);
    });

    it('returns false when the concept has no provided_by edge', () => {
      expect(hasProvidedBy(extDangling)).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(hasProvidedBy(null)).toBe(false);
      expect(hasProvidedBy(undefined)).toBe(false);
    });
  });

  describe('hasDanglingExternal (hyperedge-level)', () => {
    it('returns true when any external ref lacks a provided_by edge', () => {
      const hyperedge = {
        comprehensive: { source: 's', id: 'ext-dangling' },
        members: [],
      };
      expect(hasDanglingExternal(hyperedge, store)).toBe(true);
    });

    it('returns false when every external ref is resolved', () => {
      const hyperedge = {
        comprehensive: { source: 's', id: 'ext-resolved' },
        members: [{ ref: { source: 's', id: 'ext-resolved' } }],
      };
      expect(hasDanglingExternal(hyperedge, store)).toBe(false);
    });

    it('returns false when no refs are external', () => {
      const hyperedge = {
        comprehensive: { source: 's', id: 'int-1' },
        members: [{ ref: { source: 's', id: 'int-1' } }],
      };
      expect(hasDanglingExternal(hyperedge, store)).toBe(false);
    });
  });

  describe('formatExternalLabel (local UI helper, not in upstream)', () => {
    it('wraps the label in parentheses for external concepts', () => {
      expect(formatExternalLabel('precision condition', true)).toBe('(precision condition)');
    });

    it('returns the label as-is for internal concepts', () => {
      expect(formatExternalLabel('measurement unit', false)).toBe('measurement unit');
    });
  });
});

describe('checkExtensionalCompleteness (ISO 704:2022 §6.4.5.1)', () => {
  it('returns null for non-extensional definitions', () => {
    expect(checkExtensionalCompleteness({ type: 'intensional', content: '...' })).toBeNull();
    expect(checkExtensionalCompleteness({ type: null, content: '...' })).toBeNull();
    expect(checkExtensionalCompleteness(null)).toBeNull();
  });

  it('returns null for an extensional definition that lists every member', () => {
    expect(checkExtensionalCompleteness({
      type: 'extensional',
      content: '1, 2, 3',
    })).toBeNull();
  });

  it('returns a warning when an extensional definition uses an open-ended pattern', () => {
    // Open-ended patterns: "etc.", "...", "and so on", "includes but is not limited to"
    const issue = checkExtensionalCompleteness({
      type: 'extensional',
      content: 'length, mass, time, etc.',
    });
    expect(issue).not.toBeNull();
    expect(issue?.severity).toBe('warning');
    expect(issue?.rule).toBe('ISO-704-6.4.5.1');
    expect(issue?.message).toMatch(/completeness|extensional/i);
  });
});
