/**
 * Model bridge: converts between wire-format JSON and glossarist-js model instances.
 *
 * Supports two input formats:
 * 1. JSON-LD (gl:-prefixed) — legacy format from current generate-data.mjs
 * 2. Glossarist native — snake_case format from glossarist-js Concept.toJSON()
 *
 * All downstream code works exclusively with Concept instances.
 */
import {
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
  RELATIONSHIP_TYPES,
  DATE_TYPES,
  ConceptRef,
} from 'glossarist';
import {
  isPartitivePresence,
  isPartitiveCount,
} from '../utils/partitive-multiplicity';
import { GL } from './wire-keys';
import {
  LetterSymbol,
  GrammarInfo,
  Pronunciation,
  ConceptReference,
  Locality,
  GRAMMAR_GENDERS,
  GRAMMAR_NUMBERS,
  GRAMMAR_PARTS_OF_SPEECH,
} from 'glossarist/models';
import type { ConceptSummary } from './types';
import { ConceptIdentity } from './concept-identity';

// ── JSON-LD wire-format types ─────────────────────────────────────────────
// Extracted to model-bridge/jsonld-types.ts for scannability.

import type {
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
} from './jsonld-types';

// ── Bridges for fields not yet in glossarist-js ────────────────────────────
// Remove each bridge when glossarist-js publishes native support.

// Annotations: LocalizedConcept.annotations
const extraAnnotations = new WeakMap<LocalizedConcept, DetailedDefinition[]>();

export function getAnnotations(lc: LocalizedConcept): DetailedDefinition[] {
  return extraAnnotations.get(lc) ?? [];
}

// Designation relationship targets: RelatedConcept.target (string)
const designationTargets = new WeakMap<object, string>();

export function getDesignationTarget(rc: { type?: string | null; content?: string | null; target?: string | null; ref?: any }): string | null {
  return designationTargets.get(rc) ?? rc.target ?? null;
}

// ConceptRef text: human-readable label alongside source/id
const refTexts = new WeakMap<ConceptRef, string>();

export function getRefText(ref: ConceptRef): string | null {
  return refTexts.get(ref) ?? null;
}

// RelatedConcept.sourceId: links a citation reference back to its source entry
const relatedSourceIds = new WeakMap<object, string>();

export function getRelatedSourceId(rc: object): string | null {
  return relatedSourceIds.get(rc) ?? null;
}

// RelatedConcept.citation: embedded citation data for cite-ref references
const relatedCitations = new WeakMap<object, Record<string, unknown>>();

export function getRelatedCitation(rc: object): Record<string, unknown> | null {
  return relatedCitations.get(rc) ?? null;
}

// Relationship types whose target is a designation string, not a concept ref.
const DESIGNATION_REL_TYPES = new Set(['abbreviated_form_for', 'short_form_for']);

function attachSourcedFromToSources(
  sources: readonly { sourced_from?: unknown }[],
  rawSources: unknown,
): void {
  if (!Array.isArray(rawSources)) return;
  for (let i = 0; i < sources.length && i < rawSources.length; i++) {
    const raw = rawSources[i] as Record<string, unknown> | undefined;
    if (raw?.sourced_from && Array.isArray(raw.sourced_from)) {
      (sources[i] as { sourced_from: unknown }).sourced_from = raw.sourced_from.map(
        (sf: unknown) => sf instanceof Citation ? sf : Citation.fromJSON(sf as Record<string, unknown>)
      );
    }
  }
}

