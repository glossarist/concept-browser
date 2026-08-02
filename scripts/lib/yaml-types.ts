/**
 * YAML author-format TypeScript interfaces.
 *
 * These types describe the YAML wire format that dataset authors write
 * and that `scripts/generate-data.ts` reads. They are the author-facing
 * contract — the complement to `src/adapters/jsonld-types.ts` (the
 * browser-facing JSON-LD wire format).
 *
 * MECE boundary:
 *   - yaml-types.ts  → INPUT to the build pipeline (what authors write)
 *   - jsonld-types.ts → OUTPUT of the build pipeline (what the browser reads)
 *   - model-bridge.ts → converts JSON-LD → glossarist-js Concept instances
 *
 * Model-driven: field names match the YAML keys authors actually write
 * (snake_case for author-facing, camelCase for internal normalized form).
 */

// ── Content blocks ─────────────────────────────────────────────────────────

export interface YamlContent {
  content?: string;
}

// ── Terms / designations ──────────────────────────────────────────────────

export interface YamlTerm {
  type?: string;
  designation?: string;
  normative_status?: string;
  origin?: YamlOrigin;
  grammar_info?: YamlGrammarInfo[];
  english?: string[];
}

export interface YamlOrigin {
  source?: string;
  ref?: string;
  version?: string;
}

export interface YamlGrammarInfo {
  gender?: string;
  number?: string;
  partOfSpeech?: string;
  noun?: boolean;
  verb?: boolean;
  adj?: boolean;
  adverb?: boolean;
  preposition?: boolean;
  participle?: boolean;
}

// ── Sources ───────────────────────────────────────────────────────────────

export interface YamlSource {
  origin?: YamlOrigin;
  ref?: string;
  link?: string;
  relationship_type?: string;
  status?: string;
  title?: string;
  type?: string;
}

// ── Dates ─────────────────────────────────────────────────────────────────

export interface YamlDate {
  type?: string;
  date?: string;
}

// ── Relations ─────────────────────────────────────────────────────────────

export interface YamlRelation {
  type?: string;
  target?: string | { ref?: string; uri?: string };
  content?: string;
  label?: string;
}

export interface YamlPartitiveMember {
  ref?: string;
  uri?: string;
  presence?: string;
  count?: string;
  delimiting?: boolean;
  multiplicity?: string;
  certainty?: string;
  designation?: string;
  content?: string;
}

export interface YamlPartitiveRelation {
  type?: string;
  target?: string;
  members?: YamlPartitiveMember[];
  criterion?: string;
  multiplicity?: string;
  certainty?: string;
}

export interface YamlGenericRelation {
  type?: string;
  target?: string;
  members?: (string | { ref?: string; uri?: string })[];
  criterion?: string;
}

// ── Localization (per-language concept data) ──────────────────────────────

export interface YamlLocalization {
  language_code?: string;
  terms?: YamlTerm[];
  definition?: YamlContent[];
  notes?: YamlContent[];
  examples?: YamlContent[];
  annotations?: YamlContent[];
  sources?: YamlSource[];
  dates?: YamlDate[];
  domain?: string[];
  references?: YamlSource[];
  entry_status?: string;
  classification?: string;
  review_type?: string;
  review_date?: string;
  review_decision_date?: string;
  review_decision_event?: string;
  review_status?: string;
  review_decision?: string;
  review_decision_notes?: string;
  lineage_source_similarity?: number;
  release?: string;
  script?: string;
  system?: string;
  [key: string]: unknown;
}

// ── Harmonized concept (output of loadConceptFile) ────────────────────────
//
// After loadConceptFile(), the concept is normalized to this shape
// regardless of whether the source was simple or managed format.
// The `_`-prefixed fields are managed-concept metadata hoisted to top level.

export interface HarmonizedConcept {
  termid: string;
  id?: string;
  uri?: string;
  status?: string;
  _related?: YamlRelation[];
  _partitiveRelations?: YamlPartitiveRelation[];
  _genericRelations?: YamlGenericRelation[];
  _domains?: string[];
  _dates?: YamlDate[];
  _sources?: YamlSource[];
  _status?: string;
  _schemaVersion?: string;
  _dateAccepted?: string;
  [lang: string]: unknown;
}

// ── Managed concept YAML doc (multi-doc format) ───────────────────────────

export interface YamlManagedConceptDoc {
  data?: {
    identifier?: string | number;
    language_code?: string;
    domains?: string[];
    [key: string]: unknown;
  };
  related?: YamlRelation[];
  partitive_relations?: YamlPartitiveRelation[];
  generic_relations?: YamlGenericRelation[];
  dates?: YamlDate[];
  sources?: YamlSource[];
  status?: string;
  schema_version?: string;
  date_accepted?: string;
  terms?: YamlTerm[];
  definition?: YamlContent[];
  notes?: YamlContent[];
  examples?: YamlContent[];
  [key: string]: unknown;
}

// ── Dataset manifest ──────────────────────────────────────────────────────

export interface YamlManifestSection {
  id?: string;
  slug?: string;
  title?: string;
  name?: string;
  members?: string[];
  children?: YamlManifestSection[];
  ordering?: string;
}

export interface YamlManifest {
  id?: string;
  title?: string;
  description?: string;
  lastUpdated?: string;
  sourceRepoUrl?: string;
  publisher?: string;
  contactPoint?: string;
  sections?: YamlManifestSection[];
  languageOrder?: string[];
  ref?: Record<string, string>;
  refAliases?: string[];
  editionStatus?: string;
  ordering?: string;
  [key: string]: unknown;
}

// ── Bibliography ──────────────────────────────────────────────────────────

export interface YamlBibliographyEntry {
  reference?: string;
  title?: string;
  link?: string;
  author?: string;
  date?: string;
  publisher?: string;
  type?: string;
  [key: string]: unknown;
}

// ── News/content frontmatter ──────────────────────────────────────────────

export interface YamlNewsFrontmatter {
  title?: string;
  date?: string;
  categories?: string;
  [key: string]: unknown;
}

// ── Content page config ───────────────────────────────────────────────────

export interface YamlContentPage {
  route?: string;
  source?: string;
  title?: string;
  translations?: Record<string, { source?: string; title?: string }>;
  [key: string]: unknown;
}

// ── SHACL constraint (ontology schema) ────────────────────────────────────

export interface ShaclConstraint {
  path?: string | null;
  datatype?: string | null;
  class?: string | null;
  valuesFrom?: string | null;
  nodeKind?: string | null;
  minCount?: number | null;
  maxCount?: number | null;
  in?: string[];
  [key: string]: unknown;
}

// ── Prefix map (Turtle emission) ──────────────────────────────────────────

export type PrefixMap = Record<string, string>;
