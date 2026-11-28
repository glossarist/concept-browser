/**
 * DatasetNavigation — wire shape of `{register}/navigation.json`, emitted
 * by scripts/generate-data.ts (issue #261). Single source of truth for
 * the tree/facet Browse UI. Mirrors scripts/lib/navigation.ts.
 */

export type NavigationTreeKind = 'hierarchy' | 'sections' | 'clauses' | 'none';

export interface NavigationNode {
  /** Concept id (hierarchy) or section/clause id (fallback trees). */
  id: string;
  /** Concept designation (hierarchy) or section name/clause id. */
  label?: string;
  /** Concepts under this node's subtree (fallback trees only). */
  count?: number;
  children?: NavigationNode[];
}

export interface DatasetNavigation {
  registerId: string;
  conceptCount: number;
  tree: {
    kind: NavigationTreeKind;
    /** hierarchy only: validated broader/narrower edges founding the tree */
    relationCount?: number;
    roots: NavigationNode[];
  };
  facets: {
    /** language code → concept ids with ≥1 designation term */
    languages: Record<string, string[]>;
    /** entry status → concept ids */
    status: Record<string, string[]>;
    /** normalized standard key → label + concept ids */
    standards: Record<string, { label: string; ids: string[] }>;
  };
}
