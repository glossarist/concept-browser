// Prefix bindings for concept-browser's RDF emission.
//
// Sources PREFIXES (the canonical prefix→IRI map) from glossarist/rdf
// so the runtime list stays in sync with the upstream concept-model
// `prefixes.ttl` SSOT automatically. The per-prefix `description`
// strings remain local because they are presentation metadata, not
// part of the canonical bindings.
//
// glossarist-js's PREFIXES is generated from the JSON-LD context,
// which omits some well-known prefixes that ARE in `prefixes.ttl`
// and ARE used in instance data (dcat, foaf, sh). We supplement
// locally until upstream glossarist-js regenerates from the full
// prefixes.ttl.

import { PREFIXES as GLOSSARIST_PREFIXES } from 'glossarist/rdf/prefixes';

export interface PrefixEntry {
  prefix: string;
  iri: string;
  description: string;
}

// Prefixes declared in concept-model's canonical prefixes.ttl that
// glossarist-js's PREFIXES does not yet export (because they are
// absent from the JSON-LD context, even though they appear in
// instance data — dcat:Dataset, foaf:Person, sh:NodeShape).
const SUPPLEMENTAL_PREFIXES: Record<string, string> = {
  dcat: 'http://www.w3.org/ns/dcat#',
  foaf: 'http://xmlns.com/foaf/0.1/',
  sh:   'http://www.w3.org/ns/shacl#',
};

const PREFIX_DESCRIPTIONS: Record<string, string> = {
  gloss:     'Glossarist ontology',
  skos:      'Simple Knowledge Organization System',
  skosxl:    'SKOS eXtension for Labels',
  'iso-thes': 'ISO 25964 SKOS thesaurus extensions',
  rdf:       'RDF core vocabulary',
  rdfs:      'RDF Schema',
  owl:       'Web Ontology Language',
  dcterms:   'Dublin Core terms',
  prov:      'PROV-O provenance',
  dcat:      'Data Catalog vocabulary',
  foaf:      'Friend-of-a-Friend agents',
  vann:      'Vocabulary annotations',
  xsd:       'XML Schema datatypes',
  sh:        'SHACL shapes vocabulary',
};

function descriptionFor(prefix: string): string {
  return PREFIX_DESCRIPTIONS[prefix] ?? '';
}

// Merge glossarist-js's canonical PREFIXES with the supplemental
// bindings. Order: glossarist PREFIXES first (canonical order), then
// any supplemental prefixes not already present.
const MERGED: Record<string, string> = {
  ...GLOSSARIST_PREFIXES,
  ...SUPPLEMENTAL_PREFIXES,
};

// Derive RDF_PREFIXES at module load.
export const RDF_PREFIXES: readonly PrefixEntry[] = Object.freeze(
  Object.entries(MERGED).map(([prefix, iri]) => ({
    prefix,
    iri,
    description: descriptionFor(prefix),
  })),
);

export function findPrefix(prefix: string): PrefixEntry | undefined {
  return RDF_PREFIXES.find(p => p.prefix === prefix);
}
