import type { Concept, LocalizedConcept, Designation, NonVerbRep, ConceptSource } from 'glossarist';
import type { Expression, Abbreviation, GraphicalSymbol } from 'glossarist';
import { GLOSS, SKOS, SKOSXL, DCTERMS, RDF, OWL, RDFS } from './predicates';
import { RdfGraph, lit, iri, blank, triple } from './rdf-graph';
import type { RdfTriple } from './rdf-graph';

const DESIGNATION_CLASS: Record<string, string> = {
  expression: GLOSS.Expression,
  abbreviation: GLOSS.Abbreviation,
  symbol: GLOSS.Symbol,
  letter_symbol: GLOSS.LetterSymbol,
  graphical_symbol: GLOSS.GraphicalSymbol,
};

function designationClassId(type: string): string {
  return DESIGNATION_CLASS[type] ?? GLOSS.Designation;
}

function desigSlug(designation: string, index: number): string {
  const slug = designation.replace(/[^a-zA-Z0-9]/g, '_');
  if (/^_+$/.test(slug)) return `d${index}`;
  return slug;
}

/**
 * Format a Citation into the human-readable bibliographic string used
 * for `dcterms:bibliographicCitation`. Kept stable so consumers that
 * only show the formatted string see the same value as before the
 * structured emission was added.
 */
function formatCitation(origin: ConceptSource['origin']): string {
  if (!origin) return '';
  const ref = origin.ref;
  if (ref?.source) {
    return ref.id ? `${ref.source} ${ref.id}` : ref.source;
  }
  return '';
}

/**
 * Build the structured RDF triples for a ConceptSource. The blank
 * node is typed `gloss:Citation`; structured fields (source, refn,
 * locality, status, type) are attached when present. The formatted
 * bibliographic string is preserved as `dcterms:bibliographicCitation`
 * so consumers that only show the string keep working.
 *
 * Returns an empty array when the source has no useful information,
 * so the caller can skip emitting an empty blank node.
 */
function sourceTriples(s: ConceptSource): RdfTriple[] {
  const out: RdfTriple[] = [];
  out.push(triple(RDF.type, iri(GLOSS.Citation)));

  const citation = formatCitation(s.origin);
  if (citation) {
    out.push(triple(DCTERMS.bibliographicCitation, lit(citation)));
  }

  if (s.status) out.push(triple(GLOSS.sourceStatus, iri(`gloss:srcstatus/${s.status}`)));
  if (s.type) out.push(triple(GLOSS.sourceType, iri(`gloss:srctype/${s.type}`)));
  if (s.modification) out.push(triple(GLOSS.modificationNote, lit(s.modification)));

  const origin = s.origin;
  const ref = origin?.ref;
  if (ref?.source || ref?.id || ref?.version) {
    const refTriples: RdfTriple[] = [triple(RDF.type, iri(GLOSS.CitationRef))];
    if (ref.source) refTriples.push(triple(GLOSS.source, lit(ref.source)));
    if (ref.id) refTriples.push(triple(GLOSS.refn, lit(ref.id)));
    if (ref.version) refTriples.push(triple(DCTERMS.date, lit(ref.version)));
    out.push(triple(GLOSS.conceptSource, blank(...refTriples)));
  }

  const locality = origin?.locality;
  if (locality?.type || locality?.referenceFrom || locality?.referenceTo) {
    const locTriples: RdfTriple[] = [triple(RDF.type, iri(GLOSS.Locality))];
    if (locality.type) locTriples.push(triple(GLOSS.localityType, lit(locality.type)));
    if (locality.referenceFrom) locTriples.push(triple(GLOSS.referenceFrom, lit(locality.referenceFrom)));
    if (locality.referenceTo) locTriples.push(triple(GLOSS.referenceTo, lit(locality.referenceTo)));
    out.push(triple(GLOSS.citationLocality, blank(...locTriples)));
  }

  if (origin?.link) out.push(triple(RDFS.seeAlso, iri(origin.link)));
  if (origin?.original) out.push(triple(GLOSS.original, lit(origin.original)));

  return out;
}

export interface EmitResult {
  readonly graph: RdfGraph;
  readonly designationUris: ReadonlyMap<string, string>;
}

export function emitConceptGraph(concept: Concept, uri: string): EmitResult {
  const graph = new RdfGraph();
  const designationUris = new Map<string, string>();
  emitConcept(graph, concept, uri, designationUris);
  return { graph, designationUris };
}

