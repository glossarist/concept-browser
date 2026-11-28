/**
 * navigation.ts — per-register tree/facet navigation extraction (issue #261).
 *
 * Pure functions over the harmonized concept YAML (the same shape the
 * STATS_PROCESSORS in generate-data.ts read), mirroring the curation.ts
 * split: the caller (generate-data's processDataset) supplies the loop
 * context; this module owns the per-concept rules, the tree assembly,
 * and the facet aggregation, so the navigation.json wire shape has one
 * source of truth.
 *
 * Tree precedence (honest hierarchy, first strategy that bears fruit):
 *   1. hierarchy — broader/narrower relations resolving to same-register
 *      concepts (validated against the register's concept-id set)
 *   2. sections  — the register's manifest section tree, with concepts
 *      attached via groups, explicit members, or id/clause stems
 *   3. clauses   — clause stems derived from dotted-numeric concept ids
 *      (VIM-style "1" → "1.1" → "1.1.1"); only when real depth exists
 *   4. none      — no derivable hierarchy; the UI shows facets only
 */

import { naturalSort } from 'glossarist';
import { UriRouter } from '../../src/adapters/UriRouter';
import { stripHtml } from './harmonize-concept';
import type { YamlRelation } from './yaml-types';

/** Relation types that carry sub/superordination. */
export const HIERARCHY_RELATION_TYPES = new Set(['broader', 'narrower']);

// ── Wire shape ───────────────────────────────────────────────────────────────

export interface NavigationNode {
  /** Concept id (hierarchy) or section/clause id (fallbacks). */
  id: string;
  /** Concept designation (hierarchy) or section name/clause id (fallbacks). */
  label?: string;
  /** Concepts under this node's subtree (fallback trees only). */
  count?: number;
  children?: NavigationNode[];
}

export type NavigationTreeKind = 'hierarchy' | 'sections' | 'clauses' | 'none';

export interface NavigationIndex {
  registerId: string;
  conceptCount: number;
  tree: {
    kind: NavigationTreeKind;
    /** hierarchy only: validated broader/narrower edges founding the tree */
    relationCount?: number;
    roots: NavigationNode[];
  };
  facets: {
    /** language code → concept ids with ≥1 designation term (case-normalized) */
    languages: Record<string, string[]>;
    /** entry status → concept ids */
    status: Record<string, string[]>;
    /** normalized standard key → label + concept ids (mirrors standards.json) */
    standards: Record<string, { label: string; ids: string[] }>;
  };
}

// ── Per-concept extraction (called inside processDataset's loop) ────────────

/** Raw hierarchy candidate: target id not yet validated against the register. */
export interface NavigationRelation {
  type: string;
  targetId: string;
}

export interface NavigationEntry {
  id: string;
  /** Plain-text primary designation, best effort (falls back to the id). */
  label: string;
  status: string;
  /** Section ids (getGroups output). */
  groups: string[];
  /** Languages carrying at least one normalized designation term. */
  languages: string[];
  /** Hierarchy-relation candidates, resolved but not yet id-set-validated. */
  related: NavigationRelation[];
}

export interface CollectNavigationOptions {
  termid: string;
  designations: Record<string, string>;
  groups: string[];
  status: string;
  registerId: string;
  refPrefixMap?: Record<string, string>;
}

/**
 * Resolve one relation's target to a same-register concept-id candidate.
 * URI targets must parse to THIS register (UriRouter is the SSOT);
 * ref targets are dropped when refPrefixMap maps their source to another
 * register, and otherwise carried for validation against the concept set.
 * Returns null for every non-hierarchy or unresolvable relation.
 */
export function collectNavigationRelation(
  rel: YamlRelation,
  registerId: string,
  refPrefixMap?: Record<string, string>,
): NavigationRelation | null {
  if (!rel.type || !HIERARCHY_RELATION_TYPES.has(rel.type)) return null;

  if (typeof rel.target === 'string' && rel.target) {
    const parsed = UriRouter.parseUri(rel.target);
    if (!parsed || parsed.registerId !== registerId) return null;
    return { type: rel.type, targetId: parsed.conceptId };
  }

  const ref = rel.ref;
  const id = ref?.id;
  if (!id) return null;
  const mapped = ref?.source && refPrefixMap ? refPrefixMap[ref.source] : undefined;
  if (mapped && mapped !== registerId) return null;
  return { type: rel.type, targetId: String(id) };
}

