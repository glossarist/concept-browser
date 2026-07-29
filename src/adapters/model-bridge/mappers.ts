/**
 * JSON-LD → Glossarist native mapping functions.
 *
 * Each mapper reads the wire-format JSON-LD (gl:-prefixed keys, see
 * src/adapters/wire-keys.ts for the SSOT) and emits the snake_case
 * dict that glossarist-js's Model.fromJSON constructors expect.
 *
 * Mappers are pure functions — no side effects, no global state.
 * Bridge machinery (WeakMaps) lives in bridges.ts.
 */
import { GL } from '../wire-keys';
import { DESIGNATION_REL_TYPES } from './bridges';
import type {
  JsonLdDesignation,
  JsonLdRef,
  JsonLdLocality,
  JsonLdOrigin,
  JsonLdSource,
  JsonLdRelated,
  JsonLdLocalizedConcept,
  JsonLdConcept,
} from './jsonld-types';

export function isJsonLd(doc: Record<string, unknown>): boolean {
  return '@type' in doc && GL.LOCALIZED_CONCEPT in doc;
}

export function mapDesignationFromJsonLd(d: JsonLdDesignation): Record<string, unknown> {
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
    result.pronunciation = pronunciation.map(p => ({
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
    result.related = related.map(r => {
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
    result.grammar_info = grammarInfo.map(gi => ({
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

export function mapRefFromJsonLd(rawRef: JsonLdRef | string | undefined): Record<string, unknown> | null {
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
export function mapLocalityFromJsonLd(rawLoc: JsonLdLocality | undefined): Record<string, unknown> | null {
  if (!rawLoc) return null;
  const locObj: Record<string, unknown> = {};
  locObj.type = rawLoc[GL.LOCALITY_TYPE] ?? rawLoc.type;
  locObj.reference_from = rawLoc[GL.REFERENCE_FROM] ?? rawLoc.reference_from;
  locObj.reference_to = rawLoc[GL.REFERENCE_TO] ?? rawLoc.reference_to;
  return (locObj.type ?? locObj.reference_from ?? locObj.reference_to) != null
    ? locObj : null;
}

export function mapDetailedDefinitionFromJsonLd(d: any): Record<string, unknown> {
  const result: Record<string, unknown> = { content: d[GL.CONTENT] ?? '' };
  if (d[GL.EXAMPLES]?.length) {
    result.examples = d[GL.EXAMPLES].map(mapDetailedDefinitionFromJsonLd);
  }
  return result;
}

export function mapOriginFromJsonLd(o: JsonLdOrigin): Record<string, unknown> {
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

export function mapSourceFromJsonLd(s: JsonLdSource): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  // JsonLdSource uses GL.LOCAL_ID ('gl:id') for the source's local id,
  // distinct from JSON-LD's '@id' (the concept IRI).
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
    result.sourced_from = sf.map(item => mapOriginFromJsonLd(item));
  }

  return result;
}

export function mapRelatedFromJsonLd(r: JsonLdRelated): Record<string, unknown> {
  const result: Record<string, unknown> = { type: 'references' };

  if (r[GL.RELATIONSHIP_TYPE]) {
    result.type = r[GL.RELATIONSHIP_TYPE];
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

export function mapLocalizedFromJsonLd(lc: JsonLdLocalizedConcept): Record<string, unknown> {
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
    data.dates = dates.map(d => ({
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

export type { JsonLdConcept };
