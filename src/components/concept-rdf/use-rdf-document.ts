import type { ComputedRef } from 'vue';
import { computed } from 'vue';
import type { Concept, LocalizedConcept, Designation, Expression as ExpressionType, Abbreviation as AbbreviationType, GraphicalSymbol as GraphicalSymbolType } from 'glossarist';
import { getClass } from '../../adapters/ontology-schema';

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
  expression: 'gloss:Expression',
  abbreviation: 'gloss:Abbreviation',
  symbol: 'gloss:Symbol',
  letter_symbol: 'gloss:LetterSymbol',
  graphical_symbol: 'gloss:GraphicalSymbol',
};

function designationClassId(type: string): string {
  return DESIGNATION_CLASS[type] ?? 'gloss:Designation';
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
  bag.add('gloss:identifier', concept.id);
  if (concept.status) bag.add('gloss:hasStatus', `gloss:status/${concept.status}`);
  for (const d of concept.domains) bag.addNested('gloss:hasDomain', d.conceptId || d.urn || '');
  for (const s of concept.sources) bag.addNested('gloss:hasSource', formatCitation(s.origin));
  for (const d of concept.dates) bag.addNested('gloss:hasDate', `${d.type}: ${d.date}`);
  for (const r of concept.relatedConcepts) {
    const refLabel = r.content || (r.ref ? `${r.ref.source || ''} ${r.ref.id || ''}`.trim() : '');
    bag.addNested('gloss:hasRelatedConcept', `${r.type}: ${refLabel}`);
  }
  for (const lang of concept.languages) {
    bag.addNested('gloss:hasLocalization', `${lang}: ${concept.localization(lang)?.primaryDesignation ?? ''}`);
  }
  return { classId: 'gloss:Concept', classLabel: 'Concept', label: concept.id, props: bag.list };
}

function localizedInstance(lc: LocalizedConcept, conceptUri: string): ClassInstance {
  const bag = new PropBag();
  bag.add('dcterms:language', lc.languageCode ?? '');
  if (lc.entryStatus) bag.add('gloss:hasEntryStatus', `gloss:entstatus/${lc.entryStatus}`);
  bag.addNested('gloss:isLocalizationOf', conceptUri);
  for (const d of lc.terms) {
    bag.addNested(d.normativeStatus === 'preferred' ? 'skosxl:prefLabel' : 'skosxl:altLabel', d.designation);
  }
  for (const d of lc.definitions) if (d.content) bag.addNested('gloss:hasDefinition', d.content);
  for (const n of lc.notes) if (n.content) bag.addNested('gloss:hasNote', n.content);
  for (const e of lc.examples) if (e.content) bag.addNested('gloss:hasExample', e.content);
  for (const s of lc.sources) bag.addNested('gloss:hasSource', formatCitation(s.origin));
  if (lc.domain) bag.add('gloss:domain', lc.domain);
  return {
    classId: 'gloss:LocalizedConcept',
    classLabel: 'LocalizedConcept',
    label: `${lc.languageCode}: ${lc.primaryDesignation ?? ''}`,
    props: bag.list,
  };
}

function designationInstance(d: Designation): ClassInstance {
  const bag = new PropBag();
  bag.add('skosxl:literalForm', `${d.designation}${d.language ? '@' + d.language : ''}`);
  if (d.normativeStatus) bag.add('gloss:normativeStatus', `gloss:norm/${d.normativeStatus}`);
  if (d.geographicalArea) bag.add('gloss:geographicalArea', d.geographicalArea);
  if (d.international) bag.add('gloss:isInternational', 'true');
  if (d.absent) bag.add('gloss:isAbsent', 'true');
  if (d.termType) bag.add('gloss:hasTermType', d.termType);
  for (const p of d.pronunciations ?? []) bag.add('gloss:hasPronunciation', p.content || '');

  if (d.type === 'expression' || d.type === 'abbreviation') {
    const expr = d as ExpressionType;
    if (expr.prefix) bag.add('gloss:prefix', expr.prefix);
    if (expr.usageInfo) bag.add('gloss:usageInfo', expr.usageInfo);
    if (expr.fieldOfApplication) bag.add('gloss:fieldOfApplication', expr.fieldOfApplication);
    for (const gi of expr.grammarInfo ?? []) {
      const parts: string[] = [];
      if (gi.gender) parts.push(`gender:${gi.gender}`);
      if (gi.number) parts.push(`number:${gi.number}`);
      if (gi.partOfSpeech) parts.push(`pos:${gi.partOfSpeech}`);
      if (parts.length) bag.add('gloss:hasGrammarInfo', parts.join(', '));
    }
  }

  if (d.type === 'abbreviation') {
    const abbr = d as AbbreviationType;
    if (abbr.acronym) bag.add('gloss:isAcronym', 'true');
    if (abbr.initialism) bag.add('gloss:isInitialism', 'true');
    if (abbr.truncation) bag.add('gloss:isTruncation', 'true');
  }

  if (d.type === 'graphical_symbol') {
    const gs = d as GraphicalSymbolType;
    if (gs.text) bag.add('gloss:text', gs.text);
    if (gs.image) bag.add('gloss:image', gs.image);
  }

  const classId = designationClassId(d.type);
  return { classId, classLabel: classId.replace('gloss:', ''), label: d.designation, props: bag.list };
}

interface ConceptEmissionModel {
  concept: Concept;
  conceptUri: string;
  sections: ClassInstance[];
}

