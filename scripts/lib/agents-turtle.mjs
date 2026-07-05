// Agents turtle builder — emits foaf:Person / prov:Organization from
// contributor declarations.
//
// Delegates to glossarist-js's agents emitter + writeTurtle.

import {
  agentsFromContributors,
  agentsToQuads,
  collectQuads,
  writeTurtle,
} from 'glossarist/rdf';

function writerPrefixes() {
  return {
    foaf: 'http://xmlns.com/foaf/0.1/',
    prov: 'http://www.w3.org/ns/prov#',
    dcterms: 'http://purl.org/dc/terms/',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  };
}

export async function buildAgentsTurtle(contributors, agentBase = 'https://glossarist.org/agent') {
  const agents = agentsFromContributors(contributors ?? [], agentBase);
  const quads = collectQuads(agentsToQuads(agents));
  return writeTurtle(quads, { prefixes: writerPrefixes() });
}