function attachBridges(concept: Concept, localizations: Record<string, unknown>): void {
  for (const lang of concept.languages) {
    const lc = concept.localization(lang);
    const raw = localizations[lang];
    if (!lc || !raw || typeof raw !== 'object') continue;
    const rawObj = raw as Record<string, unknown>;

    // Attach sourced_from to localization-level sources
    attachSourcedFromToSources(lc.sources as unknown as { sourced_from?: unknown }[], rawObj.sources);

    // Annotations
    const annList = rawObj.annotations;
    if (Array.isArray(annList) && annList.length > 0) {
      extraAnnotations.set(lc, annList.map((a: Record<string, unknown>) =>
        DetailedDefinition.fromJSON({ content: (a.content as string) ?? '' }) as DetailedDefinition,
      ));
    }

    // Designation-level relationship targets, ref text, sourceId, citation
    const rawTerms = rawObj.terms;
    if (Array.isArray(rawTerms)) {
      for (let ti = 0; ti < rawTerms.length; ti++) {
        const rawTerm = rawTerms[ti];
        if (!rawTerm || typeof rawTerm !== 'object') continue;
        const rawT = rawTerm as Record<string, unknown>;
        const rawDesignation = rawT.designation as string | undefined;
        if (!rawDesignation) continue;
        const designation = lc.terms.find(d => d.designation === rawDesignation);
        if (!designation) continue;
        const rawRelated = rawT.related;
        if (!Array.isArray(rawRelated)) continue;
        attachRelatedBridges(designation.related, rawRelated);
        // Attach sourced_from to designation-level sources
        attachSourcedFromToSources(
          designation.sources as unknown as { sourced_from?: unknown }[],
          rawT.sources,
        );
      }
    }

    // Localization-level related concepts
    const rawRelated = rawObj.related;
    if (Array.isArray(rawRelated)) {
      attachRelatedBridges(lc.related, rawRelated);
    }
  }
}

/**
 * Attach bridged fields (ref text, sourceId, citation) to RelatedConcept instances
 * from the raw deserialized data. Called after Concept.fromJSON creates the model
 * instances, since RelatedConcept.fromJSON does not read sourceId/citation/text.
 * (It does read type/content/ref/target natively.)
 */
function attachRelatedBridges(
  modelRelated: ReadonlyArray<{ type?: string | null; content?: Record<string, string> | string | null; ref?: any; related?: ReadonlyArray<any> }>,
  rawRelated: unknown[],
): void {
  for (const rawRel of rawRelated) {
    if (!rawRel || typeof rawRel !== 'object') continue;
    const rel = rawRel as Record<string, unknown>;
    const relType = rel.type as string | undefined;
    const rc = relType ? modelRelated.find(r => r.type === relType) : undefined;
    if (!rc) continue;

    // Ref text
    if (rc.ref) {
      const rawRef = rel.ref as Record<string, unknown> | undefined;
      if (rawRef?.text && typeof rawRef.text === 'string') {
        refTexts.set(rc.ref, rawRef.text);
      }
    }

    // Designation target
    if (rel.target && typeof rel.target === 'string') {
      designationTargets.set(rc, rel.target);
    }

    // Source ID — links citation reference back to the ConceptSource entry
    if (rel.sourceId && typeof rel.sourceId === 'string') {
      relatedSourceIds.set(rc, rel.sourceId);
    }

    // Citation — embedded origin data for cite-ref references
    if (rel.citation && typeof rel.citation === 'object') {
      relatedCitations.set(rc, rel.citation as Record<string, unknown>);
    }
  }
}

// ── Detection ─────────────────────────────────────────────────────────────

function isJsonLd(doc: Record<string, unknown>): boolean {
  return '@type' in doc && GL.LOCALIZED_CONCEPT in doc;
}

// ── JSON-LD → Glossarist native mapping ───────────────────────────────────

