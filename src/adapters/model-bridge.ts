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

// ── JSON-LD wire-format types ─────────────────────────────────────────────

interface JsonLdContent {
  'gl:content'?: string;
}

interface JsonLdDate {
  'gl:date'?: string;
  'gl:dateType'?: string;
}

interface JsonLdPronunciation {
  'gl:content'?: string;
  'gl:language'?: string;
  'gl:script'?: string;
  'gl:system'?: string;
  'gl:country'?: string;
}

interface JsonLdGrammarInfo {
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

interface JsonLdRef {
  'gl:source'?: string;
  'gl:id'?: string;
  'gl:version'?: string;
  'gl:text'?: string;
  'source'?: string;
  'id'?: string;
  'version'?: string;
}

interface JsonLdLocality {
  'gl:localityType'?: string;
  'gl:referenceFrom'?: string;
  'gl:referenceTo'?: string;
  'type'?: string;
  'reference_from'?: string;
  'reference_to'?: string;
}

interface JsonLdOrigin {
  'gl:ref'?: string | JsonLdRef;
  'gl:locality'?: JsonLdLocality;
  'gl:link'?: string;
  'gl:id'?: string;
  'gl:version'?: string;
  'gl:source'?: string;
}

interface JsonLdSource {
  'gl:sourceType'?: string;
  'gl:sourceStatus'?: string;
  'gl:modification'?: string;
  'gl:origin'?: JsonLdOrigin;
}

interface JsonLdRelated {
  'gl:relationshipType'?: string;
  'gl:ref'?: JsonLdRef;
  '@id'?: string;
  'gl:term'?: string;
  'gl:target'?: string;
}

interface JsonLdDesignation {
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

interface JsonLdLocalizedConcept {
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

interface JsonLdConcept {
  '@type'?: string;
  '@id'?: string;
  'gl:identifier'?: string | number;
  'gl:term'?: string;
  'gl:localizedConcept'?: Record<string, JsonLdLocalizedConcept>;
  'gl:related'?: JsonLdRelated[];
  'gl:tags'?: string[];
}

// ── Bridges for fields not yet in glossarist-js ────────────────────────────
// Remove each bridge when glossarist-js publishes native support.

// Annotations: LocalizedConcept.annotations
const extraAnnotations = new WeakMap<LocalizedConcept, DetailedDefinition[]>();

export function getAnnotations(lc: LocalizedConcept): DetailedDefinition[] {
  return extraAnnotations.get(lc) ?? [];
}

// Designation relationship targets: RelatedConcept.target (string)
const designationTargets = new WeakMap<RelatedConcept, string>();

export function getDesignationTarget(rc: RelatedConcept): string | null {
  return designationTargets.get(rc) ?? null;
}

// ConceptRef text: human-readable label alongside source/id
const refTexts = new WeakMap<ConceptRef, string>();

export function getRefText(ref: ConceptRef): string | null {
  return refTexts.get(ref) ?? null;
}

// Relationship types whose target is a designation string, not a concept ref.
const DESIGNATION_REL_TYPES = new Set(['abbreviated_form_for', 'short_form_for']);

function attachAnnotations(concept: Concept, localizations: Record<string, unknown>): void {
  for (const lang of concept.languages) {
    const lc = concept.localization(lang);
    const raw = localizations[lang];
    if (!lc || !raw || typeof raw !== 'object') continue;
    const rawObj = raw as Record<string, unknown>;

    // Annotations
    const annList = rawObj.annotations;
    if (Array.isArray(annList) && annList.length > 0) {
      extraAnnotations.set(lc, annList.map((a: Record<string, unknown>) =>
        DetailedDefinition.fromJSON({ content: (a.content as string) ?? '' }) as DetailedDefinition,
      ));
    }

    // Designation-level relationship targets and ref text
    const rawTerms = rawObj.terms;
    if (Array.isArray(rawTerms)) {
      for (let i = 0; i < lc.terms.length && i < rawTerms.length; i++) {
        const rawTerm = rawTerms[i] as Record<string, unknown>;
        const rawRelated = rawTerm.related;
        if (!Array.isArray(rawRelated)) continue;
        const designation = lc.terms[i];
        for (let j = 0; j < designation.related.length && j < rawRelated.length; j++) {
          const rawRel = rawRelated[j] as Record<string, unknown>;
          const rc = designation.related[j];
          if ('type' in rc) {
            if (rawRel.target && typeof rawRel.target === 'string') {
              designationTargets.set(rc as RelatedConcept, rawRel.target);
            }
            if ('ref' in rc && rc.ref) {
              const rawRef = rawRel.ref as Record<string, unknown> | undefined;
              if (rawRef?.text && typeof rawRef.text === 'string') {
                refTexts.set((rc as RelatedConcept).ref!, rawRef.text);
              }
            }
          }
        }
      }
    }

    // Localization-level ref text
    const rawRelated = rawObj.related;
    if (Array.isArray(rawRelated)) {
      for (let i = 0; i < lc.related.length && i < rawRelated.length; i++) {
        const rc = lc.related[i];
        const rawRel = rawRelated[i] as Record<string, unknown>;
        const rawRef = rawRel.ref as Record<string, unknown> | undefined;
        if (rc.ref && rawRef?.text && typeof rawRef.text === 'string') {
          refTexts.set(rc.ref, rawRef.text);
        }
      }
    }
  }
}

// ── Detection ─────────────────────────────────────────────────────────────

function isJsonLd(doc: Record<string, unknown>): boolean {
  return '@type' in doc && 'gl:localizedConcept' in doc;
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

  result.designation = d['gl:term'] ?? '';
  result.normative_status = d['gl:normativeStatus'] ?? null;

  if (d['gl:absent'] != null) result.absent = d['gl:absent'];
  if (d['gl:fieldOfApplication']) result.field_of_application = d['gl:fieldOfApplication'];
  if (d['gl:usageInfo']) result.usage_info = d['gl:usageInfo'];
  if (d['gl:geographicalArea']) result.geographical_area = d['gl:geographicalArea'];
  if (d['gl:language']) result.language = d['gl:language'];
  if (d['gl:script']) result.script = d['gl:script'];
  if (d['gl:system']) result.system = d['gl:system'];
  if (d['gl:international'] != null) result.international = d['gl:international'];
  if (d['gl:termType']) result.term_type = d['gl:termType'];

  if (d['gl:pronunciation']?.length) {
    result.pronunciation = d['gl:pronunciation'].map(p => ({
      content: p['gl:content'] ?? null,
      language: p['gl:language'] ?? null,
      script: p['gl:script'] ?? null,
      system: p['gl:system'] ?? null,
      country: p['gl:country'] ?? null,
    }));
  }

  if (d['gl:source']?.length) {
    result.sources = d['gl:source'].map(mapSourceFromJsonLd);
  }

  if (d['gl:related']?.length) {
    result.related = d['gl:related'].map(r => {
      const relType = r['gl:relationshipType'] ?? 'references';
      if (DESIGNATION_REL_TYPES.has(relType) && r['gl:target']) {
        return { type: relType, target: r['gl:target'] };
      }
      return mapRelatedFromJsonLd(r);
    });
  }

  if (d['gl:prefix'] != null) result.prefix = d['gl:prefix'];
  if (d['gl:gender']) {
    result.grammar_info = [{ gender: d['gl:gender'] }];
  }
  if (d['gl:grammarInfo']?.length) {
    result.grammar_info = d['gl:grammarInfo'].map(gi => ({
      gender: gi['gl:gender'] ?? null,
      number: gi['gl:number'] ?? null,
      part_of_speech: gi['gl:partOfSpeech'] ?? null,
      noun: gi['gl:noun'] ?? false,
      verb: gi['gl:verb'] ?? false,
      adj: gi['gl:adj'] ?? false,
      adverb: gi['gl:adverb'] ?? false,
      preposition: gi['gl:preposition'] ?? false,
      participle: gi['gl:participle'] ?? false,
    }));
  }

  return result;
}

function mapSourceFromJsonLd(s: JsonLdSource): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (s['gl:sourceType']) result.type = s['gl:sourceType'];
  if (s['gl:sourceStatus']) result.status = s['gl:sourceStatus'];
  if (s['gl:modification']) result.modification = s['gl:modification'];

