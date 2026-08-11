/**
 * JSON-LD wire-format emitters — convert YAML author objects to gl:* JSON-LD.
 *
 * Extracted from generate-data.ts. Each function maps one YAML entity
 * (term, source, date, relation) to its JSON-LD wire representation.
 *
 * The 'gl:' prefix is the Glossarist JSON-LD namespace — see
 * data/concept-model/ontologies/glossarist.context.jsonld.
 */

function resolveRefUri(term: string, refMaps: any): string | undefined {
  if (!refMaps) return undefined;
  const lc = term.toLowerCase();
  if (refMaps.urnMap?.[lc]) return refMaps.urnMap[lc];
  if (refMaps.designationMap?.[lc]) return refMaps.designationMap[lc];
  if (refMaps.numericMap?.[term]) return refMaps.numericMap[term];
  return undefined;
}

export function termToDesignation(term: Record<string, any>): Record<string, any> {
  const typeMap: Record<string, string> = {
    expression: 'gl:Expression',
    abbreviation: 'gl:Abbreviation',
    symbol: 'gl:Symbol',
    letter_symbol: 'gl:LetterSymbol',
    'graphical symbol': 'gl:GraphicalSymbol',
  };
  const doc: Record<string, any> = {
    '@type': typeMap[term.type] || 'gl:Designation',
    'gl:normativeStatus': term.normative_status || 'preferred',
    'gl:term': term.designation,
  };

  if (term.grammar_info && term.grammar_info.length > 0) {
    doc['gl:grammarInfo'] = term.grammar_info.map((gi: Record<string, any>) => {
      const g: Record<string, any> = {};
      if (gi.gender) g['gl:gender'] = gi.gender;
      if (gi.number) g['gl:number'] = gi.number;
      if (gi.partOfSpeech) g['gl:partOfSpeech'] = gi.partOfSpeech;
      for (const pos of ['noun', 'verb', 'adj', 'adverb', 'preposition', 'participle']) {
        if (gi[pos]) g[`gl:${pos}`] = gi[pos];
      }
      return g;
    });
  }

  if (term.international !== undefined) doc['gl:international'] = term.international;
  if (term.absent !== undefined) doc['gl:absent'] = term.absent;
  if (term.geographical_area) doc['gl:geographicalArea'] = term.geographical_area;
  if (term.term_type) doc['gl:termType'] = term.term_type;
  if (term.prefix) doc['gl:prefix'] = term.prefix;
  if (term.usage_info) doc['gl:usageInfo'] = term.usage_info;
  if (term.field_of_application) doc['gl:fieldOfApplication'] = term.field_of_application;
  if (term.acronym !== undefined) doc['gl:acronym'] = term.acronym;
  if (term.initialism !== undefined) doc['gl:initialism'] = term.initialism;
  if (term.truncation !== undefined) doc['gl:truncation'] = term.truncation;
  if (term.text) doc['gl:text'] = term.text;
  if (term.image) doc['gl:image'] = term.image;

  if (term.related && term.related.length > 0) {
    doc['gl:related'] = term.related.map((r: Record<string, any>) => {
      const rel: Record<string, any> = {};
      if (r.type) rel['gl:relationshipType'] = r.type;
      if (r.target) {
        rel['gl:target'] = r.target;
      } else if (r.ref) {
        const ref: Record<string, any> = { '@type': 'gl:ConceptRef' };
        if (r.ref.source) ref['gl:source'] = r.ref.source;
        if (r.ref.id) ref['gl:id'] = r.ref.id;
        if (r.ref.text) ref['gl:text'] = r.ref.text;
        rel['gl:ref'] = ref;
      }
      return rel;
    });
  }

  return doc;
}

export function defsToJsonLd(defs: any[]): Record<string, any>[] {
  if (!defs || !Array.isArray(defs)) return [];
  return defs
    .map(d => ({ '@type': 'gl:DetailedDefinition', 'gl:content': d.content || '' }))
    .filter(d => d['gl:content']);
}

