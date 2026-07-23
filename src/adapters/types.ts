/**
 * Infrastructure types for the vocabulary browser.
 * Concept model types come from glossarist-js via model-bridge.ts.
 */
import type { RELATIONSHIP_TYPES } from 'glossarist';

// Re-export glossarist model types for convenience
export type {
  Concept,
  LocalizedConcept,
  Designation,
  Expression,
  Abbreviation,
  Symbol as SymbolDesignation,
  GraphicalSymbol,
  Citation,
  ConceptSource,
  RelatedConcept,
  ConceptDate,
  DetailedDefinition,
  NonVerbRep,
} from 'glossarist';

export type {
  LetterSymbol,
  GrammarInfo,
  Pronunciation,
  ConceptReference,
  Locality,
} from 'glossarist/models';

export { RELATIONSHIP_TYPES, DATE_TYPES } from 'glossarist';
export { GRAMMAR_GENDERS, GRAMMAR_NUMBERS, GRAMMAR_PARTS_OF_SPEECH } from 'glossarist/models';

// Re-export citation classification from ReferenceResolver (single definition site)
export type { CitationClassification, CiteResolution } from './ReferenceResolver';

// ── Dataset metadata ──────────────────────────────────────────────────────

export interface ManifestSection {
  id: string;
  names: Record<string, string>;
  ordering?: string;
  children?: ManifestSection[];
}

export interface Manifest {
  id: string;
  datasetUri: string;
  uriAliases?: string[];
  title: string;
  description: string;
  owner: string;
  baseUrl: string;
  languages: string[];
  conceptCount: number;
  conceptUrlTemplate: string;
  indexUrl: string;
  contextUrl: string;
  uriBase: string;
  status: string;
  schemaVersion: string;
  tags: string[];
  lastUpdated: string;
  sourceRepo: string;
  chunkSize: number;
  color?: string | { light: string; dark: string };
  shortname?: string;
  languageOrder?: string[];
  ref?: string;
  refAliases?: string[];
  editionStatus?: string;
  /**
   * Edition year, sourced from register.yaml:year. When the dataset id
   * doesn't contain a parseable year (e.g. "isotc204-ed3"), this field
   * is the only way to position the edition correctly in a lineage
   * timeline. Falls back to extractYear(id/ref/title) at the consumer.
   */
  year?: number;
  ordering?: string;
  sections?: ManifestSection[];
  languageStats?: Record<string, { terms: number; definitions: number }>;
  availableFormats?: string[];
  bulkFormats?: { file: string; format: string; size: number }[];
}

export interface ConceptIndex {
  registerId: string;
  schemaVersion: string;
  conceptCount: number;
  chunkSize: number;
  chunks: { file: string; count: number }[];
  concepts: (ConceptSummary | undefined)[];
}

export interface ConceptSummary {
  id: string;
  designations: Record<string, string>;
  eng: string;
  status: string;
  groups?: string[];
}

export interface ConceptEntry {
  id: string;
  designations: Record<string, string>;
  groups: string[];
  tags: string[];
  status: string;
}

export interface DatasetSummary {
  title: string;
  description: string;
  conceptCount: number;
  languages: string[];
  owner: string;
  tags: string[];
  color?: string | { light: string; dark: string };
  year?: number;
}

export interface DatasetRegistry {
  id: string;
  manifestUrl: string;
  summary?: DatasetSummary;
  datasetUri?: string;
  uriBase?: string;
  uriAliases?: string[];
  ref?: string;
  refAliases?: string[];
}

// ── Graph types ────────────────────────────────────────────────────────────

export const EDGE_TYPE = {
  REFERENCES: 'references',
  DOMAIN: 'domain',
  SECTION: 'section',
} as const;

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  label?: string;
  register: string;
  lang?: string;
}

/**
 * Wire-shape projection of a PartitiveRelation — used by:
 *   - build-edges.js output (partitive_relations.json)
 *   - GraphDataSource (loads the wire file for tools/future consumers)
 *   - use-concept-edges composable (projects the glossarist-js model
 *     into this shape for display, resolving ConceptRef → URI)
 *
 * The glossarist-js `PartitiveRelation` class is the model SSOT
 * (ConceptRef-based). This interface is the *resolved-for-display*
 * shape — keep the two concerns separate.
 *
 * Renamed from `PartitiveRelation` to avoid collision with the
 * upstream model class. v2 shape per concept-model
 * TODO.partitive-relation-v2.
 */
export interface PartitiveRelationWire {
  source: string;
  comprehensive: string;
  partitives: PartitiveMemberWire[];
  completeness: 'complete' | 'partial';
  plurality: TypeSharedPluralityWire | null;
  criterion?: Record<string, string>;
  register: string;
}

export interface PartitiveMemberWire {
  uri: string;
  certainty: 'confirmed' | 'possible';
}

export interface TypeSharedPluralityWire {
  isShared: boolean;
  isUncertain: boolean;
  sharedType?: string | null;
}

export interface GraphNode {
  uri: string;
  register: string;
  conceptId: string;
  designations: Record<string, string>;
  status: string;
  loaded: boolean;
  nodeType?: 'concept' | 'domain';
  conceptCount?: number;
  children?: SectionNode[];
}

export interface SectionNode {
  id: string;
  names: Record<string, string>;
  conceptCount: number;
  children?: SectionNode[];
}

// ── Search ─────────────────────────────────────────────────────────────────

export interface SearchHit {
  conceptId: string;
  registerId: string;
  designation: string;
  language: string;
  matchField: 'designation' | 'id';
  snippet?: string;
}

// ── Resolution ─────────────────────────────────────────────────────────────

export type RelationType = typeof RELATIONSHIP_TYPES[number];

export type Resolution =
  | { type: 'internal'; registerId: string; conceptId: string; crossDataset: boolean }
  | { type: 'site'; baseUrl: string; conceptUri: string; label: string }
  | { type: 'url'; url: string; label: string }
  | { type: 'unresolved'; uri: string };
