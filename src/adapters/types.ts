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

// ── Dataset metadata ──────────────────────────────────────────────────────

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
  color?: string;
  shortname?: string;
  languageOrder?: string[];
  ref?: string;
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
}

export interface ConceptEntry {
  id: string;
  designations: Record<string, string>;
  groups: string[];
  tags: string[];
  status: string;
}

export interface DatasetRegistry {
  id: string;
  manifestUrl: string;
}

// ── Graph types ────────────────────────────────────────────────────────────

export const EDGE_TYPE = {
  REFERENCES: 'references',
  DOMAIN: 'domain',
} as const;

export interface GraphEdge {
  source: string;
  target: string;
  type: string;
  label?: string;
  register: string;
  lang?: string;
}

export interface GraphNode {
  uri: string;
  register: string;
  conceptId: string;
  designations: Record<string, string>;
  status: string;
  loaded: boolean;
  nodeType?: 'concept' | 'domain';
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