function emitConcept(
  graph: RdfGraph,
  concept: Concept,
  uri: string,
  designationUris: Map<string, string>,
): void {
  const w = graph.declare(uri, {
    types: [GLOSS.Concept, SKOS.Concept],
    label: concept.id,
    classLabel: 'Concept',
    classId: GLOSS.Concept,
  });

  w.literal(GLOSS.identifier, concept.id);
  if (concept.status) w.iri(GLOSS.hasStatus, `gloss:status/${concept.status}`);

  for (const d of concept.domains) {
    const ref = d.conceptId || d.urn || '';
    if (ref) w.blank(GLOSS.hasDomain, [triple(GLOSS.conceptId, iri(ref))]);
  }

  for (const s of concept.sources) {
    const triples = sourceTriples(s);
    if (triples.length) w.blank(GLOSS.hasSource, triples);
  }

  for (const d of concept.dates) {
    if (d.type && d.date) {
      w.blank(GLOSS.hasDate, [triple(RDF.value, lit(`${d.type}: ${d.date}`))]);
    }
  }

  for (const r of concept.relatedConcepts) {
    const inner: RdfTriple[] = [triple(GLOSS.relationshipType, iri(`gloss:rel/${r.type}`))];
    if (r.content) inner.push(triple(GLOSS.relationshipContent, lit(r.content)));
    if (r.ref?.source) inner.push(triple(GLOSS.conceptSource, lit(r.ref.source)));
    if (r.ref?.id) inner.push(triple(GLOSS.conceptId, lit(r.ref.id)));
    w.blank(GLOSS.hasRelatedConcept, inner);
  }

  for (const lang of concept.languages) {
    w.iri(GLOSS.hasLocalization, `${uri}/${lang}`);
  }

  for (const lang of concept.languages) {
    const lc = concept.localization(lang);
    if (!lc) continue;
    emitLocalized(graph, lc, uri, lang, designationUris);
  }
}

function emitLocalized(
  graph: RdfGraph,
  lc: LocalizedConcept,
  uri: string,
  lang: string,
  designationUris: Map<string, string>,
): void {
  const lcUri = `${uri}/${lang}`;
  const w = graph.declare(lcUri, {
    types: [GLOSS.LocalizedConcept, SKOS.Concept],
    label: `${lang}: ${lc.primaryDesignation ?? ''}`,
    classLabel: 'LocalizedConcept',
    classId: GLOSS.LocalizedConcept,
  });

  w.literal(DCTERMS.language, lang);
  if (lc.script) w.literal(GLOSS.script, lc.script);
  if (lc.system) w.literal(GLOSS.system, lc.system);
  if (lc.entryStatus) w.iri(GLOSS.hasEntryStatus, `gloss:entstatus/${lc.entryStatus}`);
  if (lc.reviewType) w.literal(GLOSS.reviewType, lc.reviewType);
  w.iri(GLOSS.isLocalizationOf, uri);
  if (lc.classification) w.literal(GLOSS.classification, lc.classification);
  if (lc.release) w.literal(GLOSS.release, lc.release);
  if (lc.lineageSourceSimilarity != null) {
    w.literal(GLOSS.lineageSourceSimilarity, String(lc.lineageSourceSimilarity));
  }
  if (lc.reviewDate) w.literal(GLOSS.reviewDate, lc.reviewDate);
  if (lc.reviewDecisionDate) w.literal(GLOSS.reviewDecisionDate, lc.reviewDecisionDate);
  if (lc.reviewStatus) w.literal(GLOSS.reviewStatus, lc.reviewStatus);
  if (lc.reviewDecision) w.literal(GLOSS.reviewDecision, lc.reviewDecision);
  if (lc.reviewDecisionEvent) w.literal(GLOSS.reviewDecisionEvent, lc.reviewDecisionEvent);
  if (lc.reviewDecisionNotes) w.literal(GLOSS.reviewDecisionNotes, lc.reviewDecisionNotes);

  for (let di = 0; di < lc.terms.length; di++) {
    const d = lc.terms[di];
    const slug = desigSlug(d.designation, di);
    const desigUri = `${lcUri}/desig/${slug}`;
    designationUris.set(`${lang}#${di}`, desigUri);
    const isPreferred = d.normativeStatus === 'preferred';
    w.iri(isPreferred ? SKOSXL.prefLabel : SKOSXL.altLabel, desigUri);
    w.literal(isPreferred ? SKOS.prefLabel : SKOS.altLabel, d.designation, { lang });
    emitDesignation(graph, d, desigUri, lang);
  }

  for (const def of lc.definitions) {
    if (def.content) {
      w.literal(SKOS.definition, def.content, { lang });
      w.blank(GLOSS.hasDefinition, [triple(RDF.value, lit(def.content, { lang }))]);
    }
  }

  for (const n of lc.notes) {
    if (n.content) w.literal(GLOSS.hasNote, n.content, { lang });
  }

  for (const e of lc.examples) {
    if (e.content) w.literal(GLOSS.hasExample, e.content, { lang });
  }

  for (const ann of lc.annotations ?? []) {
    if (ann.content) w.literal(GLOSS.hasAnnotation, ann.content, { lang });
  }

  for (const nvr of lc.nonVerbalRep ?? []) {
    const triples = nonVerbalRepTriples(nvr, lang);
    if (triples.length) w.blank(GLOSS.hasNonVerbalRep, triples);
  }

  for (const s of lc.sources) {
    const triples = sourceTriples(s);
    if (triples.length) w.blank(GLOSS.hasSource, triples);
  }

  if (lc.domain) w.literal(GLOSS.domain, lc.domain);
}