function hasNormalizedTerm(lc: unknown): boolean {
  if (!lc || typeof lc !== 'object' || Array.isArray(lc)) return false;
  const terms = (lc as Record<string, unknown>).terms;
  if (!Array.isArray(terms)) return false;
  return terms.some(t => {
    if (!t || typeof t !== 'object') return false;
    const raw = (t as Record<string, unknown>).designation;
    if (typeof raw !== 'string') return false;
    return stripHtml(raw).toLowerCase().length > 0;
  });
}

/**
 * Per-concept navigation signals: tree label, per-language facet
 * membership (any language present in the entry, not just configured
 * ones), and hierarchy-relation candidates.
 */
export function collectNavigationEntry(
  conceptYaml: Record<string, any>,
  opts: CollectNavigationOptions,
): NavigationEntry {
  const langs: string[] = [];
  for (const key of Object.keys(conceptYaml)) {
    if (key.startsWith('_')) continue;
    const lc = conceptYaml[key];
    if (!lc || typeof lc !== 'object' || Array.isArray(lc)) continue;
    if (hasNormalizedTerm(lc)) langs.push(key);
  }

  const designations = opts.designations ?? {};
  const label = stripHtml(
    String(designations.eng || Object.values(designations).find(Boolean) || opts.termid),
  );

  const related: NavigationRelation[] = [];
  for (const rel of conceptYaml._related ?? []) {
    const resolved = collectNavigationRelation(rel, opts.registerId, opts.refPrefixMap);
    if (resolved) related.push(resolved);
  }

  return {
    id: opts.termid,
    label,
    status: opts.status,
    groups: opts.groups,
    languages: langs,
    related,
  };
}

// ── Tree assembly ────────────────────────────────────────────────────────────

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Dotted-numeric ids only — VIM-style clause numbers ("1.1.1"), not
    dash-form termids ("17-1") or UUIDs. */
const CLAUSE_ID_RE = /^\d+(\.\d+)*$/;

function clauseStems(id: string): string[] | null {
  if (!CLAUSE_ID_RE.test(id)) return null;
  const parts = id.split('.');
  return parts.map((_, i) => parts.slice(0, i + 1).join('.'));
}

interface SectionLikeNode {
  id?: string;
  names?: Record<string, string>;
  title?: string;
  name?: string;
  members?: string[];
  children?: SectionLikeNode[];
}

function sectionLabel(section: SectionLikeNode): string {
  const names = section.names ?? {};
  return names.eng || Object.values(names).find(Boolean) || section.title || section.name || section.id || '';
}

function collectSections(
  sections: SectionLikeNode[],
  into: Map<string, { label: string; memberIds: Set<string>; childIds: Set<string> }>,
  childOrder: Map<string, string[]>,
): void {
  for (const section of sections ?? []) {
    const id = section.id ?? section.title ?? section.name;
    if (!id || into.has(id)) continue;
    const childIds = new Set<string>();
    (section.children ?? []).forEach(c => {
      const cid = c.id ?? c.title ?? c.name;
      if (cid) childIds.add(cid);
    });
    into.set(id, {
      label: sectionLabel(section),
      memberIds: new Set((section.members ?? []).filter(m => typeof m === 'string')),
      childIds,
    });
    childOrder.set(id, (section.children ?? [])
      .map(c => c.id ?? c.title ?? c.name)
      .filter((c): c is string => typeof c === 'string'));
    if (section.children?.length) collectSections(section.children, into, childOrder);
  }
}

/** Descendant closure of a section id (itself included). */
function sectionClosure(
  id: string,
  sections: Map<string, { childIds: Set<string> }>,
): Set<string> {
  const closure = new Set<string>();
  const walk = (current: string) => {
    if (closure.has(current)) return;
    closure.add(current);
    sections.get(current)?.childIds.forEach(walk);
  };
  walk(id);
  return closure;
}

/**
 * Assemble the navigation index for one register: hierarchy-first tree
 * with section/clause fallbacks, plus facet indices. All output
 * orderings are deterministic (sorted ids; standards keep their
 * encounter order, mirroring standards.json).
 */
