import type { ComputedRef } from 'vue';
import { computed } from 'vue';
import type { Concept, LocalizedConcept, Designation, NonVerbRep, Expression as ExpressionType, Abbreviation as AbbreviationType, GraphicalSymbol as GraphicalSymbolType } from 'glossarist';
import { getClass } from '../../adapters/ontology-schema';
import { ConceptIdentity } from '../../adapters/concept-identity';
import { GLOSS, SKOS, SKOSXL, DCTERMS, RDF } from './predicates';

export interface PropValue {
  predicate: string;
  values: string[];
  nested?: boolean;
}

export interface ClassInstance {
  classId: string;
  classLabel: string;
  label: string;
  props: PropValue[];
}

export interface RdfDocument {
  sections: ComputedRef<ClassInstance[]>;
  turtle: ComputedRef<string>;
  jsonld: ComputedRef<string>;
  typeChain: ComputedRef<string[]>;
}

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

function formatCitation(c: any): string {
  if (!c) return '';
  if (c.source && c.id) return `${c.source} ${c.id}`;
  if (c.ref?.source) {
    const r = c.ref;
    return r.id ? `${r.source} ${r.id}` : r.source;
  }
  return '';
}

function formatNonVerbalRep(nvr: NonVerbRep): string {
  const parts: string[] = [];
  if (nvr.type) parts.push(nvr.type);
  if (nvr.caption) parts.push(nvr.caption);
  if (nvr.description) parts.push(nvr.description);
  return parts.filter(Boolean).join(': ');
}

class PropBag {
  private readonly items: PropValue[] = [];
  private readonly seen = new Set<string>();

  add(pred: string, ...vals: string[]): void {
    const filtered = vals.filter(Boolean);
    if (filtered.length === 0) return;
    this.append({ predicate: pred, values: filtered });
  }

  addNested(pred: string, ...vals: string[]): void {
    const filtered = vals.filter(Boolean);
    if (filtered.length === 0) return;
    this.append({ predicate: pred, values: filtered, nested: true });
  }

