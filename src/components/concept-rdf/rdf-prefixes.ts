// Prefix bindings for concept-browser's RDF emission.
//
// The canonical SSOT for prefix bindings is `data/concept-model/prefixes.ttl`
// (vendored from glossarist/concept-model). This list is the runtime subset
// actually emitted by concept-browser. Keep it aligned with prefixes.ttl
// whenever the upstream file changes.

export interface PrefixEntry {
  prefix: string;
  iri: string;
  description: string;
}

export const RDF_PREFIXES: readonly PrefixEntry[] = [
  { prefix: 'gloss',     iri: 'https://www.glossarist.org/ontologies/',                description: 'Glossarist ontology' },
  { prefix: 'skos',      iri: 'http://www.w3.org/2004/02/skos/core#',                  description: 'Simple Knowledge Organization System' },
  { prefix: 'skosxl',    iri: 'http://www.w3.org/2008/05/skos-xl#',                    description: 'SKOS eXtension for Labels' },
  { prefix: 'iso-thes',  iri: 'http://purl.org/iso25964/skos-thes#',                   description: 'ISO 25964 SKOS thesaurus extensions' },
  { prefix: 'rdf',       iri: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',           description: 'RDF core vocabulary' },
  { prefix: 'rdfs',      iri: 'http://www.w3.org/2000/01/rdf-schema#',                 description: 'RDF Schema' },
  { prefix: 'owl',       iri: 'http://www.w3.org/2002/07/owl#',                        description: 'Web Ontology Language' },
  { prefix: 'dcterms',   iri: 'http://purl.org/dc/terms/',                             description: 'Dublin Core terms' },
  { prefix: 'prov',      iri: 'http://www.w3.org/ns/prov#',                            description: 'PROV-O provenance' },
  { prefix: 'dcat',      iri: 'http://www.w3.org/ns/dcat#',                            description: 'Data Catalog vocabulary' },
  { prefix: 'foaf',      iri: 'http://xmlns.com/foaf/0.1/',                            description: 'Friend-of-a-Friend agents' },
  { prefix: 'vann',      iri: 'http://purl.org/vocab/vann/',                           description: 'Vocabulary annotations' },
  { prefix: 'xsd',       iri: 'http://www.w3.org/2001/XMLSchema#',                     description: 'XML Schema datatypes' },
  { prefix: 'sh',        iri: 'http://www.w3.org/ns/shacl#',                           description: 'SHACL shapes vocabulary' },
] as const;

export function findPrefix(prefix: string): PrefixEntry | undefined {
  return RDF_PREFIXES.find(p => p.prefix === prefix);
}