function mapDesignationFromJsonLd(d: JsonLdDesignation): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const rawType = d['@type'] || '';

  if (rawType.includes('Abbreviation')) result.type = 'abbreviation';
  else if (rawType.includes('LetterSymbol')) result.type = 'letter_symbol';
  else if (rawType.includes('GraphicalSymbol')) result.type = 'graphical_symbol';
  else if (rawType.includes('Symbol')) result.type = 'symbol';
  else result.type = 'expression';

  result.designation = d[GL.TERM] ?? '';
  result.normative_status = d[GL.NORMATIVE_STATUS] ?? null;

  if (d[GL.ABSENT] != null) result.absent = d[GL.ABSENT];
  if (d[GL.FIELD_OF_APPLICATION]) result.field_of_application = d[GL.FIELD_OF_APPLICATION];
  if (d[GL.USAGE_INFO]) result.usage_info = d[GL.USAGE_INFO];
  if (d[GL.GEOGRAPHICAL_AREA]) result.geographical_area = d[GL.GEOGRAPHICAL_AREA];
  if (d[GL.LANGUAGE]) result.language = d[GL.LANGUAGE];
  if (d[GL.SCRIPT]) result.script = d[GL.SCRIPT];
  if (d[GL.SYSTEM]) result.system = d[GL.SYSTEM];
  if (d[GL.INTERNATIONAL] != null) result.international = d[GL.INTERNATIONAL];
  if (d[GL.TERM_TYPE]) result.term_type = d[GL.TERM_TYPE];

  const pronunciation = d[GL.PRONUNCIATION];
  if (pronunciation?.length) {
    result.pronunciation = pronunciation.map((p: any) => ({
      content: p[GL.CONTENT] ?? null,
      language: p[GL.LANGUAGE] ?? null,
      script: p[GL.SCRIPT] ?? null,
      system: p[GL.SYSTEM] ?? null,
      country: p[GL.COUNTRY] ?? null,
    }));
  }

  const sources = d[GL.SOURCE];
  if (sources?.length) {
    result.sources = sources.map(mapSourceFromJsonLd);
  }

  const related = d[GL.RELATED];
  if (related?.length) {
    result.related = related.map((r: any) => {
      const relType = r[GL.RELATIONSHIP_TYPE] ?? 'references';
      if (DESIGNATION_REL_TYPES.has(relType) && r[GL.TARGET]) {
        return { type: relType, target: r[GL.TARGET] };
      }
      return mapRelatedFromJsonLd(r);
    });
  }

  if (d[GL.PREFIX] != null) result.prefix = d[GL.PREFIX];
  if (d[GL.GENDER]) {
    result.grammar_info = [{ gender: d[GL.GENDER] }];
  }
  const grammarInfo = d[GL.GRAMMAR_INFO];
  if (grammarInfo?.length) {
    result.grammar_info = grammarInfo.map((gi: any) => ({
      gender: gi[GL.GENDER] ?? null,
      number: gi[GL.NUMBER] ?? null,
      part_of_speech: gi[GL.PART_OF_SPEECH] ?? null,
      noun: gi[GL.NOUN] ?? false,
      verb: gi[GL.VERB] ?? false,
      adj: gi[GL.ADJ] ?? false,
      adverb: gi[GL.ADVERB] ?? false,
      preposition: gi[GL.PREPOSITION] ?? false,
      participle: gi[GL.PARTICIPLE] ?? false,
    }));
  }

  return result;
}

function mapRefFromJsonLd(rawRef: JsonLdRef | string | undefined): Record<string, unknown> | null {
  if (!rawRef) return null;
  if (typeof rawRef === 'string') return { source: rawRef };
  const refObj: Record<string, unknown> = {};
  // gl:-prefixed keys take precedence over unprefixed keys
  refObj.source = rawRef[GL.SOURCE] ?? rawRef.source;
  refObj.id = rawRef[GL.LOCAL_ID] ?? rawRef.id;
  refObj.version = rawRef[GL.VERSION] ?? rawRef.version;
  if (rawRef[GL.TEXT]) refObj.text = rawRef[GL.TEXT];
  return (refObj.source ?? refObj.id ?? refObj.version ?? refObj.text) != null
    ? refObj : null;
}

/**
 * Map JSON-LD locality to glossarist's snake_case format.
 * Always uses snake_case (reference_from/reference_to) for consistency
 * with the glossarist model.
 */
function mapLocalityFromJsonLd(rawLoc: JsonLdLocality | undefined): Record<string, unknown> | null {
  if (!rawLoc) return null;
  const locObj: Record<string, unknown> = {};
  locObj.type = rawLoc[GL.LOCALITY_TYPE] ?? rawLoc.type;
  locObj.reference_from = rawLoc[GL.REFERENCE_FROM] ?? rawLoc.reference_from;
  locObj.reference_to = rawLoc[GL.REFERENCE_TO] ?? rawLoc.reference_to;
  return (locObj.type ?? locObj.reference_from ?? locObj.reference_to) != null
    ? locObj : null;
}

function mapDetailedDefinitionFromJsonLd(d: any): Record<string, unknown> {
  const result: Record<string, unknown> = { content: d[GL.CONTENT] ?? '' };
  if (d[GL.EXAMPLES]?.length) {
    result.examples = d[GL.EXAMPLES].map(mapDetailedDefinitionFromJsonLd);
  }
  return result;
}