  private append(item: PropValue): void {
    const key = `${item.predicate}#${item.nested ? 'n' : 'f'}#${item.values.join('')}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.items.push(item);
  }

  get list(): PropValue[] {
    return this.items;
  }
}

function conceptInstance(concept: Concept, conceptUri: string): ClassInstance {
  const bag = new PropBag();
  bag.add(GLOSS.identifier, concept.id);
  if (concept.status) bag.add(GLOSS.hasStatus, `gloss:status/${concept.status}`);
  for (const d of concept.domains) bag.addNested(GLOSS.hasDomain, d.conceptId || d.urn || '');
  for (const s of concept.sources) bag.addNested(GLOSS.hasSource, formatCitation(s.origin));
  for (const d of concept.dates) bag.addNested(GLOSS.hasDate, `${d.type}: ${d.date}`);
  for (const r of concept.relatedConcepts) {
    const refLabel = r.content || (r.ref ? `${r.ref.source || ''} ${r.ref.id || ''}`.trim() : '');
    bag.addNested(GLOSS.hasRelatedConcept, `${r.type}: ${refLabel}`);
  }
  for (const lang of concept.languages) {
    bag.addNested(GLOSS.hasLocalization, `${lang}: ${concept.localization(lang)?.primaryDesignation ?? ''}`);
  }
  return { classId: GLOSS.Concept, classLabel: 'Concept', label: concept.id, props: bag.list };
}

function localizedInstance(lc: LocalizedConcept, conceptUri: string): ClassInstance {
  const bag = new PropBag();
  bag.add(DCTERMS.language, lc.languageCode ?? '');
  if (lc.script) bag.add(GLOSS.script, lc.script);
  if (lc.system) bag.add(GLOSS.system, lc.system);
  if (lc.entryStatus) bag.add(GLOSS.hasEntryStatus, `gloss:entstatus/${lc.entryStatus}`);
  if (lc.reviewType) bag.add(GLOSS.reviewType, lc.reviewType);
  bag.addNested(GLOSS.isLocalizationOf, conceptUri);
  for (const d of lc.terms) {
    bag.addNested(d.normativeStatus === 'preferred' ? SKOSXL.prefLabel : SKOSXL.altLabel, d.designation);
  }
  for (const d of lc.definitions) if (d.content) bag.addNested(GLOSS.hasDefinition, d.content);
  for (const n of lc.notes) if (n.content) bag.addNested(GLOSS.hasNote, n.content);
  for (const e of lc.examples) if (e.content) bag.addNested(GLOSS.hasExample, e.content);
  for (const a of lc.annotations ?? []) if (a.content) bag.addNested(GLOSS.hasAnnotation, a.content);
  for (const nvr of lc.nonVerbalRep ?? []) {
    const label = formatNonVerbalRep(nvr);
    if (label) bag.addNested(GLOSS.hasNonVerbalRep, label);
  }
  for (const s of lc.sources) bag.addNested(GLOSS.hasSource, formatCitation(s.origin));
  if (lc.domain) bag.add(GLOSS.domain, lc.domain);
  if (lc.classification) bag.add(GLOSS.classification, lc.classification);
  if (lc.release) bag.add(GLOSS.release, lc.release);
  if (lc.lineageSourceSimilarity != null) bag.add(GLOSS.lineageSourceSimilarity, String(lc.lineageSourceSimilarity));
  if (lc.reviewDate) bag.add(GLOSS.reviewDate, lc.reviewDate);
  if (lc.reviewDecisionDate) bag.add(GLOSS.reviewDecisionDate, lc.reviewDecisionDate);
  if (lc.reviewStatus) bag.add(GLOSS.reviewStatus, lc.reviewStatus);
  if (lc.reviewDecision) bag.add(GLOSS.reviewDecision, lc.reviewDecision);
  if (lc.reviewDecisionEvent) bag.addNested(GLOSS.reviewDecisionEvent, lc.reviewDecisionEvent);
  if (lc.reviewDecisionNotes) bag.addNested(GLOSS.reviewDecisionNotes, lc.reviewDecisionNotes);
  return {
    classId: GLOSS.LocalizedConcept,
    classLabel: 'LocalizedConcept',
    label: `${lc.languageCode}: ${lc.primaryDesignation ?? ''}`,
    props: bag.list,
  };
}

function designationInstance(d: Designation): ClassInstance {
  const bag = new PropBag();
  bag.add(SKOSXL.literalForm, `${d.designation}${d.language ? '@' + d.language : ''}`);
  if (d.normativeStatus) bag.add(GLOSS.normativeStatus, `gloss:norm/${d.normativeStatus}`);
  if (d.geographicalArea) bag.add(GLOSS.geographicalArea, d.geographicalArea);
  if (d.international) bag.add(GLOSS.isInternational, 'true');
  if (d.absent) bag.add(GLOSS.isAbsent, 'true');
  if (d.termType) bag.add(GLOSS.hasTermType, d.termType);
  for (const p of d.pronunciations ?? []) bag.add(GLOSS.hasPronunciation, p.content || '');

  if (d.type === 'expression' || d.type === 'abbreviation') {
    const expr = d as ExpressionType;
    if (expr.prefix) bag.add(GLOSS.prefix, expr.prefix);
    if (expr.usageInfo) bag.add(GLOSS.usageInfo, expr.usageInfo);
    if (expr.fieldOfApplication) bag.add(GLOSS.fieldOfApplication, expr.fieldOfApplication);
    for (const gi of expr.grammarInfo ?? []) {
      const parts: string[] = [];
      if (gi.gender) parts.push(`gender:${gi.gender}`);
      if (gi.number) parts.push(`number:${gi.number}`);
      if (gi.partOfSpeech) parts.push(`pos:${gi.partOfSpeech}`);
      if (parts.length) bag.add(GLOSS.hasGrammarInfo, parts.join(', '));
    }
  }

  if (d.type === 'abbreviation') {
    const abbr = d as AbbreviationType;
    if (abbr.acronym) bag.add(GLOSS.isAcronym, 'true');
    if (abbr.initialism) bag.add(GLOSS.isInitialism, 'true');
    if (abbr.truncation) bag.add(GLOSS.isTruncation, 'true');
  }

  if (d.type === 'graphical_symbol') {
    const gs = d as GraphicalSymbolType;
    if (gs.text) bag.add(GLOSS.text, gs.text);
    if (gs.image) bag.add(GLOSS.image, gs.image);
  }

  const classId = designationClassId(d.type);
  return { classId, classLabel: classId.replace('gloss:', ''), label: d.designation, props: bag.list };
}

interface ConceptEmissionModel {
  concept: Concept;
  conceptUri: string;
  identity: ConceptIdentity;
  sections: ClassInstance[];
}

function buildEmissionModel(concept: Concept, conceptUri: string, identity: ConceptIdentity): ConceptEmissionModel {
  const sections: ClassInstance[] = [conceptInstance(concept, conceptUri)];
  for (const lang of concept.languages) {
    const lc = concept.localization(lang);
    if (!lc) continue;
    sections.push(localizedInstance(lc, conceptUri));
    for (const d of lc.terms) sections.push(designationInstance(d));
  }
  return { concept, conceptUri, identity, sections };
}

function writeToTurtle(model: ConceptEmissionModel): string {
  const lines: string[] = [];
  const ind = '  ';
  const { concept: c, conceptUri: uri } = model;

  lines.push('@prefix gloss: <https://www.glossarist.org/ontologies/> .');
  lines.push('@prefix skos: <http://www.w3.org/2004/02/skos/core#> .');
  lines.push('@prefix skosxl: <http://www.w3.org/2008/05/skos-xl#> .');
  lines.push('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
  lines.push('@prefix dcterms: <http://purl.org/dc/terms/> .');
  lines.push('');

  lines.push(`<${uri}> a ${GLOSS.Concept}, ${SKOS.Concept} ;`);
  lines.push(`${ind}${GLOSS.identifier} "${c.id}" ;`);
  if (c.status) lines.push(`${ind}${GLOSS.hasStatus} gloss:status/${c.status} ;`);
  for (const lang of c.languages) lines.push(`${ind}${GLOSS.hasLocalization} <${uri}/${lang}> ;`);
  for (const r of c.relatedConcepts) {
    lines.push(`${ind}${GLOSS.hasRelatedConcept} [`);
    lines.push(`${ind}${ind}${GLOSS.relationshipType} gloss:rel/${r.type} ;`);
    if (r.content) lines.push(`${ind}${ind}${GLOSS.relationshipContent} "${r.content}" ;`);
    if (r.ref) {
      if (r.ref.source) lines.push(`${ind}${ind}${GLOSS.conceptSource} "${r.ref.source}" ;`);
      if (r.ref.id) lines.push(`${ind}${ind}${GLOSS.conceptId} "${r.ref.id}" ;`);
    }
    lines.push(`${ind}] ;`);
  }
  lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');

  for (const lang of c.languages) {
    const lc = c.localization(lang);
    if (!lc) continue;
    lines.push('');
    lines.push(`<${uri}/${lang}> a ${GLOSS.LocalizedConcept}, ${SKOS.Concept} ;`);
    lines.push(`${ind}${DCTERMS.language} "${lang}" ;`);
    if (lc.script) lines.push(`${ind}${GLOSS.script} "${lc.script}" ;`);
    if (lc.system) lines.push(`${ind}${GLOSS.system} "${lc.system}" ;`);
    lines.push(`${ind}${GLOSS.isLocalizationOf} <${uri}> ;`);
    if (lc.entryStatus) lines.push(`${ind}${GLOSS.hasEntryStatus} gloss:entstatus/${lc.entryStatus} ;`);
    if (lc.reviewType) lines.push(`${ind}${GLOSS.reviewType} "${lc.reviewType}" ;`);
    if (lc.classification) lines.push(`${ind}${GLOSS.classification} "${lc.classification}" ;`);
    if (lc.release) lines.push(`${ind}${GLOSS.release} "${lc.release}" ;`);
    if (lc.lineageSourceSimilarity != null) lines.push(`${ind}${GLOSS.lineageSourceSimilarity} "${lc.lineageSourceSimilarity}" ;`);
    if (lc.reviewDate) lines.push(`${ind}${GLOSS.reviewDate} "${lc.reviewDate}" ;`);
    if (lc.reviewDecisionDate) lines.push(`${ind}${GLOSS.reviewDecisionDate} "${lc.reviewDecisionDate}" ;`);
    if (lc.reviewStatus) lines.push(`${ind}${GLOSS.reviewStatus} "${lc.reviewStatus}" ;`);
    if (lc.reviewDecision) lines.push(`${ind}${GLOSS.reviewDecision} "${lc.reviewDecision}" ;`);
    if (lc.reviewDecisionEvent) lines.push(`${ind}${GLOSS.reviewDecisionEvent} "${lc.reviewDecisionEvent}" ;`);
    if (lc.reviewDecisionNotes) lines.push(`${ind}${GLOSS.reviewDecisionNotes} "${lc.reviewDecisionNotes}" ;`);
    for (let di = 0; di < lc.terms.length; di++) {
      const d = lc.terms[di];
      const isPreferred = d.normativeStatus === 'preferred';
      const xlPrefix = isPreferred ? SKOSXL.prefLabel : SKOSXL.altLabel;
      const skosPrefix = isPreferred ? SKOS.prefLabel : SKOS.altLabel;
      lines.push(`${ind}${xlPrefix} <${uri}/${lang}/desig/${desigSlug(d.designation, di)}> ;`);
      lines.push(`${ind}${skosPrefix} "${d.designation}"@${lang} ;`);
    }
    for (const def of lc.definitions) {
      if (def.content) {
        lines.push(`${ind}${SKOS.definition} "${def.content}"@${lang} ;`);
        lines.push(`${ind}${GLOSS.hasDefinition} [ ${RDF.value} "${def.content}"@${lang} ] ;`);
      }
    }
    for (const nvr of lc.nonVerbalRep ?? []) {
      const parts: string[] = [];
      if (nvr.type) parts.push(`${ind}${ind}${GLOSS.nonVerbalType} "${nvr.type}" ;`);
      if (nvr.caption) parts.push(`${ind}${ind}${GLOSS.caption} "${nvr.caption}"@${lang} ;`);
      if (nvr.description) parts.push(`${ind}${ind}${DCTERMS.description} "${nvr.description}"@${lang} ;`);
      if (nvr.alt) parts.push(`${ind}${ind}${GLOSS.altText} "${nvr.alt}"@${lang} ;`);
      for (const img of nvr.images ?? []) {
        if (img.src) parts.push(`${ind}${ind}${GLOSS.image} <${img.src}> ;`);
      }
      if (parts.length) {
        lines.push(`${ind}${GLOSS.hasNonVerbalRep} [`);
        for (const p of parts) lines.push(p);
        lines.push(`${ind}] ;`);
      }
    }
    for (const ann of lc.annotations ?? []) {
      if (ann.content) lines.push(`${ind}${GLOSS.hasAnnotation} "${ann.content}"@${lang} ;`);
    }
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');

    for (let di = 0; di < lc.terms.length; di++) {
      const d = lc.terms[di];
      const desigUri = `${uri}/${lang}/desig/${desigSlug(d.designation, di)}`;
      const dc = designationClassId(d.type);
      lines.push('');
      lines.push(`<${desigUri}> a ${dc}, ${SKOSXL.Label} ;`);
      lines.push(`${ind}${SKOSXL.literalForm} "${d.designation}"@${lang} ;`);
      if (d.normativeStatus) lines.push(`${ind}${GLOSS.normativeStatus} gloss:norm/${d.normativeStatus} ;`);
      lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');
    }
  }

  return lines.join('\n');
}

function writeToJsonld(model: ConceptEmissionModel): string {
  const { concept: c, conceptUri: uri } = model;
  const doc: any = {
    '@context': {
      gloss: 'https://www.glossarist.org/ontologies/',
      skos: 'http://www.w3.org/2004/02/skos/core#',
      skosxl: 'http://www.w3.org/2008/05/skos-xl#',
      dcterms: 'http://purl.org/dc/terms/',
    },
    '@graph': [],
  };

  const conceptNode: any = {
    '@id': uri,
    '@type': [GLOSS.Concept, SKOS.Concept],
    [GLOSS.identifier]: c.id,
  };
  if (c.status) conceptNode[GLOSS.hasStatus] = { '@id': `gloss:status/${c.status}` };
  conceptNode[GLOSS.hasLocalization] = c.languages.map(l => ({ '@id': `${uri}/${l}` }));
  doc['@graph'].push(conceptNode);

  for (const lang of c.languages) {
    const lc = c.localization(lang);
    if (!lc) continue;
    const lcNode: any = {
      '@id': `${uri}/${lang}`,
      '@type': [GLOSS.LocalizedConcept, SKOS.Concept],
      [DCTERMS.language]: lang,
      [GLOSS.isLocalizationOf]: { '@id': uri },
    };
    if (lc.script) lcNode[GLOSS.script] = lc.script;
    if (lc.system) lcNode[GLOSS.system] = lc.system;
    if (lc.entryStatus) lcNode[GLOSS.hasEntryStatus] = { '@id': `gloss:entstatus/${lc.entryStatus}` };
    if (lc.reviewType) lcNode[GLOSS.reviewType] = lc.reviewType;
    if (lc.classification) lcNode[GLOSS.classification] = lc.classification;
    if (lc.release) lcNode[GLOSS.release] = lc.release;
    if (lc.lineageSourceSimilarity != null) lcNode[GLOSS.lineageSourceSimilarity] = lc.lineageSourceSimilarity;
    if (lc.reviewDate) lcNode[GLOSS.reviewDate] = lc.reviewDate;
    if (lc.reviewDecisionDate) lcNode[GLOSS.reviewDecisionDate] = lc.reviewDecisionDate;
    if (lc.reviewStatus) lcNode[GLOSS.reviewStatus] = lc.reviewStatus;
    if (lc.reviewDecision) lcNode[GLOSS.reviewDecision] = lc.reviewDecision;
    if (lc.reviewDecisionEvent) lcNode[GLOSS.reviewDecisionEvent] = lc.reviewDecisionEvent;
    if (lc.reviewDecisionNotes) lcNode[GLOSS.reviewDecisionNotes] = lc.reviewDecisionNotes;
    for (let di = 0; di < lc.terms.length; di++) {
      const d = lc.terms[di];
      const key = d.normativeStatus === 'preferred' ? SKOSXL.prefLabel : SKOSXL.altLabel;
      lcNode[key] = lcNode[key] || [];
      lcNode[key].push({ '@id': `${uri}/${lang}/desig/${desigSlug(d.designation, di)}` });
    }
    const nvrNodes: any[] = [];
    for (const nvr of lc.nonVerbalRep ?? []) {
      const node: any = {};
      if (nvr.type) node[GLOSS.nonVerbalType] = nvr.type;
      if (nvr.caption) node[GLOSS.caption] = { '@value': nvr.caption, '@language': lang };
      if (nvr.description) node[DCTERMS.description] = { '@value': nvr.description, '@language': lang };
      if (nvr.alt) node[GLOSS.altText] = { '@value': nvr.alt, '@language': lang };
      const images = (nvr.images ?? []).map((img: any) => img.src).filter(Boolean);
      if (images.length) node[GLOSS.image] = images.map((u: string) => ({ '@id': u }));
      if (Object.keys(node).length) nvrNodes.push(node);
    }
    if (nvrNodes.length) lcNode[GLOSS.hasNonVerbalRep] = nvrNodes;
    const annotations = (lc.annotations ?? []).filter(a => a.content);
    if (annotations.length) {
      lcNode[GLOSS.hasAnnotation] = annotations.map(a => ({ '@value': a.content, '@language': lang }));
    }
    doc['@graph'].push(lcNode);

    for (let di = 0; di < lc.terms.length; di++) {
      const d = lc.terms[di];
      const desigUri = `${uri}/${lang}/desig/${desigSlug(d.designation, di)}`;
      const desigNode: any = {
        '@id': desigUri,
        '@type': [designationClassId(d.type), SKOSXL.Label],
        [SKOSXL.literalForm]: { '@value': d.designation, '@language': lang },
      };
      if (d.normativeStatus) desigNode[GLOSS.normativeStatus] = { '@id': `gloss:norm/${d.normativeStatus}` };
      doc['@graph'].push(desigNode);
    }
  }

  return JSON.stringify(doc, null, 2);
}

export interface UseRdfDocumentOptions {
  readonly lazy?: boolean;
}

export function useRdfDocument(
  getConcept: () => Concept,
  getConceptUri: () => string,
  _options: UseRdfDocumentOptions = {},
): RdfDocument {
  const identity = computed(() => {
    const concept = getConcept();
    const uri = getConceptUri();
    if (ConceptIdentity.isConceptUri(uri)) {
      const parsed = ConceptIdentity.fromUri(uri);
      if (parsed.localId === concept.id) return parsed;
    }
    return new ConceptIdentity(concept.id, '', '');
  });
  const safeUri = computed(() => {
    const uri = getConceptUri();
    return uri || identity.value.uri;
  });
  const emission = computed(() => buildEmissionModel(getConcept(), safeUri.value, identity.value));
  const sections = computed(() => emission.value.sections);
  const turtle = computed(() => writeToTurtle(emission.value));
  const jsonld = computed(() => writeToJsonld(emission.value));
  const typeChain = computed(() => {
    const conceptCls = getClass('gloss:Concept');
    if (!conceptCls) return ['owl:Thing', 'skos:Concept', 'gloss:Concept'];
    return ['owl:Thing', ...conceptCls.ancestors, 'gloss:Concept'];
  });
  return { sections, turtle, jsonld, typeChain };
}
