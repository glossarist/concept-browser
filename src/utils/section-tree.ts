import type { SectionNode } from '../adapters/types';

interface SectionLike {
  id?: string;
  names?: Record<string, string>;
  conceptCount?: number;
  children?: SectionLike[];
}

export function findSectionNode(
  tree: readonly SectionNode[],
  id: string,
): SectionNode | null {
  for (const node of tree) {
    if (node.id === id) return node;
    if (node.children) {
      const found = findSectionNode(node.children, id);
      if (found) return found;
    }
  }
  return null;
}

export function collectDescendantSectionIds(
  tree: readonly SectionNode[],
  rootId: string,
): Set<string> {
  const root = findSectionNode(tree, rootId);
  if (!root) return new Set();
  const ids = new Set<string>();
  const walk = (n: SectionNode) => {
    ids.add(n.id);
    n.children?.forEach(walk);
  };
  walk(root);
  return ids;
}

export function toSectionNode(s: SectionLike): SectionNode {
  const node: SectionNode = {
    id: s.id ?? '',
    names: s.names || {},
    conceptCount: s.conceptCount ?? 0,
  };
  if (s.children && s.children.length > 0) {
    node.children = s.children.map(toSectionNode);
  }
  return node;
}

export function toSectionTree(items: readonly SectionLike[]): SectionNode[] {
  return items.map(toSectionNode);
}