export function refToJsonLd(ref: any, typeName = 'gl:Ref'): Record<string, any> | undefined {
  if (!ref) return undefined;
  if (ref.ellipsis === true) {
    return { '@type': typeName, 'gl:ellipsis': true };
  }
  const refObj: Record<string, any> = { '@type': typeName };
  if (typeof ref === 'string') {
    refObj['gl:source'] = ref;
  } else {
    if (ref.source) refObj['gl:source'] = ref.source;
    if (ref.id) refObj['gl:id'] = ref.id;
    if (ref.version) refObj['gl:version'] = ref.version;
    if (ref.text) refObj['gl:text'] = ref.text;
    if (ref.external === true) refObj['gl:external'] = true;
  }
  return refObj;
}

export function localityToJsonLd(loc: any): Record<string, any> | undefined {
  if (!loc) return undefined;
  const locObj: Record<string, any> = {};
  if (loc.type) locObj['gl:localityType'] = loc.type;
  if (loc.reference_from) locObj['gl:referenceFrom'] = loc.reference_from;
  if (loc.referenceFrom) locObj['gl:referenceFrom'] = loc.referenceFrom;
  if (loc.reference_to) locObj['gl:referenceTo'] = loc.reference_to;
  if (loc.referenceTo) locObj['gl:referenceTo'] = loc.referenceTo;
  return Object.keys(locObj).length > 0 ? locObj : undefined;
}

export function citationToJsonLd(citation: any): Record<string, any> {
  const obj: Record<string, any> = {};
  const ref = refToJsonLd(citation.ref);
  if (ref) obj['gl:ref'] = ref;
  const loc = localityToJsonLd(citation.locality);
  if (loc) obj['gl:locality'] = loc;
  if (citation.link) obj['gl:link'] = citation.link;
  return obj;
}

export function sourcesToJsonLd(sources: any[]): Record<string, any>[] {
  if (!sources || !Array.isArray(sources)) return [];
  return sources.map(s => {
    const doc: Record<string, any> = { '@type': 'gl:ConceptSource' };
    if (s.id) doc['gl:id'] = s.id;
    if (s.type) doc['gl:sourceType'] = s.type;
    if (s.status) doc['gl:sourceStatus'] = s.status;
    if (s.modification) doc['gl:modification'] = s.modification;
    if (s.origin) {
      const origin: Record<string, any> = { '@type': 'gl:Citation' };
      const ref = refToJsonLd(s.origin.ref);
      if (ref) origin['gl:ref'] = ref;
      const loc = localityToJsonLd(s.origin.locality);
      if (loc) origin['gl:locality'] = loc;
      if (s.origin.link) origin['gl:link'] = s.origin.link;
      doc['gl:origin'] = origin;
    }
    if (s.sourced_from && s.sourced_from.length) {
      doc['gl:sourcedFrom'] = s.sourced_from.map((sf: any) => {
        const cite: Record<string, any> = { '@type': 'gl:Citation' };
        const ref = refToJsonLd(sf.ref);
        if (ref) cite['gl:ref'] = ref;
        const loc = localityToJsonLd(sf.locality);
        if (loc) cite['gl:locality'] = loc;
        if (sf.link) cite['gl:link'] = sf.link;
        return cite;
      });
    }
    return doc;
  });
}

export function refsToJsonLd(refs: any[], refMaps: any): Record<string, any>[] {
  if (!refs || !Array.isArray(refs)) return [];
  return refs.map(r => {
    if (r.id) {
      const ref: Record<string, any> = { '@id': r.id, 'gl:term': r.term };
      if (r.sourceId) ref['gl:sourceId'] = r.sourceId;
      if (r.citation) ref['gl:citation'] = citationToJsonLd(r.citation);
      return ref;
    }
    if (r.term && refMaps) {
      const uri = resolveRefUri(r.term, refMaps);
      if (uri) return { '@id': uri, 'gl:term': r.term };
    }
    return { '@id': r.id || r.term, 'gl:term': r.term };
  }).filter(r => r['@id']);
}