function buildEmissionModel(concept: Concept, conceptUri: string): ConceptEmissionModel {
  const sections: ClassInstance[] = [conceptInstance(concept, conceptUri)];
  for (const lang of concept.languages) {
    const lc = concept.localization(lang);
    if (!lc) continue;
    sections.push(localizedInstance(lc, conceptUri));
    for (const d of lc.terms) sections.push(designationInstance(d));
  }
  return { concept, conceptUri, sections };
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

  lines.push(`<${uri}> a gloss:Concept, skos:Concept ;`);
  lines.push(`${ind}gloss:identifier "${c.id}" ;`);
  if (c.status) lines.push(`${ind}gloss:hasStatus gloss:status/${c.status} ;`);
  for (const lang of c.languages) lines.push(`${ind}gloss:hasLocalization <${uri}/${lang}> ;`);
  for (const r of c.relatedConcepts) {
    lines.push(`${ind}gloss:hasRelatedConcept [`);
    lines.push(`${ind}${ind}gloss:relationshipType gloss:rel/${r.type} ;`);
    if (r.content) lines.push(`${ind}${ind}gloss:relationshipContent "${r.content}" ;`);
    if (r.ref) {
      if (r.ref.source) lines.push(`${ind}${ind}gloss:conceptSource "${r.ref.source}" ;`);
      if (r.ref.id) lines.push(`${ind}${ind}gloss:conceptId "${r.ref.id}" ;`);
    }
    lines.push(`${ind}] ;`);
  }
  lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');

  for (const lang of c.languages) {
    const lc = c.localization(lang);
    if (!lc) continue;
    lines.push('');
    lines.push(`<${uri}/${lang}> a gloss:LocalizedConcept, skos:Concept ;`);
    lines.push(`${ind}dcterms:language "${lang}" ;`);
    lines.push(`${ind}gloss:isLocalizationOf <${uri}> ;`);
    if (lc.entryStatus) lines.push(`${ind}gloss:hasEntryStatus gloss:entstatus/${lc.entryStatus} ;`);
    for (let di = 0; di < lc.terms.length; di++) {
      const d = lc.terms[di];
      const isPreferred = d.normativeStatus === 'preferred';
      const xlPrefix = isPreferred ? 'skosxl:prefLabel' : 'skosxl:altLabel';
      const skosPrefix = isPreferred ? 'skos:prefLabel' : 'skos:altLabel';
      lines.push(`${ind}${xlPrefix} <${uri}/${lang}/desig/${desigSlug(d.designation, di)}> ;`);
      lines.push(`${ind}${skosPrefix} "${d.designation}"@${lang} ;`);
    }
    for (const def of lc.definitions) {
      if (def.content) {
        lines.push(`${ind}skos:definition "${def.content}"@${lang} ;`);
        lines.push(`${ind}gloss:hasDefinition [ rdf:value "${def.content}"@${lang} ] ;`);
      }
    }
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');

    for (let di = 0; di < lc.terms.length; di++) {
      const d = lc.terms[di];
      const desigUri = `${uri}/${lang}/desig/${desigSlug(d.designation, di)}`;
      const dc = designationClassId(d.type);
      lines.push('');
      lines.push(`<${desigUri}> a ${dc}, skosxl:Label ;`);
      lines.push(`${ind}skosxl:literalForm "${d.designation}"@${lang} ;`);
      if (d.normativeStatus) lines.push(`${ind}gloss:normativeStatus gloss:norm/${d.normativeStatus} ;`);
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
    '@type': ['gloss:Concept', 'skos:Concept'],
    'gloss:identifier': c.id,
  };
  if (c.status) conceptNode['gloss:hasStatus'] = { '@id': `gloss:status/${c.status}` };
  conceptNode['gloss:hasLocalization'] = c.languages.map(l => ({ '@id': `${uri}/${l}` }));
  doc['@graph'].push(conceptNode);

  for (const lang of c.languages) {
    const lc = c.localization(lang);
    if (!lc) continue;
    const lcNode: any = {
      '@id': `${uri}/${lang}`,
      '@type': ['gloss:LocalizedConcept', 'skos:Concept'],
      'dcterms:language': lang,
      'gloss:isLocalizationOf': { '@id': uri },
    };
    if (lc.entryStatus) lcNode['gloss:hasEntryStatus'] = { '@id': `gloss:entstatus/${lc.entryStatus}` };
    for (let di = 0; di < lc.terms.length; di++) {
      const d = lc.terms[di];
      const key = d.normativeStatus === 'preferred' ? 'skosxl:prefLabel' : 'skosxl:altLabel';
      lcNode[key] = lcNode[key] || [];
      lcNode[key].push({ '@id': `${uri}/${lang}/desig/${desigSlug(d.designation, di)}` });
    }
    doc['@graph'].push(lcNode);

    for (let di = 0; di < lc.terms.length; di++) {
      const d = lc.terms[di];
      const desigUri = `${uri}/${lang}/desig/${desigSlug(d.designation, di)}`;
      const desigNode: any = {
        '@id': desigUri,
        '@type': [designationClassId(d.type), 'skosxl:Label'],
        'skosxl:literalForm': { '@value': d.designation, '@language': lang },
      };
      if (d.normativeStatus) desigNode['gloss:normativeStatus'] = { '@id': `gloss:norm/${d.normativeStatus}` };
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
  const emission = computed(() => buildEmissionModel(getConcept(), getConceptUri()));
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
