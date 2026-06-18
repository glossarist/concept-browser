import { describe, it, expect } from 'vitest';
import {
  KIND_TO_DIR,
  KIND_TO_BRIDGE,
  ALL_KINDS,
  MENTION_KIND_TO_ENTITY_KIND,
  entityKindFromMentionKind,
  kindFromType,
} from '../adapters/non-verbal/kind';

describe('non-verbal kind dispatch', () => {
  describe('KIND_TO_DIR', () => {
    it('maps each kind to its plural directory name', () => {
      expect(KIND_TO_DIR.figure).toBe('figures');
      expect(KIND_TO_DIR.table).toBe('tables');
      expect(KIND_TO_DIR.formula).toBe('formulas');
    });

    it('is frozen (immutable at runtime)', () => {
      expect(Object.isFrozen(KIND_TO_DIR)).toBe(true);
    });
  });

  describe('ALL_KINDS', () => {
    it('includes figure, table, formula', () => {
      expect(ALL_KINDS).toContain('figure');
      expect(ALL_KINDS).toContain('table');
      expect(ALL_KINDS).toContain('formula');
    });
  });

  describe('KIND_TO_BRIDGE', () => {
    it('maps every kind to a function', () => {
      for (const kind of ALL_KINDS) {
        expect(typeof KIND_TO_BRIDGE[kind]).toBe('function');
      }
    });
  });

  describe('MENTION_KIND_TO_ENTITY_KIND', () => {
    it('maps parseMention kinds to entity kinds', () => {
      expect(MENTION_KIND_TO_ENTITY_KIND['fig-ref']).toBe('figure');
      expect(MENTION_KIND_TO_ENTITY_KIND['table-ref']).toBe('table');
      expect(MENTION_KIND_TO_ENTITY_KIND['formula-ref']).toBe('formula');
    });
  });

  describe('entityKindFromMentionKind', () => {
    it('returns the entity kind for known mention kinds', () => {
      expect(entityKindFromMentionKind('fig-ref')).toBe('figure');
      expect(entityKindFromMentionKind('table-ref')).toBe('table');
      expect(entityKindFromMentionKind('formula-ref')).toBe('formula');
    });

    it('returns null for unknown mention kinds', () => {
      expect(entityKindFromMentionKind('cite-ref')).toBeNull();
      expect(entityKindFromMentionKind('numeric')).toBeNull();
      expect(entityKindFromMentionKind('unknown')).toBeNull();
    });
  });

  describe('kindFromType', () => {
    it('accepts gl: prefix', () => {
      expect(kindFromType('gl:Figure')).toBe('figure');
      expect(kindFromType('gl:Table')).toBe('table');
      expect(kindFromType('gl:Formula')).toBe('formula');
    });

    it('accepts gloss: prefix', () => {
      expect(kindFromType('gloss:Figure')).toBe('figure');
    });

    it('returns null for unknown type', () => {
      expect(kindFromType('gl:Unknown')).toBeNull();
    });
  });
});
