// Dataset turtle builder — emits dcat:Dataset + skos:ConceptScheme per
// register.
//
// Delegates to glossarist-js's dataset emitter + writeTurtle so the
// canonical prefix list, CURIE handling, and serialization stay in one
// place.

import {
  datasetToQuads,
  collectQuads,
  writeTurtle,
  PREFIXES,
} from 'glossarist/rdf';
import type { PrefixMap } from './yaml-types';

function writerPrefixes(): PrefixMap {
  const out: PrefixMap = {};
  // Only the prefixes this emitter actually uses — keeps the output
  // header focused.
  for (const k of ['dcat', 'skos', 'dcterms', 'prov', 'rdf', 'rdfs', 'xsd']) {
    if (PREFIXES[k]) out[k] = PREFIXES[k];
  }
  // dcat/prov are absent from glossarist-js's PREFIXES (which is
  // generated from the JSON-LD context). Add them locally — they're
  // in concept-model/prefixes.ttl.
  out.dcat ??= 'http://www.w3.org/ns/dcat#';
  out.prov ??= 'http://www.w3.org/ns/prov#';
  return out;
}

export async function buildDatasetTurtle(input: any): Promise<string> {
  const quads = collectQuads(datasetToQuads(input));
  return writeTurtle(quads, { prefixes: writerPrefixes() });
}
