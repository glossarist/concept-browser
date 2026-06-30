const PREFIXES = [
  ['prov',    'http://www.w3.org/ns/prov#'],
  ['dcterms', 'http://purl.org/dc/terms/'],
  ['rdfs',    'http://www.w3.org/2000/01/rdf-schema#'],
  ['xsd',     'http://www.w3.org/2001/XMLSchema#'],
];

function ttlLit(s) {
  if (s == null) return '""';
  const escaped = String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function buildVersionTurtle(input) {
  const lines = [];
  for (const [prefix, iri] of PREFIXES) {
    lines.push(`@prefix ${prefix}: <${iri}> .`);
  }
  lines.push('');

  lines.push(`<${input.versionIri}> a prov:Entity ;`);
  lines.push(`  rdfs:label ${ttlLit(`${input.registerId} version ${input.version}`)} ;`);
  lines.push(`  dcterms:isVersionOf <${input.datasetIri}> ;`);
  if (input.previousVersionIri) {
    lines.push(`  prov:wasRevisionOf <${input.previousVersionIri}> ;`);
  }
  lines.push(`  prov:generatedAtTime "${input.generatedAt}"^^xsd:dateTime ;`);
  if (input.changeSummary) {
    lines.push(`  dcterms:description ${ttlLit(input.changeSummary)} ;`);
  }
  if (input.associatedAgentIri) {
    lines.push(`  prov:wasAssociatedWith <${input.associatedAgentIri}> ;`);
  }
  lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, ' .');
  return lines.join('\n') + '\n';
}

export function buildVersionHistoryTurtle(input) {
  let previousIri;
  const blocks = [];
  for (const v of input.versions ?? []) {
    const versionIri = `${input.datasetIri}versions/${v.version}`;
    blocks.push(buildVersionTurtle({
      registerId: input.registerId,
      version: v.version,
      versionIri,
      datasetIri: input.datasetIri,
      generatedAt: v.generatedAt,
      previousVersionIri: previousIri,
      changeSummary: v.changeSummary,
      associatedAgentIri: input.associatedAgentIri,
    }));
    previousIri = versionIri;
  }
  return blocks.join('\n');
}