  if (s['gl:origin']) {
    const origin: Record<string, unknown> = {};
    const o = s['gl:origin'];
    if (o['gl:ref']) {
      const rawRef = o['gl:ref'];
      if (typeof rawRef === 'string') {
        origin.ref = { source: rawRef };
      } else {
        const refObj: Record<string, unknown> = {};
        if (rawRef['gl:source']) refObj.source = rawRef['gl:source'];
        if (rawRef['gl:id']) refObj.id = rawRef['gl:id'];
        if (rawRef['gl:version']) refObj.version = rawRef['gl:version'];
        if (rawRef['source']) refObj.source = rawRef['source'];
        if (rawRef['id']) refObj.id = rawRef['id'];
        if (rawRef['version']) refObj.version = rawRef['version'];
        if (Object.keys(refObj).length > 0) origin.ref = refObj;
      }
    }
    if (o['gl:locality']) {
      const loc: Record<string, unknown> = {};
      const rawLoc = o['gl:locality'];
      if (rawLoc['gl:localityType']) loc.type = rawLoc['gl:localityType'];
      if (rawLoc['gl:referenceFrom']) loc.reference_from = rawLoc['gl:referenceFrom'];
      if (rawLoc['gl:referenceTo']) loc.reference_to = rawLoc['gl:referenceTo'];
      if (rawLoc['type']) loc.type = rawLoc['type'];
      if (rawLoc['reference_from']) loc.reference_from = rawLoc['reference_from'];
      if (rawLoc['reference_to']) loc.reference_to = rawLoc['reference_to'];
      origin.locality = loc;
    }
    if (o['gl:link']) origin.link = o['gl:link'];
    if (o['gl:id']) origin.id = o['gl:id'];
    if (o['gl:version']) origin.version = o['gl:version'];
    if (o['gl:source']) origin.source = o['gl:source'];
    result.origin = origin;
  }