function nonVerbalRepTriples(nvr: NonVerbRep, lang: string): RdfTriple[] {
  const out: RdfTriple[] = [];
  if (nvr.type) out.push(triple(GLOSS.nonVerbalType, lit(nvr.type)));
  if (nvr.caption) out.push(triple(GLOSS.caption, lit(nvr.caption, { lang })));
  if (nvr.description) out.push(triple(DCTERMS.description, lit(nvr.description, { lang })));
  if (nvr.alt) out.push(triple(GLOSS.altText, lit(nvr.alt, { lang })));
  for (const img of nvr.images ?? []) {
    if (img.src) out.push(triple(GLOSS.image, iri(img.src)));
  }
  return out;
}

function emitDesignation(
  graph: RdfGraph,
  d: Designation,
  desigUri: string,
  lang: string,
): void {
  const classId = designationClassId(d.type);
  const w = graph.declare(desigUri, {
    types: [classId, SKOSXL.Label],
    label: d.designation,
    classLabel: classId.replace('gloss:', ''),
    classId,
  });

  w.literal(SKOSXL.literalForm, d.designation, { lang });
  if (d.normativeStatus) w.iri(GLOSS.normativeStatus, `gloss:norm/${d.normativeStatus}`);
  if (d.geographicalArea) w.literal(GLOSS.geographicalArea, d.geographicalArea);
  if (d.international) w.literal(GLOSS.isInternational, 'true');
  if (d.absent) w.literal(GLOSS.isAbsent, 'true');
  if (d.termType) w.literal(GLOSS.hasTermType, d.termType);
  for (const p of d.pronunciations ?? []) {
    if (p.content) w.literal(GLOSS.hasPronunciation, p.content);
  }

  if (d.type === 'expression' || d.type === 'abbreviation') {
    const expr = d as Expression;
    if (expr.prefix) w.literal(GLOSS.prefix, expr.prefix);
    if (expr.usageInfo) w.literal(GLOSS.usageInfo, expr.usageInfo);
    if (expr.fieldOfApplication) w.literal(GLOSS.fieldOfApplication, expr.fieldOfApplication);
    for (const gi of expr.grammarInfo ?? []) {
      const parts: string[] = [];
      if (gi.gender) parts.push(`gender:${gi.gender}`);
      if (gi.number) parts.push(`number:${gi.number}`);
      if (gi.partOfSpeech) parts.push(`pos:${gi.partOfSpeech}`);
      if (parts.length) w.literal(GLOSS.hasGrammarInfo, parts.join(', '));
    }
  }

  if (d.type === 'abbreviation') {
    const abbr = d as Abbreviation;
    if (abbr.acronym) w.literal(GLOSS.isAcronym, 'true');
    if (abbr.initialism) w.literal(GLOSS.isInitialism, 'true');
    if (abbr.truncation) w.literal(GLOSS.isTruncation, 'true');
  }

  if (d.type === 'graphical_symbol') {
    const gs = d as GraphicalSymbol;
    if (gs.text) w.literal(GLOSS.text, gs.text);
    if (gs.image) w.literal(GLOSS.image, gs.image);
  }
}
