// === Branding ===

export type FontCategory = 'serif' | 'sans-serif' | 'monospace';

export interface FontConfig {
  family: string;
  source: 'google' | 'url' | 'local';
  weights?: number[];
  url?: string;
  /** Font category — controls the fallback chain when the primary family
   *  fails to load. Defaults preserve prior behavior: `'serif'` for header,
   *  `'sans-serif'` for body, `'monospace'` for mono.
   *
   *  Set explicitly when the consumer's chosen family doesn't match the
   *  slot's default category — e.g. set `header: { family: 'Inter',
   *  category: 'sans-serif' }` so the fallback chain is
   *  `'Inter', system-ui, sans-serif` instead of `'Inter', Georgia, serif`.
   */
  category?: FontCategory;
}

export interface LogoConfig {
  path: string;
  alt: string;
  url?: string;
  remoteUrl?: string;
  light?: string;
  dark?: string;
  localLight?: string;
  localDark?: string;
}

export interface FaviconConfig {
  /** Path prefix for all favicon URLs. Defaults to '/', set to a sub-path
   *  when deploying under BASE_PATH != '/'. */
  base_path?: string;
  /** Skip emitting the default <link rel="icon"> and <link rel="apple-touch-icon">
   *  tags. Use when the consumer provides their own RFG-compatible markup via
   *  `links_html`. Default: false (emit default tags). */
  skip_default_links?: boolean;
  /** Raw HTML string (one or more <link> tags) to emit in <head> instead of
   *  the default favicon block. RealFaviconGenerator output goes here. */
  links_html?: string;
  /** Consumer-side directory (relative to cwd) holding canonical favicon files.
   *  The CLI's favicon step copies these into public/, overriding defaults. */
  source_dir?: string;
}

export interface SiteBranding {
  primaryColor?: string;
  darkColor?: string;
  fonts?: {
    /** Most prominent display text on each page — home hero, concept name
     *  on the detail page, group/dataset title. No category is dictated;
     *  pick `serif`, `sans-serif`, or `monospace` for any slot. */
    title?: FontConfig;
    /** Section headings (h2–h6). */
    heading?: FontConfig;
    /** Backward-compat alias for `heading` (deprecated). */
    header?: FontConfig;
    /** Paragraph text, lists, table cells. */
    body?: FontConfig;
    /** Code blocks, inline code, kbd. */
    mono?: FontConfig;
  };
  logo?: LogoConfig;
  footerLogo?: LogoConfig;
  favicon?: string | FaviconConfig;
  ownerName?: string;
  ownerUrl?: string;
}

// === Features ===

export interface PoweredByConfig {
  message?: string;
  url?: string;
}

export interface SiteFeatures {
  news?: boolean;
  stats?: boolean;
  graph?: boolean;
  about?: boolean;
  search?: boolean;
  poweredBy?: PoweredByConfig;
}

// === Analytics ===

export interface AnalyticsConfig {
  googleAnalyticsId?: string;
}

// === Navigation ===

export interface NavItem {
  label: string;
  route: string;
}

export interface SocialLinks {
  github?: string;
  twitter?: string;
  [key: string]: string | undefined;
}

// === Routing ===

export type RoutingType = 'site' | 'url';

export interface RoutingEntry {
  uri: string;
  type: RoutingType;
  targetDataset?: string;
  baseUrl?: string;
  url?: string;
  label: string;
}

// === Dataset ===

export type DatasetColorSpec = string | { light: string; dark: string };

export interface DatasetConfig {
  id: string;
  uri: string;
  uriAliases?: string[];
  gcrPackage: string;
  sourceRepo?: string;
  localPath?: string;
  title: string;
  description?: string;
  owner?: string;
  /**
   * Dataset accent color. Accepts either a single hex (applied to both
   * light and dark modes) or an explicit `{ light, dark }` pair.
   * Per-deployment overrides via `site-config.json` `colors.dataset[id]`
   * take precedence.
   */
  color?: DatasetColorSpec;
  tags?: string[];
  languageOrder?: string[];
  ref?: string;
  refAliases?: string[];
  downloads?: string[];
  translations?: Record<string, { title?: string; description?: string }>;
}

// === Contributors ===

export interface Contributor {
  name: string;
  role?: string;
  organization?: string;
  url?: string;
  email?: string;
}

// === Downloads ===

export interface BulkFormatInfo {
  file: string;
  format: string;
  size: number;
}

export const FORMAT_LABELS: Record<string, string> = {
  turtle: 'Turtle (RDF)',
  jsonld: 'JSON-LD (SKOS)',
  tbx: 'TBX-XML',
  jsonl: 'JSONL',
  yaml: 'YAML',
};

// === Pages ===

