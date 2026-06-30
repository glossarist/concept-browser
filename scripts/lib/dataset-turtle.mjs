const PREFIXES = [
  ['dcat',     'http://www.w3.org/ns/dcat#'],
  ['skos',     'http://www.w3.org/2004/02/skos/core#'],
  ['dcterms',  'http://purl.org/dc/terms/'],
  ['rdf',      'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
  ['rdfs',     'http://www.w3.org/2000/01/rdf-schema#'],
  ['prov',     'http://www.w3.org/ns/prov#'],
  ['xsd',      'http://www.w3.org/2001/XMLSchema#'],
];

function ttlLit(s) {
  if (s == null) return '""';
  const escaped = String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function buildDatasetTurtle(input) {
  const lines = [];
  for (const [prefix, iri] of PREFIXES) {
    lines.push(`@prefix ${prefix}: <${iri}> .`);
  }
  lines.push('');

  lines.push(`<${input.datasetIri}> a dcat:Dataset, skos:ConceptScheme ;`);
  lines.push(`  dcterms:title ${ttlLit(input.title)} ;`);
  if (input.description) {
    lines.push(`  dcterms:description ${ttlLit(input.description)} ;`);
  }
  lines.push(`  dcterms:modified "${input.modified}"^^xsd:date ;`);
  lines.push(`  dcterms:identifier ${ttlLit(input.registerId)} ;`);

  for (const lang of input.languages ?? []) {
    lines.push(`  dcterms:language <http://id.loc.gov/vocabulary/iso639-1/${lang}> ;`);
  }

  for (const dist of input.distributions ?? []) {
    lines.push('  dcat:distribution [');
    lines.push(`    a dcat:Distribution ;`);
    lines.push(`    dcterms:title ${ttlLit(dist.title)} ;`);
    lines.push(`    dcat:mediaType ${ttlLit(dist.mediaType)} ;`);
    lines.push(`    dcat:downloadURL <${dist.downloadUrl}> ;`);
    if (dist.byteSize != null) {
      lines.push(`    dcat:byteSize "${dist.byteSize}"^^xsd:integer ;`);
    }
    lines.push('  ] ;');
  }

  for (const concept of input.topConceptUris ?? []) {
    lines.push(`  skos:hasTopConcept <${concept}> ;`);
  }

  if (input.sourceRepoUrl) {
    lines.push(`  prov:wasDerivedFrom <${input.sourceRepoUrl}> ;`);
  }
  if (input.publisherIri) {
    lines.push(`  dcterms:publisher <${input.publisherIri}> ;`);
  }
  if (input.contactIri) {
    lines.push(`  dcat:contactPoint <${input.contactIri}> ;`);
  }

  lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');

  for (const section of input.sections ?? []) {
    lines.push('');
    lines.push(`<${section.collectionIri}> a skos:Collection ;`);
    lines.push(`  dcterms:title ${ttlLit(section.title)} ;`);
    for (const member of section.memberUris) {
      lines.push(`  skos:member <${member}> ;`);
    }
    if (section.memberUris.length === 0) {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');
    } else {
      lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');
    }
  }

  return lines.join('\n') + '\n';
}
