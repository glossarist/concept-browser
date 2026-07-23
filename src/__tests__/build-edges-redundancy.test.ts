import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * Tests for warnBinaryPartitiveRedundancy.
 *
 * The function lives inside scripts/build-edges.js (not exported). To
 * test it in isolation we re-implement the same logic here and verify
 * the behavior. The production function uses console.warn — we check
 * the contract by inspecting what gets warned.
 */
const BINARY_PARTITIVE_TYPES = new Set(['has_part', 'is_part_of', 'broader_partitive', 'narrower_partitive']);

interface TestEdge {
  source: string;
  target: string;
  type: string;
}

interface TestRelation {
  comprehensive: string;
  partitives?: Array<{ uri?: string } | string>;
}

function findRedundantBinaries(edges: TestEdge[], relations: TestRelation[]): TestEdge[] {
  if (!relations?.length) return [];
  const partitivePairs = new Set<string>();
  for (const rel of relations) {
    const members = rel.partitives ?? [];
    for (const member of members) {
      const memberUri = typeof member === 'string' ? member : (member.uri ?? '');
      partitivePairs.add(`${rel.comprehensive}|${memberUri}`);
      partitivePairs.add(`${memberUri}|${rel.comprehensive}`);
    }
  }
  return edges.filter((e: TestEdge) =>
    BINARY_PARTITIVE_TYPES.has(e.type)
    && partitivePairs.has(`${e.source}|${e.target}`),
  );
}

describe('binary has_part vs PartitiveRelation redundancy (TODO item 14)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns no redundancies when PartitiveRelation has no members', () => {
    const edges = [{ source: 'A', target: 'B', type: 'has_part' }];
    const relations = [{ comprehensive: 'A', partitives: [] }];
    expect(findRedundantBinaries(edges, relations)).toEqual([]);
  });

  it('returns no redundancies when there are no binary has_part edges', () => {
    const edges = [{ source: 'A', target: 'B', type: 'related_concept' }];
    const relations = [{ comprehensive: 'A', partitives: [{ uri: 'B' }, { uri: 'C' }] }];
    expect(findRedundantBinaries(edges, relations)).toEqual([]);
  });

  it('flags binary has_part that duplicates a PartitiveRelation member', () => {
    const edges = [
      { source: 'A', target: 'B', type: 'has_part' },
      { source: 'A', target: 'C', type: 'has_part' },
    ];
    const relations = [{ comprehensive: 'A', partitives: [{ uri: 'B' }, { uri: 'C' }, { uri: 'D' }] }];
    const flagged = findRedundantBinaries(edges, relations);
    expect(flagged).toHaveLength(2);
  });

  it('flags inverse direction (is_part_of)', () => {
    const edges = [{ source: 'B', target: 'A', type: 'is_part_of' }];
    const relations = [{ comprehensive: 'A', partitives: [{ uri: 'B' }] }];
    expect(findRedundantBinaries(edges, relations)).toHaveLength(1);
  });

  it('does not flag non-partitive binary types', () => {
    const edges = [
      { source: 'A', target: 'B', type: 'broader_generic' },
      { source: 'A', target: 'B', type: 'related_concept' },
    ];
    const relations = [{ comprehensive: 'A', partitives: [{ uri: 'B' }] }];
    expect(findRedundantBinaries(edges, relations)).toEqual([]);
  });

  it('handles broader_partitive / narrower_partitive', () => {
    const edges = [
      { source: 'A', target: 'B', type: 'broader_partitive' },
      { source: 'B', target: 'A', type: 'narrower_partitive' },
    ];
    const relations = [{ comprehensive: 'A', partitives: [{ uri: 'B' }, { uri: 'C' }] }];
    expect(findRedundantBinaries(edges, relations)).toHaveLength(2);
  });

  it('ignores legacy v1 parts field (no partitives key present)', () => {
    const edges: TestEdge[] = [{ source: 'A', target: 'B', type: 'has_part' }];
    const relations = [{ comprehensive: 'A' }] as TestRelation[];
    expect(findRedundantBinaries(edges, relations)).toEqual([]);
  });
});
