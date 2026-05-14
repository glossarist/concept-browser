/** Core types for the vocabulary browser data model. */

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
  eng: string;
  status: string;
}

export interface ConceptEntry {
  id: string;
  designations: Record<string, string>;
  groups: string[];
  status: string;
}

export interface ConceptDocument {
  '@context': string;
  '@id': string;
  '@type': string;
  'gl:identifier': string;
  'gl:localizedConcept': Record<string, LocalizedConcept>;
}

export interface LocalizedConcept {
  '@id': string;
  '@type': string;
  'gl:languageCode': string;
  'gl:entryStatus'?: string;
  'gl:classification'?: string;
  'gl:reviewType'?: string;
  'gl:script'?: string;
  'gl:system'?: string;
  'gl:designation'?: Designation[];
  'gl:definition'?: DetailedDefinition[];
  'gl:notes'?: DetailedDefinition[];
  'gl:examples'?: DetailedDefinition[];
  'gl:source'?: ConceptSource[];
  'gl:release'?: string;
  'gl:lineageSourceSimilarity'?: number;
  'gl:reviewDate'?: string;
  'gl:reviewDecisionDate'?: string;
  'gl:reviewDecisionEvent'?: string;
  'gl:reviewStatus'?: string;
  'gl:reviewDecision'?: string;
  'gl:reviewDecisionNotes'?: string;
  'gl:dates'?: ConceptDate[];
  'gl:references'?: CrossReference[];
  'gl:domain'?: string;
}

export interface GrammarInfo {
  'gl:gender'?: string;
  'gl:number'?: string;
  'gl:noun'?: boolean;
  'gl:verb'?: boolean;
  'gl:adj'?: boolean;
  'gl:adverb'?: boolean;
  'gl:preposition'?: boolean;
  'gl:participle'?: boolean;
}

export interface Designation {
  '@type': string;
  'gl:normativeStatus': string;
  'gl:term': string;
  'gl:grammarInfo'?: GrammarInfo[];
  'gl:international'?: boolean;
  'gl:termType'?: string;
  'gl:absent'?: boolean;
  'gl:geographicalArea'?: string;
  'gl:prefix'?: string;
  'gl:usageInfo'?: string;
  'gl:fieldOfApplication'?: string;
  'gl:acronym'?: boolean;
  'gl:initialism'?: boolean;
  'gl:truncation'?: boolean;
  'gl:text'?: string;
  'gl:image'?: string;
}

export interface DetailedDefinition {
  '@type': string;
  'gl:content': string;
}

export interface ConceptSource {
  '@type': string;
  'gl:sourceType'?: string;
  'gl:sourceStatus'?: string;
  'gl:modification'?: string;
  'gl:origin'?: {
    '@type': string;
    'gl:ref'?: string;
    'gl:clause'?: string;
    'gl:link'?: string;
  };
}

export interface ConceptDate {
  'gl:dateType': string;
  'gl:date': string;
}

export interface CrossReference {
  '@id': string;
  'gl:term': string;
}

export interface DatasetRegistry {
  id: string;
  manifestUrl: string;
}

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

export interface SearchHit {
  conceptId: string;
  registerId: string;
  designation: string;
  language: string;
  matchField: 'designation' | 'id';
  snippet?: string;
}

export type RelationType =
  | 'related'
  | 'narrower'
  | 'broader'
  | 'see'
  | 'references'
  | 'replaces'
  | 'superseded';

export type Resolution =
  | { type: 'internal'; registerId: string; conceptId: string; crossDataset: boolean }
  | { type: 'site'; baseUrl: string; conceptUri: string; label: string }
  | { type: 'url'; url: string; label: string }
  | { type: 'unresolved'; uri: string };
