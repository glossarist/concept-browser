/**
 * Model bridge: converts between wire-format JSON and glossarist-js
 * model instances.
 *
 * Supports two input formats:
 * 1. JSON-LD (gl:-prefixed) — format produced by generate-data.mjs
 * 2. Glossarist native — snake_case format from glossarist-js Concept.toJSON()
 *
 * Public API is re-exported here. Internal organization:
 *   - jsonld-types.ts  — wire-format interface declarations
 *   - bridges.ts       — WeakMap bridges for fields not yet in glossarist-js
 *   - mappers.ts       — JSON-LD → snake_case mappers
 *   - partitive.ts     — PartitiveRelation mapping + MECE migration
 *   - entity-refs.ts   — non-verbal entity reference normalization
 *   - concept.ts       — top-level Concept orchestration + URI construction
 */
export {
  conceptFromJson,
  conceptToSummary,
  conceptUri,
} from './concept';

export {
  getAnnotations,
  getDesignationTarget,
  getRefText,
  getRelatedSourceId,
  getRelatedCitation,
} from './bridges';

export type {
  JsonLdConcept,
  JsonLdLocalizedConcept,
  JsonLdPartitiveMember,
  JsonLdPartitiveRelation,
  JsonLdDesignation,
  JsonLdSource,
  JsonLdOrigin,
  JsonLdRelated,
  JsonLdRef,
  JsonLdLocality,
  JsonLdDate,
  JsonLdContent,
  JsonLdPronunciation,
  JsonLdGrammarInfo,
} from './jsonld-types';
