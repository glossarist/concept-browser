import { describe, it, expect } from 'vitest';
import { resolveGroupKind, groupTypeMeta, GROUP_TYPES } from '../../config/group-types';

describe('resolveGroupKind', () => {
  it('returns explicit kind when set', () => {
    expect(resolveGroupKind({ kind: 'lineage' })).toBe('lineage');
    expect(resolveGroupKind({ kind: 'topic' })).toBe('topic');
    expect(resolveGroupKind({ kind: 'family' })).toBe('family');
    expect(resolveGroupKind({ kind: 'collection' })).toBe('collection');
    expect(resolveGroupKind({ kind: 'default' })).toBe('default');
  });

  it('returns lineage for legacy series: true', () => {
    expect(resolveGroupKind({ series: true })).toBe('lineage');
  });

  it('returns default when neither kind nor series is set', () => {
    expect(resolveGroupKind({})).toBe('default');
  });

  it('prefers explicit kind over legacy series flag', () => {
    expect(resolveGroupKind({ kind: 'topic', series: true })).toBe('topic');
  });
});

describe('groupTypeMeta', () => {
  it('returns metadata for each kind', () => {
    for (const kind of Object.keys(GROUP_TYPES) as Array<keyof typeof GROUP_TYPES>) {
      const meta = groupTypeMeta({ kind });
      expect(meta.kind).toBe(kind);
      expect(meta.label).toBeTruthy();
      expect(meta.description).toBeTruthy();
      expect(meta.glyph).toBeTruthy();
      expect(typeof meta.ordered).toBe('boolean');
      expect(typeof meta.supersession).toBe('boolean');
      expect(typeof meta.sameVocabulary).toBe('boolean');
    }
  });

  it('lineage is ordered with supersession and same vocabulary', () => {
    const meta = groupTypeMeta({ kind: 'lineage' });
    expect(meta.ordered).toBe(true);
    expect(meta.supersession).toBe(true);
    expect(meta.sameVocabulary).toBe(true);
  });

  it('topic is not ordered and no supersession', () => {
    const meta = groupTypeMeta({ kind: 'topic' });
    expect(meta.ordered).toBe(false);
    expect(meta.supersession).toBe(false);
    expect(meta.sameVocabulary).toBe(false);
  });

  it('uses legacy series flag for backward compat', () => {
    const meta = groupTypeMeta({ series: true });
    expect(meta.kind).toBe('lineage');
  });
});

describe('GROUP_TYPES registry', () => {
  it('has an entry for every DatasetGroupKind', () => {
    const expected = ['lineage', 'topic', 'family', 'collection', 'default'];
    for (const kind of expected) {
      expect(GROUP_TYPES).toHaveProperty(kind);
    }
  });

  it('every entry has all required fields', () => {
    for (const [key, meta] of Object.entries(GROUP_TYPES)) {
      expect(meta.kind, `${key}.kind`).toBe(key);
      expect(meta.label, `${key}.label`).toBeTruthy();
      expect(meta.description, `${key}.description`).toBeTruthy();
      expect(meta.glyph, `${key}.glyph`).toBeTruthy();
    }
  });
});