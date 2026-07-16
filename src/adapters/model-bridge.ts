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
import { ConceptIdentity } from './concept-identity';

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
  source?: string;
  id?: string;
  version?: string;
}

interface JsonLdLocality {
  'gl:localityType'?: string;
  'gl:referenceFrom'?: string;
  'gl:referenceTo'?: string;
  type?: string;
  reference_from?: string;
  reference_to?: string;
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
  'gl:id'?: string;
  'gl:sourceType'?: string;
  'gl:sourceStatus'?: string;
  'gl:modification'?: string;
  'gl:origin'?: JsonLdOrigin;
  'gl:sourcedFrom'?: JsonLdOrigin[];
  'gl:sourced_from'?: JsonLdOrigin[];
}

interface JsonLdRelated {
  'gl:relationshipType'?: string;
  'gl:ref'?: JsonLdRef;
  '@id'?: string;
  'gl:term'?: string;
  'gl:target'?: string;
  'gl:sourceId'?: string;
  'gl:citation'?: JsonLdOrigin;
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
  'gl:figureRef'?: unknown[];
  'gl:tableRef'?: unknown[];
  'gl:formulaRef'?: unknown[];
}

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
 * instances, since RelatedConcept.fromJSON only reads type/content/ref.
 */
function attachRelatedBridges(
  modelRelated: Array<{ type?: string | null; content?: string | null; ref?: any; related?: any[] }>,
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

function mapRefFromJsonLd(rawRef: JsonLdRef | string | undefined): Record<string, unknown> | null {
  if (!rawRef) return null;
  if (typeof rawRef === 'string') return { source: rawRef };
  const refObj: Record<string, unknown> = {};
  // gl:-prefixed keys take precedence over unprefixed keys
  refObj.source = rawRef['gl:source'] ?? rawRef.source;
  refObj.id = rawRef['gl:id'] ?? rawRef.id;
  refObj.version = rawRef['gl:version'] ?? rawRef.version;
  if (rawRef['gl:text']) refObj.text = rawRef['gl:text'];
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
  locObj.type = rawLoc['gl:localityType'] ?? rawLoc.type;
  locObj.reference_from = rawLoc['gl:referenceFrom'] ?? rawLoc.reference_from;
  locObj.reference_to = rawLoc['gl:referenceTo'] ?? rawLoc.reference_to;
  return (locObj.type ?? locObj.reference_from ?? locObj.reference_to) != null
    ? locObj : null;
}

function mapDetailedDefinitionFromJsonLd(d: any): Record<string, unknown> {
  const result: Record<string, unknown> = { content: d['gl:content'] ?? '' };
  if (d['gl:examples']?.length) {
    result.examples = d['gl:examples'].map(mapDetailedDefinitionFromJsonLd);
  }
  return result;
}

function mapOriginFromJsonLd(o: JsonLdOrigin): Record<string, unknown> {
  const origin: Record<string, unknown> = {};
  const ref = mapRefFromJsonLd(o['gl:ref']);
  if (ref) origin.ref = ref;
  const loc = mapLocalityFromJsonLd(o['gl:locality']);
  if (loc) origin.locality = loc;
  if (o['gl:link']) origin.link = o['gl:link'];
  if (o['gl:id']) origin.id = o['gl:id'];
  if (o['gl:version']) origin.version = o['gl:version'];
  if (o['gl:source']) origin.source = o['gl:source'];
  return origin;
}

function mapSourceFromJsonLd(s: JsonLdSource): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  if (s['gl:id']) result.id = s['gl:id'];
  if (s['gl:sourceType']) result.type = s['gl:sourceType'];
  if (s['gl:sourceStatus']) result.status = s['gl:sourceStatus'];
  if (s['gl:modification']) result.modification = s['gl:modification'];

  if (s['gl:origin']) {
    result.origin = mapOriginFromJsonLd(s['gl:origin']);
  }

<<<<<<< HEAD
  if (s['gl:sourced_from']?.length) {
    result.sourced_from = s['gl:sourced_from'].map(sf => mapOriginFromJsonLd(sf));
=======
  const sf = s['gl:sourcedFrom'] ?? s['gl:sourced_from'];
  if (sf?.length) {
    result.sourced_from = sf.map(item => mapOriginFromJsonLd(item));
>>>>>>> b8431fbe (feat: Astro 7 SPA + SSG architecture with Tailwind 4 and cross-edition fixes)
  }

  return result;
}

function mapRelatedFromJsonLd(r: JsonLdRelated): Record<string, unknown> {
  const result: Record<string, unknown> = { type: 'references' };

  if (r['gl:relationshipType']) {
    result.type = r['gl:relationshipType'];
  }

  if (r['gl:ref']) {
    const ref = mapRefFromJsonLd(r['gl:ref']);
    if (ref) result.ref = ref;
  }

  if (!result.ref && r['@id']) {
    const uri = r['@id'];
    const idMatch = uri.match(/\/concept\/([^/]+)$/);
    result.ref = idMatch
      ? { source: uri.split('/').slice(-3, -2)[0] || '', id: idMatch[1] }
      : { source: uri, id: null };
  }
  if (r['gl:term']) result.content = r['gl:term'];

  // Bridged fields — stored in raw dict, extracted by attachBridges()
  if (r['gl:sourceId']) result.sourceId = r['gl:sourceId'];
  if (r['gl:citation']) {
    const c = r['gl:citation'];
    const citation: Record<string, unknown> = {};
    if (c['gl:ref']) {
      const cr = mapRefFromJsonLd(c['gl:ref']);
      if (cr) citation.ref = cr;
    }
    const loc = mapLocalityFromJsonLd(c['gl:locality']);
    if (loc) citation.locality = loc;
    if (c['gl:link']) citation.link = c['gl:link'];
    if (Object.keys(citation).length > 0) result.citation = citation;
  }

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
    data.definition = lc['gl:definition'].map(mapDetailedDefinitionFromJsonLd);
  }

  if (lc['gl:notes']?.length) {
    data.notes = lc['gl:notes'].map(mapDetailedDefinitionFromJsonLd);
  }

  if (lc['gl:annotations']?.length) {
    data.annotations = lc['gl:annotations'].map(mapDetailedDefinitionFromJsonLd);
  }

  if (lc['gl:examples']?.length) {
    data.examples = lc['gl:examples'].map(mapDetailedDefinitionFromJsonLd);
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
    figures: normalizeEntityRefs(doc['gl:figureRef']),
    tables: normalizeEntityRefs(doc['gl:tableRef']),
    formulas: normalizeEntityRefs(doc['gl:formulaRef']),
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
  const display = typeof obj['gl:display'] === 'string' ? obj['gl:display']
    : typeof obj['gloss:display'] === 'string' ? obj['gloss:display']
    : typeof obj.display === 'string' ? obj.display
    : null;
  if (display) out.display = display;
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