function mapOriginFromJsonLd(o: JsonLdOrigin): Record<string, unknown> {
  const origin: Record<string, unknown> = {};
  const ref = mapRefFromJsonLd(o[GL.REF]);
  if (ref) origin.ref = ref;
  const loc = mapLocalityFromJsonLd(o[GL.LOCALITY]);
  if (loc) origin.locality = loc;
  if (o[GL.LINK]) origin.link = o[GL.LINK];
  if (o[GL.LOCAL_ID]) origin.id = o[GL.LOCAL_ID];
  if (o[GL.VERSION]) origin.version = o[GL.VERSION];
  if (o[GL.SOURCE]) origin.source = o[GL.SOURCE];
  return origin;
}

function mapSourceFromJsonLd(s: JsonLdSource): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // Note: JsonLdSource uses GL.LOCAL_ID for the source's local id, which is
  // distinct from JSON-LD's '@id' (the concept IRI). Keep this as a
  // literal — adding a wire-key for an isolated one-off would be noise.
  if (s[GL.LOCAL_ID]) result.id = s[GL.LOCAL_ID];
  if (s[GL.SOURCE_TYPE]) result.type = s[GL.SOURCE_TYPE];
  if (s[GL.SOURCE_STATUS]) result.status = s[GL.SOURCE_STATUS];
  if (s[GL.MODIFICATION]) result.modification = s[GL.MODIFICATION];

  const origin = s[GL.ORIGIN];
  if (origin) {
    result.origin = mapOriginFromJsonLd(origin);
  }

  const sf = s[GL.SOURCED_FROM] ?? s[GL.SOURCED_FROM_ALT];
  if (sf?.length) {
    result.sourced_from = sf.map((item: any) => mapOriginFromJsonLd(item));
  }

  return result;
}

function mapRelatedFromJsonLd(r: JsonLdRelated): Record<string, unknown> {
  const result: Record<string, unknown> = { type: 'references' };

  if (r[GL.RELATIONSHIP_TYPE]) {
    result.type = r[GL.RELATIONSHIP_TYPE];
  }

  // gl:target is the resolved concept URI for cross-dataset relations
  // (e.g., superseded_by → cie-2020 concept). Without this, the UI
  // renders related concepts as plain text with no clickable link.
  if (r[GL.TARGET]) {
    result.target = r[GL.TARGET];
  }

  if (r[GL.REF]) {
    const ref = mapRefFromJsonLd(r[GL.REF]);
    if (ref) result.ref = ref;
  }

  if (!result.ref && r['@id']) {
    const uri = r['@id'];
    const idMatch = uri.match(/\/concept\/([^/]+)$/);
    result.ref = idMatch
      ? { source: uri.split('/').slice(-3, -2)[0] || '', id: idMatch[1] }
      : { source: uri, id: null };
  }
  if (r[GL.TERM]) result.content = r[GL.TERM];

  // Bridged fields — stored in raw dict, extracted by attachBridges()
  if (r[GL.SOURCE_ID]) result.sourceId = r[GL.SOURCE_ID];
  const rawCitation = r[GL.CITATION];
  if (rawCitation) {
    const c = rawCitation;
    const citation: Record<string, unknown> = {};
    if (c[GL.REF]) {
      const cr = mapRefFromJsonLd(c[GL.REF]);
      if (cr) citation.ref = cr;
    }
    const loc = mapLocalityFromJsonLd(c[GL.LOCALITY]);
    if (loc) citation.locality = loc;
    if (c[GL.LINK]) citation.link = c[GL.LINK];
    if (Object.keys(citation).length > 0) result.citation = citation;
  }

  return result;
}

