/**
 * Wire-format types barrel — single import path for all wire types.
 *
 * Three MECE layers:
 *   - YAML author format (INPUT to build pipeline)
 *   - JSON-LD browser format (OUTPUT of build pipeline)
 *   - Manifest / site-config metadata
 *
 * Usage:
 *   import type { HarmonizedConcept, JsonLdConcept, Manifest } from '@/adapters/wire'
 *
 * Or layer-specific:
 *   import type { HarmonizedConcept } from '@/adapters/wire/yaml'
 *   import type { JsonLdConcept } from '@/adapters/wire/jsonld'
 */

// YAML author format — what dataset authors write
export type {
  YamlContent,
  YamlTerm,
  YamlOrigin,
  YamlGrammarInfo,
  YamlSource,
  YamlDate,
  YamlRelation,
  YamlPartitiveMember,
  YamlPartitiveRelation,
  YamlGenericRelation,
  YamlLocalization,
  HarmonizedConcept,
  YamlManagedConceptDoc,
  YamlManifestSection,
  YamlManifest,
  YamlBibliographyEntry,
  YamlNewsFrontmatter,
  YamlContentPage,
  ShaclConstraint,
  PrefixMap,
} from '../../../scripts/lib/yaml-types';

// JSON-LD browser format — what the SPA reads
export type {
  JsonLdContent,
  JsonLdDate,
  JsonLdPronunciation,
  JsonLdGrammarInfo,
  JsonLdRef,
  JsonLdLocality,
  JsonLdOrigin,
  JsonLdSource,
  JsonLdRelated,
  JsonLdDesignation,
  JsonLdLocalizedConcept,
  JsonLdPartitiveMember,
  JsonLdPartitiveRelation,
  JsonLdConcept,
} from '../jsonld-types';

// Manifest + summary types
export type {
  Manifest,
  ManifestSection,
  ConceptSummary,
  CitationClassification,
  CiteResolution,
} from '../types';

// Wire-key constants (runtime value, not just type)
export { GL } from '../wire-keys';
