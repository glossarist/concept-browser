// Version turtle builder — emits prov:Entity version chain per dataset.
//
// Delegates to glossarist-js's version emitter + writeTurtle.

import {
  versionToQuads,
  versionHistoryToQuads,
  collectQuads,
  writeTurtle,
} from 'glossarist/rdf';

function writerPrefixes() {
  return {
    prov: 'http://www.w3.org/ns/prov#',
    dcterms: 'http://purl.org/dc/terms/',
    rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',
  };
}

export async function buildVersionTurtle(input) {
  const quads = collectQuads(versionToQuads(input));
  return writeTurtle(quads, { prefixes: writerPrefixes() });
}

export async function buildVersionHistoryTurtle(input) {
  const quads = collectQuads(versionHistoryToQuads(input));
  return writeTurtle(quads, { prefixes: writerPrefixes() });
}