function mapLocalizedFromJsonLd(lc: JsonLdLocalizedConcept): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (lc[GL.LANGUAGE_CODE]) data.language_code = lc[GL.LANGUAGE_CODE];
  if (lc[GL.ENTRY_STATUS]) data.entry_status = lc[GL.ENTRY_STATUS];
  if (lc[GL.CLASSIFICATION]) data.classification = lc[GL.CLASSIFICATION];
  if (lc[GL.REVIEW_TYPE]) data.review_type = lc[GL.REVIEW_TYPE];
  if (lc[GL.DOMAIN]) data.domain = lc[GL.DOMAIN];
  if (lc[GL.RELEASE]) data.release = lc[GL.RELEASE];
  if (lc[GL.LINEAGE_SOURCE_SIMILARITY] != null) data.lineage_source_similarity = lc[GL.LINEAGE_SOURCE_SIMILARITY];
  if (lc[GL.SCRIPT]) data.script = lc[GL.SCRIPT];
  if (lc[GL.SYSTEM]) data.system = lc[GL.SYSTEM];

  const designation = lc[GL.DESIGNATION];
  if (designation?.length) {
    data.terms = designation.map(mapDesignationFromJsonLd);
  }

  const definition = lc[GL.DEFINITION];
  if (definition?.length) {
    data.definition = definition.map(mapDetailedDefinitionFromJsonLd);
  }

  const notes = lc[GL.NOTES];
  if (notes?.length) {
    data.notes = notes.map(mapDetailedDefinitionFromJsonLd);
  }

  const annotations = lc[GL.ANNOTATIONS];
  if (annotations?.length) {
    data.annotations = annotations.map(mapDetailedDefinitionFromJsonLd);
  }

  const examples = lc[GL.EXAMPLES];
  if (examples?.length) {
    data.examples = examples.map(mapDetailedDefinitionFromJsonLd);
  }

  const lcSources = lc[GL.SOURCE];
  if (lcSources?.length) {
    data.sources = lcSources.map(mapSourceFromJsonLd);
  }

  const dates = lc[GL.DATES];
  if (dates?.length) {
    data.dates = dates.map((d: any) => ({
      date: d[GL.DATE] ?? null,
      type: d[GL.DATE_TYPE] ?? null,
    }));
  }

  const lcReferences = lc[GL.REFERENCES];
  if (lcReferences?.length) {
    data.related = lcReferences.map(mapRelatedFromJsonLd);
  }

  if (lc[GL.REVIEW_DATE]) data.review_date = lc[GL.REVIEW_DATE];
  if (lc[GL.REVIEW_DECISION_DATE]) data.review_decision_date = lc[GL.REVIEW_DECISION_DATE];
  if (lc[GL.REVIEW_DECISION_EVENT]) data.review_decision_event = lc[GL.REVIEW_DECISION_EVENT];
  if (lc[GL.REVIEW_STATUS]) data.review_status = lc[GL.REVIEW_STATUS];
  if (lc[GL.REVIEW_DECISION]) data.review_decision = lc[GL.REVIEW_DECISION];
  if (lc[GL.REVIEW_DECISION_NOTES]) data.review_decision_notes = lc[GL.REVIEW_DECISION_NOTES];

  return data;
}

function mapPartitiveRelationFromJsonLd(r: JsonLdPartitiveRelation): Record<string, unknown> | null {
  const comprehensive = r[GL.COMPREHENSIVE] ? mapRefFromJsonLd(r[GL.COMPREHENSIVE]) : null;
  if (!comprehensive) return null;

  const partitives = (r[GL.HAS_PARTITIVE] ?? [])
    .map((m: any): Record<string, unknown> | null => {
      const ref = m[GL.REF] ? mapRefFromJsonLd(m[GL.REF]) : null;
      if (!ref) return null;
      const out: Record<string, unknown> = { ref };
      // ISO 704:2022 MECE: prefer presence × count from JSON-LD. Fall back
      // to migrating the legacy one-string `multiplicity` or v2 `certainty`
      // so data in transit from older glossarist versions still loads.
      const presence = m[GL.PRESENCE];
      const count = m[GL.COUNT];
      if (isPartitivePresence(presence) && isPartitiveCount(count)) {
        out.presence = presence;
        out.count = count;
      } else {
        const raw = m[GL.MULTIPLICITY] ?? splitLegacyCertainty(m[GL.CERTAINTY]);
        if (raw) {
          const parts = splitMultiplicity(raw);
          out.presence = parts.presence;
          out.count = parts.count;
        }
      }
      if (m[GL.IS_DELIMITING] === true) out.is_delimiting = true;
      return out;
    })
    .filter((m: any): m is Record<string, unknown> => m !== null);

  // ISO 704 requires ≥2 partitives. Skip malformed relations rather
  // than letting the constructor throw and break the whole concept.
  if (partitives.length < 2) return null;

  const out: Record<string, unknown> = {
    comprehensive,
    partitives,
  };

  if (r[GL.COMPLETENESS]) out.completeness = r[GL.COMPLETENESS];

  if (r[GL.CRITERION]) {
    out.criterion = typeof r[GL.CRITERION] === 'string'
      ? { default: r[GL.CRITERION] }
      : r[GL.CRITERION];
  }

  return out;
}

