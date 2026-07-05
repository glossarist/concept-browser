// Build activity turtle builder — emits prov:Activity per CI build run.
//
// Delegates to glossarist-js's build-activity emitter + writeTurtle.

import {
  buildActivityToQuads,
  collectQuads,
  writeTurtle,
} from 'glossarist/rdf';

function writerPrefixes() {
  return {
    prov: 'http://www.w3.org/ns/prov#',
    dcterms: 'http://purl.org/dc/terms/',
    foaf: 'http://xmlns.com/foaf/0.1/',
    rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
    gloss: 'https://www.glossarist.org/ontologies/',
  };
}

export async function buildActivityTurtle(input) {
  const quads = collectQuads(buildActivityToQuads(input));
  return writeTurtle(quads, { prefixes: writerPrefixes() });
}