export function buildNavigationIndex(
  registerId: string,
  entries: NavigationEntry[],
  options: { sections?: SectionLikeNode[]; standards?: Map<string, { label: string; conceptIds: string[] }> },
): NavigationIndex {
  const sorted = [...entries].sort((a, b) => byId(a.id, b.id));
  const idSet = new Set(sorted.map(e => e.id));

  // ── Tree ──
  const tree = buildTree(sorted, idSet, options.sections ?? []);

  // ── Facets ──
  const languages = new Map<string, string[]>();
  const status = new Map<string, string[]>();
  for (const e of sorted) {
    for (const lang of e.languages) {
      const list = languages.get(lang) ?? [];
      list.push(e.id);
      languages.set(lang, list);
    }
    const list = status.get(e.status) ?? [];
    list.push(e.id);
    status.set(e.status, list);
  }
  const facets: NavigationIndex['facets'] = {
    languages: Object.fromEntries([...languages.entries()].sort((a, b) => byId(a[0], b[0]))),
    status: Object.fromEntries([...status.entries()].sort((a, b) => byId(a[0], b[0]))),
    standards: Object.fromEntries([...(options.standards ?? new Map())].map(([key, s]) => [
      key,
      { label: s.label, ids: s.conceptIds ?? [] },
    ])),
  };

  return {
    registerId,
    conceptCount: sorted.length,
    tree,
    facets,
  };
}

function buildTree(
  entries: NavigationEntry[],
  idSet: Set<string>,
  sections: SectionLikeNode[],
): NavigationIndex['tree'] {
  // 1. Hierarchy: broader/narrower edges validated against the register.
  const parentOf = new Map<string, string>();
  for (const e of entries) {
    for (const rel of e.related) {
      if (!idSet.has(rel.targetId) || rel.targetId === e.id) continue;
      const child = rel.type === 'broader' ? e.id : rel.targetId;
      const parent = rel.type === 'broader' ? rel.targetId : e.id;
      if (!parentOf.has(child)) parentOf.set(child, parent);
    }
  }
  repairCycles(parentOf);
  if (parentOf.size > 0) {
    return {
      kind: 'hierarchy',
      relationCount: parentOf.size,
      roots: buildHierarchyRoots(entries, parentOf),
    };
  }

  // 2. Sections: the register's own section tree, when concepts land in it.
  if (sections.length > 0) {
    const sectionTree = buildSectionTree(entries, sections);
    if (sectionTree) return { kind: 'sections', roots: sectionTree };
  }

  // 3. Clauses: dotted-numeric id stems, when they form real depth.
  const clauseTree = buildClauseTree(entries);
  if (clauseTree) return { kind: 'clauses', roots: clauseTree };

  return { kind: 'none', roots: [] };
}

/** Break parent cycles deterministically: the first sorted node whose
    ancestor walk revisits the path loses its parent link (becomes a root). */
function repairCycles(parentOf: Map<string, string>): void {
  for (const start of [...parentOf.keys()].sort(byId)) {
    if (!parentOf.has(start)) continue;
    const path = new Set<string>([start]);
    let current = start;
    while (parentOf.has(current)) {
      current = parentOf.get(current)!;
      if (path.has(current)) {
        parentOf.delete(start);
        break;
      }
      path.add(current);
    }
  }
}

function buildHierarchyRoots(
  entries: NavigationEntry[],
  parentOf: Map<string, string>,
): NavigationNode[] {
  const byIdMap = new Map(entries.map(e => [e.id, e]));
  const childrenOf = new Map<string, string[]>();
  for (const [child, parent] of parentOf) {
    const list = childrenOf.get(parent) ?? [];
    list.push(child);
    childrenOf.set(parent, list);
  }

  const buildNode = (id: string): NavigationNode => {
    const entry = byIdMap.get(id);
    const kids = (childrenOf.get(id) ?? []).sort(naturalSort);
    const node: NavigationNode = { id };
    if (entry?.label) node.label = entry.label;
    if (kids.length > 0) node.children = kids.map(buildNode);
    return node;
  };

  const roots = [...new Set([
    ...entries.map(e => e.id).filter(id => !parentOf.has(id)),
    ...parentOf.values(),
  ])].filter(id => !parentOf.has(id)).sort(naturalSort);
  return roots.map(buildNode);
}

function conceptInSections(
  entry: NavigationEntry,
  closure: Set<string>,
): boolean {
  if (entry.groups.some(g => closure.has(g))) return true;
  // Clause-stem match for ids that mirror the section numbering.
  for (const sectionId of closure) {
    if (entry.id === sectionId
      || entry.id.startsWith(sectionId + '.')
      || entry.id.startsWith(sectionId + '-')) return true;
  }
  return false;
}