  return result;
}

function mapRelatedFromJsonLd(r: JsonLdRelated): Record<string, unknown> {
  const result: Record<string, unknown> = { type: 'references' };

  if (r['gl:relationshipType']) {
    result.type = r['gl:relationshipType'];
  }

  if (r['gl:ref']) {
    const ref = r['gl:ref'];
    const refObj: Record<string, unknown> = {};
    if (ref['gl:source']) refObj.source = ref['gl:source'];
    if (ref['gl:id']) refObj.id = ref['gl:id'];
    if (ref['source']) refObj.source = ref['source'];
    if (ref['id']) refObj.id = ref['id'];
    if (ref['gl:text']) refObj.text = ref['gl:text'];
    if (Object.keys(refObj).length > 0) result.ref = refObj;
  }

  if (!result.ref && r['@id']) {
    const uri = r['@id'];
    const idMatch = uri.match(/\/concept\/([^/]+)$/);
    result.ref = idMatch
      ? { source: uri.split('/').slice(-3, -2)[0] || '', id: idMatch[1] }
      : { source: uri, id: null };
  }
  if (r['gl:term']) result.content = r['gl:term'];
  return result;
}

function mapLocalizedFromJsonLd(lc: JsonLdLocalizedConcept): Record<string, unknown> {
  const data: Record<string, unknown> = {};

  if (lc['gl:languageCode']) data.language_code = lc['gl:languageCode'];
  if (lc['gl:entryStatus']) data.entry_status = lc['gl:entryStatus'];
  if (lc['gl:classification']) data.classification = lc['gl:classification'];
  if (lc['gl:reviewType']) data.review_type = lc['gl:reviewType'];
  if (lc['gl:domain']) data.domain = lc['gl:domain'];
  if (lc['gl:release']) data.release = lc['gl:release'];
  if (lc['gl:lineageSourceSimilarity'] != null) data.lineage_source_similarity = lc['gl:lineageSourceSimilarity'];
  if (lc['gl:script']) data.script = lc['gl:script'];
  if (lc['gl:system']) data.system = lc['gl:system'];

  if (lc['gl:designation']?.length) {
    data.terms = lc['gl:designation'].map(mapDesignationFromJsonLd);
  }

  if (lc['gl:definition']?.length) {
    data.definition = lc['gl:definition'].map(d => ({
      content: d['gl:content'] ?? '',
    }));
  }

  if (lc['gl:notes']?.length) {
    data.notes = lc['gl:notes'].map(n => ({ content: n['gl:content'] ?? '' }));
  }

  if (lc['gl:annotations']?.length) {
    data.annotations = lc['gl:annotations'].map(a => ({ content: a['gl:content'] ?? '' }));
  }

  if (lc['gl:examples']?.length) {
    data.examples = lc['gl:examples'].map(e => ({ content: e['gl:content'] ?? '' }));
  }

  if (lc['gl:source']?.length) {
    data.sources = lc['gl:source'].map(mapSourceFromJsonLd);
  }

  if (lc['gl:dates']?.length) {
    data.dates = lc['gl:dates'].map(d => ({
      date: d['gl:date'] ?? null,
      type: d['gl:dateType'] ?? null,
    }));
  }

  if (lc['gl:references']?.length) {
    data.related = lc['gl:references'].map(mapRelatedFromJsonLd);
  }

  if (lc['gl:reviewDate']) data.review_date = lc['gl:reviewDate'];
  if (lc['gl:reviewDecisionDate']) data.review_decision_date = lc['gl:reviewDecisionDate'];
  if (lc['gl:reviewDecisionEvent']) data.review_decision_event = lc['gl:reviewDecisionEvent'];
  if (lc['gl:reviewStatus']) data.review_status = lc['gl:reviewStatus'];
  if (lc['gl:reviewDecision']) data.review_decision = lc['gl:reviewDecision'];
  if (lc['gl:reviewDecisionNotes']) data.review_decision_notes = lc['gl:reviewDecisionNotes'];

  return data;
}

function conceptFromJsonLd(doc: JsonLdConcept): Concept {
  const id = String(doc['gl:identifier'] ?? doc['@id']?.split('/').pop() ?? '');
  const localizations: Record<string, unknown> = {};

  const rawLc = doc['gl:localizedConcept'] ?? {};
  for (const [lang, lc] of Object.entries(rawLc)) {
    if (lc && typeof lc === 'object') {
      localizations[lang] = mapLocalizedFromJsonLd(lc);
    }
  }

  const related = (doc['gl:related'] ?? []).map(mapRelatedFromJsonLd);
  const tags = Array.isArray(doc['gl:tags']) ? [...doc['gl:tags']] : [];

  const concept = Concept.fromJSON({
    id,
    term: doc['gl:term'] ?? null,
    uri: doc['@id'] ?? null,
    localizations,
    related,
    tags,
    status: null,
  });

  attachAnnotations(concept, localizations);
  return concept;
}

// ── Public API ────────────────────────────────────────────────────────────

export function conceptFromJson(doc: Record<string, unknown>): Concept {
  if (isJsonLd(doc)) {
    return conceptFromJsonLd(doc as JsonLdConcept);
  }
  const concept = Concept.fromJSON(doc);
  const locs = (doc as Record<string, unknown>).localizations as Record<string, unknown> | undefined;
  if (locs) attachAnnotations(concept, locs);
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
  return `${uriBase}/${registerId}/concept/${concept.id}`;
}
