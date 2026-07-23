import { describe, it, expect } from 'vitest';
import {
  toDiffableConcept,
  deriveDiffSections,
  computeSimilarity,
  useConceptDiff,
} from '../../composables/use-concept-diff';
import type { ConceptDiff } from 'glossarist/diff';

describe('useConceptDiff', () => {
  describe('toDiffableConcept', () => {
    it('reads id from conceptId', () => {
      const c = toDiffableConcept({ conceptId: '1.2.3' });
      expect(c.id).toBe('1.2.3');
      expect(c.termid).toBe('1.2.3');
    });

    it('falls back to id', () => {
      const c = toDiffableConcept({ id: 'abc' });
      expect(c.id).toBe('abc');
    });

    it('collects languages from localizations', () => {
      const c = toDiffableConcept({
        id: 'x',
        localizations: { eng: {}, fra: {} },
      });
      expect(c.languages).toEqual(['eng', 'fra']);
    });

    it('returns null from localization() for unknown lang', () => {
      const c = toDiffableConcept({ id: 'x', localizations: { eng: {} } });
      expect(c.localization('deu')).toBeNull();
    });

    it('localization() returns terms/definitions/notes/examples with defaults', () => {
      const c = toDiffableConcept({
        id: 'x',
        localizations: { eng: { terms: ['t'] } },
      });
      const lc = c.localization('eng');
      expect(lc).not.toBeNull();
      expect(lc?.terms).toEqual(['t']);
      expect(lc?.definitions).toEqual([]);
      expect(lc?.languageCode).toBe('eng');
    });
  });

  describe('deriveDiffSections', () => {
    it('returns empty for null', () => {
      expect(deriveDiffSections(null, 'eng')).toEqual({});
    });

    it('returns empty when no localization for lang', () => {
      const diff = {
        localization: () => null,
        localizations: {},
      } as unknown as ConceptDiff;
      expect(deriveDiffSections(diff, 'eng')).toEqual({});
    });

    it('extracts added definition', () => {
      const diff = {
        localization: () => ({
          definitions: { added: [{ value: { content: 'new def' } }] },
        }),
      } as unknown as ConceptDiff;
      const s = deriveDiffSections(diff, 'eng');
      expect(s.definition?.type).toBe('added');
      expect(s.definition?.value).toBe('new def');
    });

    it('extracts removed definition', () => {
      const diff = {
        localization: () => ({
          definitions: { removed: [{ value: { content: 'old def' } }] },
        }),
      } as unknown as ConceptDiff;
      const s = deriveDiffSections(diff, 'eng');
      expect(s.definition?.type).toBe('removed');
      expect(s.definition?.value).toBe('old def');
    });

    it('extracts changed definition hunks', () => {
      const hunks = [
        { type: 'equal', text: 'a' },
        { type: 'added', text: 'b' },
      ];
      const diff = {
        localization: () => ({
          definitions: { changed: [{ textDiff: { hunks } }] },
        }),
      } as unknown as ConceptDiff;
      const s = deriveDiffSections(diff, 'eng');
      expect(s.definition?.hunks).toEqual(hunks);
    });

    it('extracts designations (added + removed + changed)', () => {
      const diff = {
        localization: () => ({
          designations: {
            added: [{ value: { designation: 'new' } }],
            removed: [{ value: { designation: 'old' } }],
            changed: [{ oldValue: { designation: 'a' }, newValue: { designation: 'b' } }],
          },
        }),
      } as unknown as ConceptDiff;
      const s = deriveDiffSections(diff, 'eng');
      expect(s.designations?.items).toEqual([
        { type: 'added', text: 'new' },
        { type: 'removed', text: 'old' },
        { type: 'removed', text: 'a' },
        { type: 'added', text: 'b' },
      ]);
    });

    it('extracts notes and examples', () => {
      const diff = {
        localization: () => ({
          notes: { added: [{ value: { content: 'n1' } }] },
          examples: { removed: [{ value: { content: 'e1' } }] },
        }),
      } as unknown as ConceptDiff;
      const s = deriveDiffSections(diff, 'eng');
      expect(s.notes?.items).toEqual([{ type: 'added', text: 'n1' }]);
      expect(s.examples?.items).toEqual([{ type: 'removed', text: 'e1' }]);
    });

    it('prefers changed hunks over added/removed when both present', () => {
      const diff = {
        localization: () => ({
          definitions: {
            changed: [{ textDiff: { hunks: [{ type: 'equal', text: 'x' }] } }],
            added: [{ value: 'should-be-ignored' }],
          },
        }),
      } as unknown as ConceptDiff;
      const s = deriveDiffSections(diff, 'eng');
      expect(s.definition?.hunks).toHaveLength(1);
      expect(s.definition?.type).toBeUndefined();
    });
  });

  describe('computeSimilarity', () => {
    it('returns null for null diff', () => {
      expect(computeSimilarity(null)).toBeNull();
    });

    it('returns null when no stats', () => {
      const diff = {} as ConceptDiff;
      expect(computeSimilarity(diff)).toBeNull();
    });

    it('returns null when total is 0', () => {
      const diff = { stats: { added: 0, removed: 0, changed: 0, total: 0 } } as unknown as ConceptDiff;
      expect(computeSimilarity(diff)).toBeNull();
    });

    it('returns 1.0 when nothing changed', () => {
      const diff = { stats: { added: 0, removed: 0, changed: 0, total: 10 } } as unknown as ConceptDiff;
      expect(computeSimilarity(diff)).toBe(1);
    });

    it('returns 0 when everything changed', () => {
      const diff = { stats: { added: 5, removed: 5, changed: 0, total: 10 } } as unknown as ConceptDiff;
      expect(computeSimilarity(diff)).toBe(0);
    });

    it('computes partial similarity', () => {
      const diff = { stats: { added: 1, removed: 1, changed: 0, total: 10 } } as unknown as ConceptDiff;
      expect(computeSimilarity(diff)).toBe(0.8);
    });

    it('clamps to [0, 1]', () => {
      const over = { stats: { added: 100, removed: 100, changed: 100, total: 10 } } as unknown as ConceptDiff;
      expect(computeSimilarity(over)).toBe(0);
    });
  });

  describe('useConceptDiff composable', () => {
    it('starts empty', () => {
      const { diffResult, loading, error } = useConceptDiff();
      expect(diffResult.value).toBeNull();
      expect(loading.value).toBe(false);
      expect(error.value).toBeNull();
    });

    it('clear() resets state', () => {
      const { diffResult, error, clear } = useConceptDiff();
      diffResult.value = {} as ConceptDiff;
      error.value = 'oops';
      clear();
      expect(diffResult.value).toBeNull();
      expect(error.value).toBeNull();
    });

    it('diff() sets a ConceptDiff for two real concepts', () => {
      const { diffResult, diff } = useConceptDiff();
      const oldData = {
        id: '1',
        localizations: {
          eng: { terms: [{ designation: 'old term', type: 'expression', normative_status: 'preferred' }] },
        },
      };
      const newData = {
        id: '1',
        localizations: {
          eng: { terms: [{ designation: 'new term', type: 'expression', normative_status: 'preferred' }] },
        },
      };
      diff(oldData, newData);
      expect(diffResult.value).not.toBeNull();
      expect(diffResult.value?.oldId).toBe('1');
      expect(diffResult.value?.newId).toBe('1');
    });

    it('diff() against identical concepts reports hasChanges=false', () => {
      const { diffResult, diff } = useConceptDiff();
      const data = {
        id: '1',
        localizations: {
          eng: { terms: [{ designation: 'same', type: 'expression', normative_status: 'preferred' }] },
        },
      };
      diff(data, data);
      expect(diffResult.value?.hasChanges).toBe(false);
    });

    it('diff() catches errors and exposes them', () => {
      const { error, diffResult, diff } = useConceptDiff();
      // A concept whose `localization` throws — simulates malformed input
      const bad = {
        get localizations() { throw new Error('boom'); },
      } as any;
      diff(bad, bad);
      expect(error.value).toBeTruthy();
      expect(diffResult.value).toBeNull();
    });
  });
});
