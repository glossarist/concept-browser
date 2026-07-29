/**
 * Wire-format keys for the JSON-LD bridge.
 *
 * Single source of truth for the `'gl:*'` and `'@*'` string keys used
 * across `src/adapters/model-bridge*.ts` to read the JSON-LD wire
 * format produced by `scripts/generate-data.mjs`.
 *
 * Why this exists:
 *   - Replaces ~230 inline string literals that were spread across
 *     adapter files. Typos like `'gl:presnce'` were undetectable at
 *     compile time.
 *   - When glossarist-js's JSON-LD context adds/renames a field, the
 *     change is one entry here, not a grep-and-replace exercise.
 *
 * The interface declarations in `model-bridge/jsonld-types.ts` still
 * use string literals — TypeScript interface keys cannot reference
 * a `const`. The literals there MUST agree with the constants here;
 * the `WireKeys` type at the bottom of this file constrains them to
 * the same set.
 *
 * Adding a new wire field:
 *   1. Add the key constant here.
 *   2. Add the interface field in `jsonld-types.ts`.
 *   3. Add the mapper logic in `model-bridge.ts`.
 *
 * (3 steps for new fields instead of touching 5+ files.)
 */

export const GL = {
  // JSON-LD core
  ID: '@id',
  TYPE: '@type',

  // Concept-level
  IDENTIFIER: 'gl:identifier',
  TERM: 'gl:term',
  LOCALIZED_CONCEPT: 'gl:localizedConcept',
  RELATED: 'gl:related',
  PARTITIVE_RELATIONS: 'gl:partitiveRelations',
  TAGS: 'gl:tags',

  // LocalizedConcept
  LANGUAGE_CODE: 'gl:languageCode',
  ENTRY_STATUS: 'gl:entryStatus',
  CLASSIFICATION: 'gl:classification',
  REVIEW_TYPE: 'gl:reviewType',
  DOMAIN: 'gl:domain',
  RELEASE: 'gl:release',
  LINEAGE_SOURCE_SIMILARITY: 'gl:lineageSourceSimilarity',
  SCRIPT: 'gl:script',
  SYSTEM: 'gl:system',
  DESIGNATION: 'gl:designation',
  DEFINITION: 'gl:definition',
  NOTES: 'gl:notes',
  ANNOTATIONS: 'gl:annotations',
  EXAMPLES: 'gl:examples',
  SOURCE: 'gl:source',
  DATES: 'gl:dates',
  REFERENCES: 'gl:references',

  // Review fields
  REVIEW_DATE: 'gl:reviewDate',
  REVIEW_DECISION_DATE: 'gl:reviewDecisionDate',
  REVIEW_DECISION_EVENT: 'gl:reviewDecisionEvent',
  REVIEW_STATUS: 'gl:reviewStatus',
  REVIEW_DECISION: 'gl:reviewDecision',
  REVIEW_DECISION_NOTES: 'gl:reviewDecisionNotes',

  // Designation
  NORMATIVE_STATUS: 'gl:normativeStatus',
  ABSENT: 'gl:absent',
  FIELD_OF_APPLICATION: 'gl:fieldOfApplication',
  USAGE_INFO: 'gl:usageInfo',
  GEOGRAPHICAL_AREA: 'gl:geographicalArea',
  LANGUAGE: 'gl:language',
  INTERNATIONAL: 'gl:international',
  TERM_TYPE: 'gl:termType',
  PRONUNCIATION: 'gl:pronunciation',
  PREFIX: 'gl:prefix',
  GENDER: 'gl:gender',
  GRAMMAR_INFO: 'gl:grammarInfo',

  // GrammarInfo
  NUMBER: 'gl:number',
  PART_OF_SPEECH: 'gl:partOfSpeech',
  NOUN: 'gl:noun',
  VERB: 'gl:verb',
  ADJ: 'gl:adj',
  ADVERB: 'gl:adverb',
  PREPOSITION: 'gl:preposition',
  PARTICIPLE: 'gl:participle',

  // Pronunciation
  COUNTRY: 'gl:country',

  // Content (definition, notes, examples, annotations)
  CONTENT: 'gl:content',

  // Date
  DATE: 'gl:date',
  DATE_TYPE: 'gl:dateType',

  // ConceptRef / Citation.Origin
  REF: 'gl:ref',
  LOCALITY: 'gl:locality',
  LINK: 'gl:link',
  VERSION: 'gl:version',
  TEXT: 'gl:text',

  // Locally-scoped id within source/origin/ref (NOT JSON-LD's @id)
  LOCAL_ID: 'gl:id',

  // Locality
  LOCALITY_TYPE: 'gl:localityType',
  REFERENCE_FROM: 'gl:referenceFrom',
  REFERENCE_TO: 'gl:referenceTo',

  // ConceptSource
  SOURCE_TYPE: 'gl:sourceType',
  SOURCE_STATUS: 'gl:sourceStatus',
  MODIFICATION: 'gl:modification',
  ORIGIN: 'gl:origin',
  SOURCED_FROM: 'gl:sourcedFrom',
  SOURCED_FROM_ALT: 'gl:sourced_from',

  // RelatedConcept
  RELATIONSHIP_TYPE: 'gl:relationshipType',
  TARGET: 'gl:target',
  SOURCE_ID: 'gl:sourceId',
  CITATION: 'gl:citation',

  // PartitiveMember (MECE)
  PRESENCE: 'gl:presence',
  COUNT: 'gl:count',
  IS_DELIMITING: 'gl:isDelimiting',
  MULTIPLICITY: 'gl:multiplicity',
  CERTAINTY: 'gl:certainty',

  // PartitiveRelation
  COMPREHENSIVE: 'gl:comprehensive',
  HAS_PARTITIVE: 'gl:hasPartitive',
  COMPLETENESS: 'gl:completeness',
  CRITERION: 'gl:criterion',

  // Non-verbal entity references at concept level
  FIGURE_REF: 'gl:figureRef',
  TABLE_REF: 'gl:tableRef',
  FORMULA_REF: 'gl:formulaRef',

  // NonVerbalReference display string
  DISPLAY: 'gl:display',
} as const;

export type WireKey = typeof GL[keyof typeof GL];
