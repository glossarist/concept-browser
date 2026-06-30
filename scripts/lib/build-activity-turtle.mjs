const PREFIXES = [
  ['prov',    'http://www.w3.org/ns/prov#'],
  ['dcterms', 'http://purl.org/dc/terms/'],
  ['foaf',    'http://xmlns.com/foaf/0.1/'],
  ['rdf',     'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
  ['rdfs',    'http://www.w3.org/2000/01/rdf-schema#'],
  ['xsd',     'http://www.w3.org/2001/XMLSchema#'],
  ['gloss',   'https://www.glossarist.org/ontologies/'],
];

function ttlLit(s) {
  if (s == null) return '""';
  const escaped = String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

export function buildActivityTurtle(input) {
  const lines = [];
  for (const [prefix, iri] of PREFIXES) {
    lines.push(`@prefix ${prefix}: <${iri}> .`);
  }
  lines.push('');

  const activityIri = `https://glossarist.org/activity/build/${input.runId}`;
  const usedEntities = [];

  if (input.gitSha) {
    usedEntities.push({
      iri: `https://glossarist.org/commit/${input.gitSha}`,
      types: ['prov:Entity'],
      label: input.gitSha,
      extras: input.gitBranch ? [`dcterms:description ${ttlLit(`branch: ${input.gitBranch}`)}`] : [],
    });
  }

  usedEntities.push({
    iri: `https://glossarist.org/tool/${input.toolId}/${input.toolVersion}`,
    types: ['prov:Entity'],
    label: `${input.toolId} ${input.toolVersion}`,
    extras: [`dcterms:identifier ${ttlLit(input.toolVersion)}`],
  });

  for (const register of input.datasetRegisters ?? []) {
    usedEntities.push({
      iri: `https://glossarist.org/${register}/`,
      types: ['prov:Entity'],
      label: register,
      extras: [],
    });
  }

  const activityLines = [
    `<${activityIri}> a prov:Activity ;`,
    `  rdfs:label ${ttlLit(`build ${input.runId}`)} ;`,
    `  prov:generatedAtTime "${input.endedAt}"^^xsd:dateTime ;`,
  ];
  for (const ent of usedEntities) {
    activityLines.push(`  prov:used <${ent.iri}> ;`);
  }
  activityLines.push(`  gloss:conceptCount "${input.conceptCount}"^^xsd:integer ;`);
  if (input.associatedAgentIri) {
    activityLines.push(`  prov:wasAssociatedWith <${input.associatedAgentIri}> ;`);
  }
  activityLines[activityLines.length - 1] = activityLines[activityLines.length - 1].replace(/ ;$/, ' .');
  lines.push(...activityLines);
  lines.push('');

  for (const ent of usedEntities) {
    const entLines = [
      `<${ent.iri}> a ${ent.types.join(', ')} ;`,
      `  rdfs:label ${ttlLit(ent.label)}${ent.extras.length > 0 ? ' ;' : ' .'}`,
    ];
    for (let i = 0; i < ent.extras.length; i++) {
      const last = i === ent.extras.length - 1;
      entLines.push(`  ${ent.extras[i]}${last ? ' .' : ' ;'}`);
    }
    lines.push(...entLines);
    lines.push('');
  }

  if (input.associatedAgentIri) {
    const label = input.associatedAgentIri.split('/').pop() ?? 'agent';
    lines.push(`<${input.associatedAgentIri}> a prov:Agent, foaf:Person ;`);
    lines.push(`  rdfs:label ${ttlLit(label)} .`);
    lines.push('');
  }

  return lines.join('\n') + '\n';
}
