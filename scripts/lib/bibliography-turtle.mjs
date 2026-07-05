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

const DEFAULT_BASE_URI = 'https://glossarist.org';

function writerPrefixes() {
  return {
    dcterms: 'http://purl.org/dc/terms/',
    foaf: 'http://xmlns.com/foaf/0.1/',
    gloss: 'https://www.glossarist.org/ontologies/',
  };
}

export { normalizeBibliographyData };

export async function buildBibliographyTurtle(register, bibliographyJson, baseUri = DEFAULT_BASE_URI) {
  const entries = normalizeBibliographyData(bibliographyJson);
  const quads = collectQuads(bibliographyToQuads({ registerId: register, entries, baseUri }));
  return writeTurtle(quads, { prefixes: writerPrefixes() });
}
