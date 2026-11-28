import { describe, it, expect } from 'vitest';
import {
  flattenTree,
  subtreeIds,
  sectionClosureIds,
  conceptInSections,
  treeKindLabelKey,
} from '../utils/navigation-tree';
import type { NavigationNode } from '../adapters/navigation-index';

const tree: NavigationNode[] = [
  {
    id: '1',
    label: 'quantities',
    children: [
      { id: '1.1', label: 'length', children: [{ id: '1.1.1', label: 'metre' }] },
      { id: '1.2', label: 'mass' },
    ],
  },
  { id: 'sec-2', label: 'Units', count: 5, children: [{ id: 'sec-2.1', label: 'SI', count: 3 }] },
];

describe('flattenTree', () => {
  it('renders only the expanded frontier', () => {
    const collapsed = flattenTree(tree, new Set());
    expect(collapsed.map(r => r.node.id)).toEqual(['1', 'sec-2']);
    expect(collapsed.map(r => r.depth)).toEqual([0, 0]);
    expect(collapsed.map(r => r.hasChildren)).toEqual([true, true]);
  });

  it('includes descendants of expanded nodes with depth and parent', () => {
    const rows = flattenTree(tree, new Set(['1']));
    expect(rows.map(r => r.node.id)).toEqual(['1', '1.1', '1.2', 'sec-2']);
    expect(rows[1].depth).toBe(1);
    expect(rows[1].parentId).toBe('1');
    expect(rows[2].depth).toBe(1);
    expect(rows[2].parentId).toBe('1');
    // Collapsed sec-2 contributes no rows beneath it.
    expect(rows[3].parentId).toBe('');
  });
});

describe('subtreeIds', () => {
  it('returns the node and all descendants', () => {
    const node = tree[0].children![0];
    expect(subtreeIds(node)).toEqual(['1.1', '1.1.1']);
  });
});

describe('sectionClosureIds', () => {
  it('returns the node and all descendant section ids', () => {
    const closure = sectionClosureIds(tree[1]);
    expect([...closure].sort()).toEqual(['sec-2', 'sec-2.1']);
  });
});

describe('conceptInSections', () => {
  it('matches explicit group membership', () => {
    const closure = new Set(['1', '1.1']);
    expect(conceptInSections({ id: 'x-9', groups: ['1.1'] }, closure)).toBe(true);
    expect(conceptInSections({ id: 'x-9', groups: ['9.9'] }, closure)).toBe(false);
  });

  it('matches the clause-stem convention (., -, or exact)', () => {
    const closure = new Set(['2']);
    expect(conceptInSections({ id: '2', groups: [] }, closure)).toBe(true);
    expect(conceptInSections({ id: '2.1', groups: [] }, closure)).toBe(true);
    expect(conceptInSections({ id: '2-31', groups: [] }, closure)).toBe(true);
    expect(conceptInSections({ id: '20-31', groups: [] }, closure)).toBe(false);
    expect(conceptInSections({ id: '3', groups: [] }, closure)).toBe(false);
  });
});

describe('treeKindLabelKey', () => {
  it('maps every tree kind to an i18n key', () => {
    expect(treeKindLabelKey('hierarchy')).toBe('browse.tree.hierarchy');
    expect(treeKindLabelKey('sections')).toBe('browse.tree.sections');
    expect(treeKindLabelKey('clauses')).toBe('browse.tree.clauses');
    expect(treeKindLabelKey('none')).toBe('browse.tree.none');
  });
});
