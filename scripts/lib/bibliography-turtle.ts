// Bibliography turtle builder — emits dcterms:BibliographicResource
// per bibliography entry.
//
// Delegates to glossarist-js's bibliography emitter + writeTurtle.

import {
  bibliographyToQuads,
  normalizeBibliographyData,
  collectQuads,
  writeTurtle,
} from 'glossarist/rdf';

// No hardcoded default base URI — callers MUST pass it.

function writerPrefixes() {
  return {
    dcterms: 'http://purl.org/dc/terms/',
    foaf: 'http://xmlns.com/foaf/0.1/',
    gloss: 'https://www.glossarist.org/ontologies/',
  };
}

export { normalizeBibliographyData };

export async function buildBibliographyTurtle(register, bibliographyJson, baseUri) {
  if (!baseUri) throw new Error('buildBibliographyTurtle requires baseUri');
  const entries = normalizeBibliographyData(bibliographyJson);
  const quads = collectQuads(bibliographyToQuads({ registerId: register, entries, baseUri }));
  return writeTurtle(quads, { prefixes: writerPrefixes() });
}