function buildSectionTree(
  entries: NavigationEntry[],
  sections: SectionLikeNode[],
): NavigationNode[] | null {
  const nodes = new Map<string, { label: string; memberIds: Set<string>; childIds: Set<string> }>();
  const childOrder = new Map<string, string[]>();
  collectSections(sections, nodes, childOrder);

  // A section subtree that declares explicit members is authoritative:
  // membership there is exactly the declared ids (child closures included),
  // never augmented by group/clause-stem matching.
  const explicit = new Set<string>();
  for (const id of nodes.keys()) {
    if (nodes.get(id)!.memberIds.size > 0) {
      for (const other of nodes.keys()) {
        if (sectionClosure(other, nodes).has(id)) explicit.add(other);
      }
    }
  }

  const accepts = (id: string, entry: NavigationEntry): boolean => {
    const closure = sectionClosure(id, nodes);
    if (explicit.has(id)) {
      for (const covered of closure) {
        if (nodes.get(covered)!.memberIds.has(entry.id)) return true;
      }
      return false;
    }
    return conceptInSections(entry, closure);
  };

  // Assign each entry to its deepest covering section; node counts then
  // aggregate upward (closure-inclusive), matching what a collapsed tree shows.
  const membersOf = new Map<string, string[]>();
  for (const entry of entries) {
    let deepest: string | null = null;
    for (const id of nodes.keys()) {
      if (!accepts(id, entry)) continue;
      if (!deepest
        || sectionClosure(id, nodes).has(deepest)
        || id.length > deepest.length) deepest = id;
    }
    if (deepest) {
      const list = membersOf.get(deepest) ?? [];
      list.push(entry.id);
      membersOf.set(deepest, list);
    }
  }

  const countCache = new Map<string, number>();
  const countOf = (id: string): number => {
    if (countCache.has(id)) return countCache.get(id)!;
    let total = (membersOf.get(id) ?? []).length;
    for (const childId of childOrder.get(id) ?? []) total += countOf(childId);
    countCache.set(id, total);
    return total;
  };

  const buildNode = (id: string): NavigationNode => {
    const node: NavigationNode = { id, label: nodes.get(id)?.label || id };
    const count = countOf(id);
    if (count > 0) node.count = count;
    const kids = (childOrder.get(id) ?? []).sort(naturalSort);
    if (kids.length > 0) node.children = kids.map(buildNode);
    return node;
  };

  const roots = sections
    .map(s => s.id ?? s.title ?? s.name)
    .filter((id): id is string => typeof id === 'string' && nodes.has(id))
    .sort(naturalSort);
  if (!roots.some(id => countOf(id) > 0)) return null;
  return roots.map(buildNode);
}

function buildClauseTree(entries: NavigationEntry[]): NavigationNode[] | null {
  const stems = new Set<string>();
  const membersOf = new Map<string, string[]>();
  for (const entry of entries) {
    const path = clauseStems(entry.id);
    if (!path) continue;
    path.forEach(s => stems.add(s));
    const list = membersOf.get(entry.id) ?? [];
    list.push(entry.id);
    membersOf.set(entry.id, list);
  }
  // Real depth only: a flat root list is a list, not a hierarchy.
  if (![...stems].some(s => s.includes('.'))) return null;

  const childrenOf = new Map<string, string[]>();
  for (const stem of stems) {
    const dot = stem.lastIndexOf('.');
    if (dot === -1) continue;
    const parent = stem.slice(0, dot);
    const list = childrenOf.get(parent) ?? [];
    list.push(stem);
    childrenOf.set(parent, list);
  }

  const countCache = new Map<string, number>();
  const countOf = (id: string): number => {
    if (countCache.has(id)) return countCache.get(id)!;
    let total = (membersOf.get(id) ?? []).length;
    for (const childId of childrenOf.get(id) ?? []) total += countOf(childId);
    countCache.set(id, total);
    return total;
  };

  const buildNode = (id: string): NavigationNode => {
    const node: NavigationNode = { id, label: id };
    const count = countOf(id);
    if (count > 0) node.count = count;
    const kids = (childrenOf.get(id) ?? []).sort(naturalSort);
    if (kids.length > 0) node.children = kids.map(buildNode);
    return node;
  };

  const roots = [...stems].filter(s => !s.includes('.')).sort(naturalSort);
  return roots.map(buildNode);
}
