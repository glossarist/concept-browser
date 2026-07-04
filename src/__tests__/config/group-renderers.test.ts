import { describe, it, expect } from 'vitest';
import { GROUP_RENDERERS, groupRendererFor } from '../../config/group-renderers';
import type { DatasetGroupKind } from '../../config/types';

describe('GROUP_RENDERERS registry', () => {
  it('has an entry for every DatasetGroupKind', () => {
    const expected: DatasetGroupKind[] = ['lineage', 'topic', 'family', 'collection', 'default'];
    for (const kind of expected) {
      expect(GROUP_RENDERERS[kind], `missing ${kind}`).toBeDefined();
      expect(GROUP_RENDERERS[kind].sidebar, `missing sidebar for ${kind}`).toBeDefined();
    }
  });

  it('lineage uses a distinct sidebar component', () => {
    expect(GROUP_RENDERERS.lineage.sidebar).not.toBe(GROUP_RENDERERS.default.sidebar);
  });

  it('topic, family, collection, default share the DefaultGroupSidebar', () => {
    const defaultSidebar = GROUP_RENDERERS.default.sidebar;
    expect(GROUP_RENDERERS.topic.sidebar).toBe(defaultSidebar);
    expect(GROUP_RENDERERS.family.sidebar).toBe(defaultSidebar);
    expect(GROUP_RENDERERS.collection.sidebar).toBe(defaultSidebar);
  });
});

describe('groupRendererFor', () => {
  it('returns the correct renderer for each kind', () => {
    expect(groupRendererFor('lineage').kind).toBe('lineage');
    expect(groupRendererFor('topic').kind).toBe('topic');
  });

  it('falls back to default for unknown kinds', () => {
    expect(groupRendererFor('nonexistent' as DatasetGroupKind)).toBe(GROUP_RENDERERS.default);
  });
});