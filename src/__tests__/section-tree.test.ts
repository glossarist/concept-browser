import { describe, it, expect } from 'vitest';
import type { SectionNode } from '../adapters/types';
import {
  findSectionNode,
  collectDescendantSectionIds,
  toSectionNode,
  toSectionTree,
} from '../utils/section-tree';

const TREE: SectionNode[] = [
  {
    id: '102',
    names: { eng: 'Mathematics' },
    conceptCount: 0,
    children: [
      { id: '102-01', names: { eng: 'Sets' }, conceptCount: 5 },
      {
        id: '102-02',
        names: { eng: 'Numbers' },
        conceptCount: 3,
        children: [
          { id: '102-02-01', names: { eng: 'Reals' }, conceptCount: 1 },
        ],
      },
    ],
  },
  { id: '103', names: { eng: 'Functions' }, conceptCount: 0 },
];

describe('findSectionNode', () => {
  it('finds a root by id', () => {
    expect(findSectionNode(TREE, '103')?.id).toBe('103');
  });

  it('finds a descendant by id (recursive)', () => {
    expect(findSectionNode(TREE, '102-02-01')?.id).toBe('102-02-01');
  });

  it('returns null for unknown id', () => {
    expect(findSectionNode(TREE, '999')).toBeNull();
  });

  it('returns null for empty tree', () => {
    expect(findSectionNode([], '102')).toBeNull();
  });
});

describe('collectDescendantSectionIds', () => {
  it('includes root and all descendants at arbitrary depth', () => {
    const ids = collectDescendantSectionIds(TREE, '102');
    expect([...ids].sort()).toEqual(['102', '102-01', '102-02', '102-02-01']);
  });

  it('returns single-element set for a leaf', () => {
    expect([...collectDescendantSectionIds(TREE, '103')]).toEqual(['103']);
  });

  it('returns empty set for unknown root', () => {
    expect(collectDescendantSectionIds(TREE, '999').size).toBe(0);
  });
});

describe('toSectionNode', () => {
  it('maps minimal input with id only', () => {
    expect(toSectionNode({ id: 'x' })).toEqual({
      id: 'x',
      names: {},
      conceptCount: 0,
    });
  });

  it('preserves names and conceptCount', () => {
    expect(toSectionNode({ id: 'x', names: { eng: 'X' }, conceptCount: 7 })).toEqual({
      id: 'x',
      names: { eng: 'X' },
      conceptCount: 7,
    });
  });

  it('defaults missing id to empty string', () => {
    expect(toSectionNode({}).id).toBe('');
  });

  it('defaults missing conceptCount to 0', () => {
    expect(toSectionNode({ id: 'x' }).conceptCount).toBe(0);
  });

  it('defaults missing names to empty object', () => {
    expect(toSectionNode({ id: 'x' }).names).toEqual({});
  });

  it('recursively maps children', () => {
    const node = toSectionNode({
      id: 'p',
      names: { eng: 'Parent' },
      children: [{ id: 'c', names: { eng: 'Child' } }],
    });
    expect(node.children?.[0]).toEqual({
      id: 'c',
      names: { eng: 'Child' },
      conceptCount: 0,
    });
  });

  it('omits children array when source has none', () => {
    expect(toSectionNode({ id: 'x' }).children).toBeUndefined();
  });

  it('omits children array when source children is empty', () => {
    expect(toSectionNode({ id: 'x', children: [] }).children).toBeUndefined();
  });
});

describe('toSectionTree', () => {
  it('maps a list of roots', () => {
    const tree = toSectionTree([
      { id: 'a', names: { eng: 'A' } },
      { id: 'b' },
    ]);
    expect(tree).toHaveLength(2);
    expect(tree[0].id).toBe('a');
    expect(tree[1].names).toEqual({});
  });

  it('returns empty array for empty input', () => {
    expect(toSectionTree([])).toEqual([]);
  });
});