/**
 * Map a GenericRelation JSON-LD entry to the dict shape that
 * glossarist-js's GenericHyperedge constructor expects.
 *
 * Mirrors mapPartitiveRelationFromJsonLd but reads `gl:hasGeneric` and
 * carries each member's `gl:delimitingCharacteristic` (ISO 704:2022
 * §5.5.4.2.1 — required on every GenericMember).
 */
function mapGenericRelationFromJsonLd(r: JsonLdPartitiveRelation): Record<string, unknown> | null {
  const comprehensive = r[GL.COMPREHENSIVE] ? mapRefFromJsonLd(r[GL.COMPREHENSIVE]) : null;
  if (!comprehensive) return null;

  const members = (r[GL.HAS_GENERIC] ?? [])
    .map((m: any): Record<string, unknown> | null => {
      const ref = m[GL.REF] ? mapRefFromJsonLd(m[GL.REF]) : null;
      if (!ref) return null;
      const out: Record<string, unknown> = { ref };
      const presence = m[GL.PRESENCE];
      const count = m[GL.COUNT];
      if (isPartitivePresence(presence) && isPartitiveCount(count)) {
        out.presence = presence;
        out.count = count;
      } else {
        const raw = m[GL.MULTIPLICITY] ?? splitLegacyCertainty(m[GL.CERTAINTY]);
        if (raw) {
          const parts = splitMultiplicity(raw);
          out.presence = parts.presence;
          out.count = parts.count;
        }
      }
      const dc = m[GL.DELIMITING_CHARACTERISTIC];
      if (dc) {
        out.delimitingCharacteristic = typeof dc === 'string' ? { default: dc } : dc;
      }
      return out;
    })
    .filter((m: any): m is Record<string, unknown> => m !== null);

  if (members.length < 2) return null;

  const out: Record<string, unknown> = { comprehensive, members };

  if (r[GL.COMPLETENESS]) out.completeness = r[GL.COMPLETENESS];

  if (r[GL.CRITERION]) {
    out.criterion = typeof r[GL.CRITERION] === 'string'
      ? { default: r[GL.CRITERION] }
      : r[GL.CRITERION];
  }

  return out;
}

/** Migrate legacy v2 certainty → old v3 multiplicity string. */
function splitLegacyCertainty(certainty: string | undefined): string | null {
  if (!certainty) return null;
  return certainty === 'possible' ? 'optional' : 'compulsory';
}

/** Split the legacy one-string multiplicity into MECE presence × count. */
function splitMultiplicity(m: string): { presence: 'required' | 'optional'; count: 'exactly_one' | 'at_least_one' | 'multiple' } {
  const LEGACY_MAP: Record<string, { presence: 'required' | 'optional'; count: 'exactly_one' | 'at_least_one' | 'multiple' }> = {
    compulsory:               { presence: 'required', count: 'exactly_one' },
    optional:                 { presence: 'optional', count: 'exactly_one' },
    compulsory_multiple:      { presence: 'required', count: 'multiple' },
    optional_multiple:        { presence: 'optional', count: 'multiple' },
    compulsory_at_least_one:  { presence: 'required', count: 'at_least_one' },
  };
  return LEGACY_MAP[m] ?? { presence: 'required', count: 'exactly_one' };
}

