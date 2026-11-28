/**
 * navigation-tree.ts — client-side helpers over navigation.json's tree
 * (issue #261). Pure functions so the Browse view stays declarative and
 * the closure/filter semantics are testable without mounting components.
 */
import type { NavigationNode, NavigationTreeKind } from '../adapters/navigation-index';
import type { ConceptSummary } from '../adapters/types';

/** Flattened row the tree renders: node plus its structural position. */
export interface FlattenedTreeNode {
  node: NavigationNode;
  /** 0-based nesting depth. */
  depth: number;
  hasChildren: boolean;
  /** Identity of the nearest visible ancestor ('' for roots). */
  parentId: string;
}

/**
 * Depth-first flattening of the expanded frontier only — collapsed
 * subtrees contribute nothing, so the renderable row count stays
 * proportional to what the user opened, not to the register size.
 */
export function flattenTree(
  roots: readonly NavigationNode[],
  expanded: ReadonlySet<string>,
): FlattenedTreeNode[] {
  const rows: FlattenedTreeNode[] = [];
  const walk = (nodes: readonly NavigationNode[], depth: number, parentId: string) => {
    for (const node of nodes) {
      const hasChildren = !!node.children?.length;
      rows.push({ node, depth, hasChildren, parentId });
      if (hasChildren && expanded.has(node.id)) {
        walk(node.children!, depth + 1, node.id);
      }
    }
  };
  walk(roots, 0, '');
  return rows;
}

/** The node and all its descendants (hierarchy tree: concept-id closure). */
export function subtreeIds(node: NavigationNode): string[] {
  const ids: string[] = [];
  const walk = (n: NavigationNode) => {
    ids.push(n.id);
    n.children?.forEach(walk);
  };
  walk(node);
  return ids;
}

/** Descendant section-id closure of a section node (itself included). */
export function sectionClosureIds(node: NavigationNode): Set<string> {
  const ids = new Set<string>([node.id]);
  const walk = (n: NavigationNode) => {
    n.children?.forEach(c => {
      ids.add(c.id);
      walk(c);
    });
  };
  walk(node);
  return ids;
}

/**
 * Does a concept belong to the given section closure? Matches explicit
 * group membership or the clause-stem convention (id === section id, or
 * id extends it with '.' or '-'). Mirrors the build-time matcher in
 * scripts/lib/navigation.ts and DatasetView's section filter; also
 * serves clause-kind trees, whose ids are dotted stems.
 */
export function conceptInSections(
  concept: Pick<ConceptSummary, 'id' | 'groups'>,
  closure: ReadonlySet<string>,
): boolean {
  if (concept.groups?.some(g => closure.has(g))) return true;
  for (const sectionId of closure) {
    if (concept.id === sectionId
      || concept.id.startsWith(sectionId + '.')
      || concept.id.startsWith(sectionId + '-')) return true;
  }
  return false;
}

/** Tree-kind descriptor used by both the note and aria labels. */
export function treeKindLabelKey(kind: NavigationTreeKind): string {
  switch (kind) {
    case 'hierarchy': return 'browse.tree.hierarchy';
    case 'sections': return 'browse.tree.sections';
    case 'clauses': return 'browse.tree.clauses';
    default: return 'browse.tree.none';
  }
}