/**
 * Page type tag. Any string is allowed — built-in tags are listed in
 * `page-types.ts` PAGE_TYPES registry. Adding a new built-in type is
 * a registry entry, not an edit to this union.
 */
export type PageType = string;

export interface PageConfig {
  type: PageType;
  route: string;
  title: string;
  icon: string;
  source?: string;
  datasetScoped?: boolean;
}

// === Dataset Groups ===

/**
 * Kind of dataset group. Determines how the group is rendered in the sidebar
 * and home page, and what semantic relationships between members are assumed.
 *
 * - `lineage` — same vocabulary, different editions (e.g. VIML 1968/2000/2013/2022).
 *   Members have temporal ordering and a supersession chain. Rendered as a
 *   timeline with year badges and "current" markers.
 *
 * - `topic` — different vocabularies on the same subject (e.g. three SDOs
 *   publishing "intelligent transport systems" terminology). Members may
 *   overlap in concepts but have no temporal ordering. Rendered as a card
 *   grid with overlap indicators.
 *
 * - `family` — related vocabularies from the same publisher or program
 *   (e.g. all OIML publications). Hierarchical grouping, no required
 *   relationships between members. Rendered as a flat list under a labeled
 *   header.
 *
 * - `collection` — curated bundle of datasets (e.g. "Starter pack for new
 *   metrologists"). Arbitrary selection, often cross-publisher. Rendered as
 *   a featured card with custom descriptions.
 *
 * - `default` (omitted) — backward-compatible flat list. No special
 *   semantics. Used when no `kind` is specified.
 *
 * The registry in `src/config/group-types.ts` maps each kind to its renderer
 * component, so new kinds can be added without modifying existing code
 * (open/closed principle).
 */
export type DatasetGroupKind = 'lineage' | 'topic' | 'family' | 'collection' | 'default';

export interface DatasetGroup {
  id: string;
  label: string;
  description?: string;
  /**
   * Group accent color. Same shape as DatasetConfig.color.
   * Per-deployment overrides via `site-config.json` `colors.group[id]`.
   */
  color?: DatasetColorSpec;
  datasets: string[];
  translations?: Record<string, { label?: string; description?: string }>;
  /**
   * Discriminator for the group's semantic type and UX. See DatasetGroupKind
   * for the full list of supported values. Defaults to 'default' (flat list).
   *
   * Replaces the older `series?: boolean` flag — use `kind: lineage` instead.
   */
  kind?: DatasetGroupKind;
  /**
   * For lineage series: the dataset id of the current (newest valid) edition.
   * If omitted, the newest member by year (or last in `datasets` order) is
   * used. Setting this explicitly avoids misdetection when only a subset of
   * editions happen to be loaded.
   */
  current?: string;
  /**
   * @deprecated Use `kind: 'lineage'` instead. Still respected as a
   * backward-compat shorthand: `series: true` is treated as `kind: 'lineage'`.
   */
  series?: boolean;
}

// === Site Config ===

export interface SiteColors {
  /** Per-dataset color overrides. Keyed by dataset id. */
  dataset?: Record<string, DatasetColorSpec>;
  /** Per-group color overrides. Keyed by group id. */
  group?: Record<string, DatasetColorSpec>;
  /** Per-relation-type color overrides. Keyed by type id (e.g. "supersedes"). */
  relationshipType?: Record<string, DatasetColorSpec>;
  /** Per-relation-category color overrides. Keyed by category id (e.g. "lifecycle"). */
  relationshipCategory?: Record<string, DatasetColorSpec>;
  /** Per-concept-status color overrides. Keyed by status id. */
  conceptStatus?: Record<string, DatasetColorSpec>;
  /** Per-group-kind color overrides. Keyed by DatasetGroupKind. */
  groupKind?: Record<string, DatasetColorSpec>;
}

export interface SiteConfig {
  id: string;
  domain: string;
  uriBase?: string;
  basePath?: string;
  title: string;
  subtitle?: string;
  description?: string;
  translations?: Record<string, { title?: string; subtitle?: string; description?: string }>;
  datasets: DatasetConfig[];
  datasetGroups?: DatasetGroup[];
  routing: RoutingEntry[];
  branding: SiteBranding;
  analytics?: AnalyticsConfig;
  features?: SiteFeatures;
  social?: SocialLinks;
  nav?: NavItem[];
  footerNav?: NavItem[];
  /** Color overrides. Merged over `data/colors.json` defaults. */
  colors?: SiteColors;
  defaults: {
    language?: string;
    languageOrder?: string[];
    mainLanguages?: string[];
  };
  email?: string;
  pages?: PageConfig[];
  contributors?: Contributor[];
  copyright?: string;
}