function conceptFromJsonLd(doc: JsonLdConcept): Concept {
  const id = String(doc[GL.IDENTIFIER] ?? doc['@id']?.split('/').pop() ?? '');
  const localizations: Record<string, Record<string, unknown>> = {};

  const rawLc = doc[GL.LOCALIZED_CONCEPT] ?? {};
  for (const [lang, lc] of Object.entries(rawLc)) {
    if (lc && typeof lc === 'object') {
      localizations[lang] = mapLocalizedFromJsonLd(lc);
    }
  }

  const related = (doc[GL.RELATED] ?? []).map(mapRelatedFromJsonLd);
  const partitiveRelations = (doc[GL.PARTITIVE_RELATIONS] ?? [])
    .map(mapPartitiveRelationFromJsonLd)
    .filter((r: any): r is Record<string, unknown> => r !== null);
  const genericRelations = (doc[GL.GENERIC_RELATIONS] ?? [])
    .map(mapGenericRelationFromJsonLd)
    .filter((r: any): r is Record<string, unknown> => r !== null);
  const tagsArr = doc[GL.TAGS];
  const tags = Array.isArray(tagsArr) ? [...tagsArr] : [];

  const concept = Concept.fromJSON({
    id,
    term: doc[GL.TERM] ?? null,
    uri: doc['@id'] ?? null,
    localizations: localizations as Record<string, any>,
    related,
    partitive_relations: partitiveRelations,
    generic_relations: genericRelations,
    tags,
    figures: normalizeEntityRefs(doc[GL.FIGURE_REF]),
    tables: normalizeEntityRefs(doc[GL.TABLE_REF]),
    formulas: normalizeEntityRefs(doc[GL.FORMULA_REF]),
    status: null,
  });

  attachBridges(concept, localizations);
  return concept;
}

/**
 * Normalize JSON-LD structural entity refs (`gl:figureRef` / `gl:tableRef`
 * / `gl:formulaRef`) into the shape `NonVerbalReference.fromJSON` expects.
 *
 * Accepts three wire forms — bare string ID, `{ "@id": "../kind/foo" }`,
 * or `{ "@id": "../kind/foo", "gl:display": "Figure 3" }` — and emits the
 * canonical `{ ref, display? }` shape. The path's last segment is the
 * entity id; the field name (`figureRef` vs `tableRef` vs `formulaRef`)
 * is the kind discriminator upstream.
 */
function normalizeEntityRefs(raw: unknown): unknown[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeOneEntityRef).filter((v): v is Record<string, string> => v !== null);
}

function normalizeOneEntityRef(entry: unknown): Record<string, string> | null {
  if (typeof entry === 'string') {
    const trimmed = entry.trim();
    return trimmed ? { ref: trimmed } : null;
  }
  if (!entry || typeof entry !== 'object') return null;
  const obj = entry as Record<string, unknown>;
  const atId = typeof obj['@id'] === 'string' ? (obj['@id'] as string) : null;
  const explicitRef = typeof obj.ref === 'string' ? obj.ref
    : typeof obj.entityId === 'string' ? obj.entityId
    : typeof obj.entity_id === 'string' ? obj.entity_id
    : null;
  const entityId = (atId ? lastPathSegment(atId) : null) ?? explicitRef;
  if (!entityId) return null;
  const out: Record<string, string> = { ref: entityId };
  const displayRaw = obj[GL.DISPLAY] ?? obj['gloss:display'] ?? obj.display;
  if (typeof displayRaw === 'string') out.display = displayRaw;
  return out;
}

function lastPathSegment(p: string): string | null {
  const cleaned = p.replace(/[?#].*$/, '').replace(/\/+$/, '');
  const segments = cleaned.split('/');
  const last = segments[segments.length - 1];
  return last ? decodeURIComponent(last) : null;
}

// ── Public API ────────────────────────────────────────────────────────────

export function conceptFromJson(doc: Record<string, unknown>): Concept {
  if (isJsonLd(doc)) {
    return conceptFromJsonLd(doc as JsonLdConcept);
  }
  const concept = Concept.fromJSON(doc);
  const locs = (doc as Record<string, unknown>).localizations as Record<string, unknown> | undefined;
  if (locs) attachBridges(concept, locs);
  attachSourcedFromToSources(
    concept.sources as unknown as { sourced_from?: unknown }[],
    (doc as Record<string, unknown>).sources,
  );
  return concept;
}

export function conceptToSummary(concept: Concept): ConceptSummary {
  const designations: Record<string, string> = {};
  for (const lang of concept.languages) {
    const lc = concept.localization(lang);
    if (lc?.primaryDesignation) {
      designations[lang] = lc.primaryDesignation;
    }
  }
  return {
    id: concept.id,
    designations,
    eng: designations.eng || Object.values(designations)[0] || '',
    status: concept.status ?? 'valid',
  };
}

export function conceptUri(concept: Concept, registerId: string, uriBase: string): string {
  if (concept.uri) return concept.uri;
  return new ConceptIdentity(concept.id, registerId, uriBase).uri;
}
