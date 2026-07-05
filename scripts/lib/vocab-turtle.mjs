// Vocab turtle builder — emits SKOS ConceptSchemes for the
// glossarist enumeration IRIs.
//
// Delegates to glossarist-js's vocabulary emitter + writeTurtle so the
// canonical prefix list, CURIE handling, and serialization stay in one
// place. The output is byte-equivalent in semantics ( CURIEs resolved
// to absolute IRIs, then re-rendered via glossarist-js's n3 writer with
// the canonical prefix map ).

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  vocabularyToQuads,
  collectQuads,
  writeTurtle,
  PREFIXES,
} from 'glossarist/rdf';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VOCAB_PATH = join(__dirname, '..', '..', 'data', 'glossarist-vocab.json');

function loadVocab(path = VOCAB_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// n3's writer prefixes must omit the trailing # or / — those go in
// the local name. Build the prefix-only map for writeTurtle.
function writerPrefixes() {
  const out = {};
  for (const [k, v] of Object.entries(PREFIXES)) {
    out[k] = v;
  }
  return out;
}

export async function buildVocabularyTurtle() {
  const vocab = loadVocab();
  const quads = collectQuads(vocabularyToQuads(vocab.schemes));
  return writeTurtle(quads, { prefixes: writerPrefixes() });
}

export function listVocabSchemes() {
  return loadVocab().schemes;
}
