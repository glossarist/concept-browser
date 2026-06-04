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

// ── Detection ─────────────────────────────────────────────────────────────

function isJsonLd(doc: Record<string, unknown>): boolean {
  return '@type' in doc && 'gl:localizedConcept' in doc;
}

// ── JSON-LD → Glossarist native mapping ───────────────────────────────────

function mapDesignationFromJsonLd(d: any): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const rawType = (d['@type'] as string) || '';

  // Map type
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
    result.pronunciation = d['gl:pronunciation'].map((p: any) => ({
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
    result.related = d['gl:related'].map(mapRelatedFromJsonLd);
  }

  // Expression-specific
  if (d['gl:prefix'] != null) result.prefix = d['gl:prefix'];
  if (d['gl:gender']) {
    result.grammar_info = [{ gender: d['gl:gender'] }];
  }
  if (d['gl:grammarInfo']?.length) {
    result.grammar_info = d['gl:grammarInfo'].map((gi: any) => ({
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

function mapSourceFromJsonLd(s: any): Record<string, unknown> {
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
        // Legacy format: gl:ref is a plain string (e.g. "ISO/TS 14812:2022")
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

function mapRelatedFromJsonLd(r: any): Record<string, unknown> {
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
    if (Object.keys(refObj).length > 0) result.ref = refObj;
  }

  if (!result.ref && r['@id']) {
    const uri = r['@id'] as string;
    const idMatch = uri.match(/\/concept\/([^/]+)$/);
    result.ref = idMatch
      ? { source: uri.split('/').slice(-3, -2)[0] || '', id: idMatch[1] }
      : { source: uri, id: null };
  }
  if (r['gl:term']) result.content = r['gl:term'];
  return result;
}

function mapLocalizedFromJsonLd(lc: any): Record<string, unknown> {
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
    data.definition = lc['gl:definition'].map((d: any) => {
      const def: Record<string, unknown> = { content: d['gl:content'] ?? '' };
      return def;
    });
  }

  if (lc['gl:notes']?.length) {
    data.notes = lc['gl:notes'].map((n: any) => ({ content: n['gl:content'] ?? '' }));
  }

  if (lc['gl:examples']?.length) {
    data.examples = lc['gl:examples'].map((e: any) => ({ content: e['gl:content'] ?? '' }));
  }

  if (lc['gl:source']?.length) {
    data.sources = lc['gl:source'].map(mapSourceFromJsonLd);
  }

  if (lc['gl:dates']?.length) {
    data.dates = lc['gl:dates'].map((d: any) => ({
      date: d['gl:date'] ?? null,
      type: d['gl:dateType'] ?? null,
    }));
  }

  if (lc['gl:references']?.length) {
    data.related = lc['gl:references'].map(mapRelatedFromJsonLd);
  }

  // Review metadata — passed through to LocalizedConcept constructor
  if (lc['gl:reviewDate']) data.review_date = lc['gl:reviewDate'];
  if (lc['gl:reviewDecisionDate']) data.review_decision_date = lc['gl:reviewDecisionDate'];
  if (lc['gl:reviewDecisionEvent']) data.review_decision_event = lc['gl:reviewDecisionEvent'];
  if (lc['gl:reviewStatus']) data.review_status = lc['gl:reviewStatus'];
  if (lc['gl:reviewDecision']) data.review_decision = lc['gl:reviewDecision'];
  if (lc['gl:reviewDecisionNotes']) data.review_decision_notes = lc['gl:reviewDecisionNotes'];

  return data;
}

function conceptFromJsonLd(doc: Record<string, any>): Concept {
  const id = String(doc['gl:identifier'] ?? doc['@id']?.split('/').pop() ?? '');
  const localizations: Record<string, any> = {};

  const rawLc = doc['gl:localizedConcept'] ?? {};
  for (const [lang, lc] of Object.entries(rawLc)) {
    if (lc && typeof lc === 'object') {
      localizations[lang] = mapLocalizedFromJsonLd(lc);
    }
  }

  const related = (doc['gl:related'] ?? []).map(mapRelatedFromJsonLd);
  const tags = Array.isArray(doc['gl:tags']) ? [...doc['gl:tags']] : [];

  return Concept.fromJSON({
    id,
    term: doc['gl:term'] ?? null,
    uri: doc['@id'] ?? null,
    localizations,
    related,
    tags,
    status: null,
  });
}

// ── Public API ────────────────────────────────────────────────────────────

export function conceptFromJson(doc: Record<string, any>): Concept {
  if (isJsonLd(doc)) {
    return conceptFromJsonLd(doc);
  }
  // glossarist native format — use fromJSON directly
  return Concept.fromJSON(doc as Record<string, unknown>);
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
