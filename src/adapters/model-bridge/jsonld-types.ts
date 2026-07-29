/**
 * JSON-LD wire-format types for the model-bridge.
 *
 * Extracted from model-bridge.ts to keep the mapper/bridge logic
 * scannable. The 'gl:' prefix is the Glossarist JSON-LD namespace —
 * see data/concept-model/ontologies/glossarist.context.jsonld.
 *
 * Wire format is dictated by glossarist-js's JSON-LD context, which
 * is stable. Schema changes are rare and reviewable.
 */

export interface JsonLdContent {
  'gl:content'?: string;
}

export interface JsonLdDate {
  'gl:date'?: string;
  'gl:dateType'?: string;
}

export interface JsonLdPronunciation {
  'gl:content'?: string;
  'gl:language'?: string;
  'gl:script'?: string;
  'gl:system'?: string;
  'gl:country'?: string;
}

export interface JsonLdGrammarInfo {
  'gl:gender'?: string;
  'gl:number'?: string;
  'gl:partOfSpeech'?: string;
  'gl:noun'?: boolean;
  'gl:verb'?: boolean;
  'gl:adj'?: boolean;
  'gl:adverb'?: boolean;
  'gl:preposition'?: boolean;
  'gl:participle'?: boolean;
}

export interface JsonLdRef {
  'gl:source'?: string;
  'gl:id'?: string;
  'gl:version'?: string;
  'gl:text'?: string;
  source?: string;
  id?: string;
  version?: string;
}

export interface JsonLdLocality {
  'gl:localityType'?: string;
  'gl:referenceFrom'?: string;
  'gl:referenceTo'?: string;
  type?: string;
  reference_from?: string;
  reference_to?: string;
}

export interface JsonLdOrigin {
  'gl:ref'?: string | JsonLdRef;
  'gl:locality'?: JsonLdLocality;
  'gl:link'?: string;
  'gl:id'?: string;
  'gl:version'?: string;
  'gl:source'?: string;
}

export interface JsonLdSource {
  'gl:id'?: string;
  'gl:sourceType'?: string;
  'gl:sourceStatus'?: string;
  'gl:modification'?: string;
  'gl:origin'?: JsonLdOrigin;
  'gl:sourcedFrom'?: JsonLdOrigin[];
  'gl:sourced_from'?: JsonLdOrigin[];
}

export interface JsonLdRelated {
  'gl:relationshipType'?: string;
  'gl:ref'?: JsonLdRef;
  '@id'?: string;
  'gl:term'?: string;
  'gl:target'?: string;
  'gl:sourceId'?: string;
  'gl:citation'?: JsonLdOrigin;
}

export interface JsonLdDesignation {
  '@type'?: string;
  'gl:term'?: string;
  'gl:normativeStatus'?: string;
  'gl:absent'?: unknown;
  'gl:fieldOfApplication'?: string;
  'gl:usageInfo'?: string;
  'gl:geographicalArea'?: string;
  'gl:language'?: string;
  'gl:script'?: string;
  'gl:system'?: string;
  'gl:international'?: boolean;
  'gl:termType'?: string;
  'gl:pronunciation'?: JsonLdPronunciation[];
  'gl:source'?: JsonLdSource[];
  'gl:related'?: JsonLdRelated[];
  'gl:prefix'?: string;
  'gl:gender'?: string;
  'gl:grammarInfo'?: JsonLdGrammarInfo[];
}

export interface JsonLdLocalizedConcept {
  'gl:languageCode'?: string;
  'gl:entryStatus'?: string;
  'gl:classification'?: string;
  'gl:reviewType'?: string;
  'gl:domain'?: string;
  'gl:release'?: string;
  'gl:lineageSourceSimilarity'?: number;
  'gl:script'?: string;
  'gl:system'?: string;
  'gl:designation'?: JsonLdDesignation[];
  'gl:definition'?: JsonLdContent[];
  'gl:notes'?: JsonLdContent[];
  'gl:annotations'?: JsonLdContent[];
  'gl:examples'?: JsonLdContent[];
  'gl:source'?: JsonLdSource[];
  'gl:dates'?: JsonLdDate[];
  'gl:references'?: JsonLdRelated[];
  'gl:reviewDate'?: string;
  'gl:reviewDecisionDate'?: string;
  'gl:reviewDecisionEvent'?: string;
  'gl:reviewStatus'?: string;
  'gl:reviewDecision'?: string;
  'gl:reviewDecisionNotes'?: string;
}

export interface JsonLdPartitiveMember {
  'gl:ref'?: JsonLdRef;
  /** ISO 704:2022 MECE: presence (required | optional) */
  'gl:presence'?: string;
  /** ISO 704:2022 MECE: count (exactly_one | at_least_one | multiple) */
  'gl:count'?: string;
  /** ISO 704:2022: delimiting part (3× stroke width in diagrams) */
  'gl:isDelimiting'?: boolean;
  /** Legacy v3 field — one-string multiplicity, split into presence+count */
  'gl:multiplicity'?: string;
  /** Legacy v2 field — migrated to presence+count */
  'gl:certainty'?: string;
}

export interface JsonLdPartitiveRelation {
  'gl:comprehensive'?: JsonLdRef;
  'gl:hasPartitive'?: JsonLdPartitiveMember[];
  'gl:hasGeneric'?: JsonLdPartitiveMember[];
  'gl:members'?: JsonLdPartitiveMember[];
  'gl:completeness'?: string;
  'gl:criterion'?: Record<string, string> | string;
}

export interface JsonLdConcept {
  '@type'?: string;
  '@id'?: string;
  'gl:identifier'?: string | number;
  'gl:term'?: string;
  'gl:localizedConcept'?: Record<string, JsonLdLocalizedConcept>;
  'gl:related'?: JsonLdRelated[];
  'gl:partitiveRelations'?: JsonLdPartitiveRelation[];
  'gl:genericRelations'?: JsonLdPartitiveRelation[];
  'gl:tags'?: string[];
  'gl:figureRef'?: unknown[];
  'gl:tableRef'?: unknown[];
  'gl:formulaRef'?: unknown[];
}
