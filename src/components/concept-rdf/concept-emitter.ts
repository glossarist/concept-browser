import type { Concept, LocalizedConcept, Designation, NonVerbRep, ConceptSource } from 'glossarist';
import type { Expression, Abbreviation, GraphicalSymbol } from 'glossarist';
import { GLOSS, SKOS, SKOSXL, DCTERMS, RDF, XSD, PROV } from './predicates';
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

function coerceToDateTime(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T00:00:00Z`;
  return value;
}

const STANDARDS_BODIES = new Set(['iso', 'iec', 'ieee', 'itu', 'iecdis']);

function lifecycleCounterpartUri(r: { type: string; ref?: { source?: string | null; id?: string | null } | null }): string | undefined {
  const source = r.ref?.source ?? undefined;
  const id = r.ref?.id ?? undefined;
  if (!source || !id) return undefined;
  const sourceLc = source.toLowerCase();
  const idClean = id.replace(/\s+/g, '');
  if (STANDARDS_BODIES.has(sourceLc)) {
    return `urn:iso:std:${sourceLc}:${idClean}`;
  }
  return `urn:gloss:rel:${sourceLc}:${idClean}`;
}

function formatCitation(origin: ConceptSource['origin']): string {
  if (!origin) return '';
  const ref = origin.ref;
  if (ref?.source) {
    return ref.id ? `${ref.source} ${ref.id}` : ref.source;
  }
  return '';
}

function sourceTriples(s: ConceptSource): RdfTriple[] {
  const out: RdfTriple[] = [
    triple(RDF.type, iri(GLOSS.ConceptSource)),
  ];

  if (s.status) out.push(triple(GLOSS.sourceStatus, iri(`gloss:srcstatus/${s.status}`)));
  if (s.type) out.push(triple(GLOSS.sourceType, iri(`gloss:srctype/${s.type}`)));
  if (s.modification) out.push(triple(GLOSS.modification, lit(s.modification)));

  const origin = s.origin;
  const ref = origin?.ref;
  const locality = origin?.locality;
  const link = origin?.link;
  const original = origin?.original;
  const citation = formatCitation(origin);

  const hasCitationPayload = !!(ref?.source || ref?.id || ref?.version || locality?.type || locality?.referenceFrom || locality?.referenceTo || link || original || citation);

  if (hasCitationPayload) {
    const citeTriples: RdfTriple[] = [triple(RDF.type, iri(GLOSS.Citation))];
    if (citation) citeTriples.push(triple(DCTERMS.bibliographicCitation, lit(citation)));

    if (ref?.source || ref?.id || ref?.version) {
      const refTriples: RdfTriple[] = [triple(RDF.type, iri(GLOSS.CitationRef))];
      if (ref.source) refTriples.push(triple(GLOSS.citationRefSource, lit(ref.source)));
      if (ref.id) refTriples.push(triple(GLOSS.citationRefId, lit(ref.id)));
      if (ref.version) refTriples.push(triple(GLOSS.citationRefVersion, lit(ref.version)));
      citeTriples.push(triple(GLOSS.hasCitationRef, blank(...refTriples)));
    }

    if (locality?.type || locality?.referenceFrom || locality?.referenceTo) {
      const locTriples: RdfTriple[] = [triple(RDF.type, iri(GLOSS.Locality))];
      if (locality.type) locTriples.push(triple(GLOSS.localityType, lit(locality.type)));
      if (locality.referenceFrom) locTriples.push(triple(GLOSS.referenceFrom, lit(locality.referenceFrom)));
      if (locality.referenceTo) locTriples.push(triple(GLOSS.referenceTo, lit(locality.referenceTo)));
      citeTriples.push(triple(GLOSS.hasCitationLocality, blank(...locTriples)));
    }

    if (link) citeTriples.push(triple(GLOSS.citationLink, lit(link, { datatype: XSD.anyURI })));
    if (original) citeTriples.push(triple(GLOSS.citationOriginal, lit(original)));

    out.push(triple(GLOSS.sourceOrigin, blank(...citeTriples)));
  }

  return out;
}

export interface RefResolver {
  (ref: { source?: string | null; id?: string | null }): string | undefined;
}

export interface EmitOptions {
  readonly resolveRef?: RefResolver;
}

export interface EmitResult {
  readonly graph: RdfGraph;
  readonly designationUris: ReadonlyMap<string, string>;
}

export function emitConceptGraph(concept: Concept, uri: string, options: EmitOptions = {}): EmitResult {
  const graph = new RdfGraph();
  const designationUris = new Map<string, string>();
  emitConcept(graph, concept, uri, designationUris, options);
  return { graph, designationUris };
}

function emitConcept(
  graph: RdfGraph,
  concept: Concept,
  uri: string,
  designationUris: Map<string, string>,
  options: EmitOptions = {},
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
    if (ref) {
      w.blank(GLOSS.hasDomain, [
        triple(RDF.type, iri(GLOSS.Reference)),
        triple(GLOSS.refId, iri(ref)),
      ]);
    }
  }

  for (const s of concept.sources) {
    const triples = sourceTriples(s);
    if (triples.length) w.blank(GLOSS.hasSource, triples);
  }

  for (const d of concept.dates) {
    if (d.type && d.date) {
      w.blank(GLOSS.hasDate, [
        triple(RDF.type, iri(GLOSS.ConceptDate)),
        triple(GLOSS.dateType, iri(`gloss:datetype/${d.type}`)),
        triple(GLOSS.dateValue, lit(coerceToDateTime(d.date), { datatype: XSD.dateTime })),
      ]);
    }
  }

  for (const r of concept.relatedConcepts) {
    const inner: RdfTriple[] = [
      triple(RDF.type, iri(GLOSS.RelatedConcept)),
      triple(GLOSS.relationshipType, iri(`gloss:rel/${r.type}`)),
    ];
    if (r.content) inner.push(triple(GLOSS.relationshipContent, lit(r.content)));
    if (r.ref?.source || r.ref?.id) {
      const refTriples: RdfTriple[] = [triple(RDF.type, iri(GLOSS.ConceptRef))];
      if (r.ref?.source) refTriples.push(triple(GLOSS.conceptRefSource, lit(r.ref.source)));
      if (r.ref?.id) refTriples.push(triple(GLOSS.conceptRefId, lit(r.ref.id)));
      inner.push(triple(GLOSS.relationshipRef, blank(...refTriples)));
    }
    w.blank(GLOSS.hasRelatedConcept, inner);

    const resolved = options.resolveRef ? options.resolveRef(r.ref ?? {}) : undefined;
    const counterpartUri = resolved ?? lifecycleCounterpartUri(r);
    if (counterpartUri) {
      if (r.type === 'supersedes') w.iri(DCTERMS.replaces, counterpartUri);
      if (r.type === 'superseded_by') w.iri(DCTERMS.isReplacedBy, counterpartUri);
    }
  }

  const retiredDate = concept.dates.find(d => d.type === 'retired' && d.date);
  if ((concept.status === 'withdrawn' || concept.status === 'superseded') && retiredDate?.date) {
    w.literal(PROV.invalidatedAtTime, coerceToDateTime(retiredDate.date), { datatype: XSD.dateTime });
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

  w.literal(GLOSS.language, lang);
  if (lc.script) w.literal(GLOSS.script, lc.script);
  if (lc.system) w.literal(GLOSS.conversionSystem, lc.system);
  if (lc.entryStatus) w.iri(GLOSS.hasEntryStatus, `gloss:entstatus/${lc.entryStatus}`);
  if (lc.reviewType) w.literal(GLOSS.reviewType, lc.reviewType);
  w.iri(GLOSS.isLocalizationOf, uri);
  if (lc.classification) w.literal(GLOSS.classification, lc.classification);
  if (lc.release) w.literal(GLOSS.release, lc.release);
  if (lc.lineageSourceSimilarity != null) {
    w.literal(GLOSS.lineageSimilarity, String(lc.lineageSourceSimilarity));
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
      w.blank(GLOSS.hasDefinition, [
        triple(RDF.type, iri(GLOSS.DetailedDefinition)),
        triple(RDF.value, lit(def.content, { lang })),
      ]);
    }
  }

  for (const n of lc.notes) {
    if (n.content) {
      w.blank(GLOSS.hasNote, [
        triple(RDF.type, iri(GLOSS.DetailedDefinition)),
        triple(RDF.value, lit(n.content, { lang })),
      ]);
    }
  }

  for (const e of lc.examples) {
    if (e.content) {
      w.blank(GLOSS.hasExample, [
        triple(RDF.type, iri(GLOSS.DetailedDefinition)),
        triple(RDF.value, lit(e.content, { lang })),
      ]);
    }
  }

  for (const ann of lc.annotations ?? []) {
    if (ann.content) w.literal(GLOSS.hasAnnotation, ann.content, { lang });
  }

  for (let i = 0; i < (lc.nonVerbalRep ?? []).length; i++) {
    const nvr = lc.nonVerbalRep[i];
    const emission = nonVerbalRepEmission(nvr, lang, uri, i);
    if (emission.kind === 'blank') {
      w.blank(GLOSS.hasNonVerbalRep, emission.triples);
      continue;
    }
    const nvrW = graph.declare(emission.nvrUri, {
      types: [GLOSS.NonVerbalRep, SKOS.Concept],
      label: nvr.caption ?? nvr.type ?? emission.nvrUri,
      classLabel: 'NonVerbalRep',
      classId: GLOSS.NonVerbalRep,
    });
    w.iri(GLOSS.hasNonVerbalRepresentation, emission.nvrUri);
    for (const t of emission.triples) {
      if (t.object.kind === 'iri') {
        nvrW.iri(t.predicate, t.object.value);
      } else if (t.object.kind === 'literal') {
        nvrW.literal(t.predicate, t.object.value, { lang: t.object.lang, datatype: t.object.datatype });
      } else {
        nvrW.blank(t.predicate, t.object.triples);
      }
    }
  }

  for (const s of lc.sources) {
    const triples = sourceTriples(s);
    if (triples.length) w.blank(GLOSS.hasSource, triples);
  }

  if (lc.domain) w.literal(GLOSS.domain, lc.domain);
}

function nonVerbalRepTriples(nvr: NonVerbRep, lang: string): RdfTriple[] {
  const out: RdfTriple[] = [];
  const imageSrc = nvr.images?.find(i => i.src ?? false)?.src ?? undefined;
  const canonicalType = nvr.type === 'figure' ? 'image' : nvr.type;

  if ((canonicalType === 'image' || canonicalType === 'table' || canonicalType === 'formula') && imageSrc) {
    out.push(triple(RDF.type, iri('gloss:NonVerbalRepresentation')));
    out.push(triple(GLOSS.representationType, lit(canonicalType)));
    out.push(triple(GLOSS.representationRef, lit(imageSrc, { datatype: XSD.anyURI })));
  } else {
    out.push(triple(RDF.type, iri(GLOSS.DetailedDefinition)));
    if (nvr.caption) out.push(triple(RDF.value, lit(nvr.caption, { lang })));
  }

  if (nvr.caption) out.push(triple(GLOSS.caption, lit(nvr.caption, { lang })));
  if (nvr.description) out.push(triple(DCTERMS.description, lit(nvr.description, { lang })));
  if (nvr.alt) out.push(triple(GLOSS.altText, lit(nvr.alt, { lang })));
  return out;
}

type NonVerbalRepEmission =
  | { readonly kind: 'blank'; readonly triples: RdfTriple[] }
  | { readonly kind: 'uri'; readonly nvrUri: string; readonly triples: RdfTriple[] };

function nonVerbalRepEmission(nvr: NonVerbRep, lang: string, conceptUri: string, index: number): NonVerbalRepEmission {
  const imageSrc = nvr.images?.find(i => i.src ?? false)?.src ?? undefined;
  const caption = (nvr as any).caption ?? null;
  const hasPrefLabel = !!caption;

  if (!hasPrefLabel && !imageSrc) {
    return { kind: 'blank', triples: nonVerbalRepTriples(nvr, lang) };
  }

  const nvrUri = `${conceptUri}/nvr/${index + 1}`;
  const out: RdfTriple[] = [triple(RDF.type, iri(GLOSS.NonVerbalRep))];
  if (nvr.type) {
    const desigClass = designationClassId(nvr.type);
    if (desigClass !== GLOSS.Designation) {
      out.push(triple(RDF.type, iri(desigClass)));
    }
  }
  if (caption) {
    out.push(triple(SKOSXL.prefLabel, blank(
      triple(RDF.type, iri(SKOSXL.Label)),
      triple(SKOSXL.literalForm, lit(caption, { lang })),
    )));
  }
  if (imageSrc) {
    out.push(triple(GLOSS.image, lit(imageSrc, { datatype: XSD.anyURI })));
  }
  if ((nvr as any).description) {
    out.push(triple(DCTERMS.description, lit((nvr as any).description, { lang })));
  }
  const link = nvr.sources?.[0]?.origin?.link ?? null;
  if (link) {
    out.push(triple(PROV.wasDerivedFrom, lit(link, { datatype: XSD.anyURI })));
  }
  return { kind: 'uri', nvrUri, triples: out };
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
  if (d.international) w.literal(GLOSS.isInternational, 'true', { datatype: XSD.boolean });
  if (d.absent) w.literal(GLOSS.isAbsent, 'true', { datatype: XSD.boolean });
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
    if (abbr.acronym) w.literal(GLOSS.isAcronym, 'true', { datatype: XSD.boolean });
    if (abbr.initialism) w.literal(GLOSS.isInitialism, 'true', { datatype: XSD.boolean });
    if (abbr.truncation) w.literal(GLOSS.isTruncation, 'true', { datatype: XSD.boolean });
  }

  if (d.type === 'graphical_symbol') {
    const gs = d as GraphicalSymbol;
    if (gs.text) w.literal(GLOSS.text, gs.text);
    if (gs.image) w.literal(GLOSS.image, gs.image);
  }
}
