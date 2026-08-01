/**
 * Page type registry — OCP-compliant metadata for synthesized pages.
 *
 * Adding a new built-in page type = add one entry to PAGE_TYPES.
 * `synthesizeGlobalPages` and `synthesizeDatasetPages` iterate the
 * registry; no switches to edit.
 *
 * PageConfig.type stays a string — it tags the page's semantic kind
 * for consumers (sidebar, future renderers). The router is the SSOT
 * for route → view dispatch, not this registry.
 *
 * Mirrors the group-renderers.ts pattern: registry + lookup helper.
 */

export interface PageTypeDefinition {
  readonly type: string;
  readonly route: string;
  readonly title: string;
  readonly icon: string;
  readonly scope: 'global' | 'dataset';
  /** When defined, the page is only synthesized when features[flag] is truthy
   *  (or, if the flag starts with '!', when features[flag.slice(1)] is falsy). */
  readonly featureFlag?: string;
  /** Synthesize automatically unless a declared page already uses this route. */
  readonly autoSynthesize?: boolean;
}

export const PAGE_TYPES: readonly PageTypeDefinition[] = [
  { type: 'home',       route: '',        title: 'Home',         icon: 'home',       scope: 'global',  autoSynthesize: true },
  { type: 'concepts',   route: '',        title: 'Concepts',     icon: 'list',       scope: 'dataset', autoSynthesize: true },
  { type: 'search',     route: 'search',  title: 'Search',       icon: 'search',     scope: 'global',  featureFlag: '!search',    autoSynthesize: true },
  { type: 'graph',      route: 'graph',   title: 'Graph',        icon: 'graph',      scope: 'global',  featureFlag: '!graph',     autoSynthesize: true },
  { type: 'ontology',   route: 'ontology',title: 'Ontology',     icon: 'schema',     scope: 'global',  featureFlag: '!ontology',  autoSynthesize: true },
  { type: 'news',       route: 'news',    title: 'News',         icon: 'newspaper',  scope: 'global',  featureFlag: 'news', autoSynthesize: true },
  { type: 'stats',      route: 'stats',   title: 'Statistics',   icon: 'chart',      scope: 'dataset', featureFlag: '!stats',     autoSynthesize: true },
  { type: 'sources',    route: 'sources', title: 'Sources',      icon: 'database',   scope: 'dataset', autoSynthesize: true },
  { type: 'about',      route: 'about',   title: 'About',        icon: 'info',       scope: 'dataset', featureFlag: '!about',     autoSynthesize: true },
  { type: 'learn',      route: 'learn',   title: 'Learn',        icon: 'book',        scope: 'global',  autoSynthesize: true },
] as const;

export type BuiltinPageType = typeof PAGE_TYPES[number]['type'];

const PAGE_TYPE_INDEX: ReadonlyMap<string, PageTypeDefinition> = new Map(
  PAGE_TYPES.map(p => [p.type, p]),
);

export function pageTypeOf(type: string): PageTypeDefinition | undefined {
  return PAGE_TYPE_INDEX.get(type);
}

function featureEnabled(features: Record<string, unknown> | undefined, flag: string): boolean {
  if (flag.startsWith('!')) {
    return features?.[flag.slice(1)] !== false;
  }
  return Boolean(features?.[flag]);
}

/** Synthesize the auto-on pages for a given scope, respecting feature flags
 *  and skipping routes already declared by the user. */
export function synthesizePages(
  scope: 'global' | 'dataset',
  features: Record<string, unknown> | undefined,
  declaredRoutes: ReadonlySet<string>,
): PageTypeDefinition[] {
  return PAGE_TYPES.filter(p => p.scope === scope && p.autoSynthesize)
    .filter(p => !p.featureFlag || featureEnabled(features, p.featureFlag))
    .filter(p => !declaredRoutes.has(p.route));
}
