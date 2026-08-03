// Vocab turtle builder — emits SKOS ConceptSchemes for the
// glossarist enumeration IRIs.
//
// Delegates to glossarist-js's vocabulary emitter + writeTurtle so the
// canonical prefix list, CURIE handling, and serialization stay in one
// place. The output is byte-equivalent in semantics ( CURIEs resolved
// to absolute IRIs, then re-rendered via glossarist-js's n3 writer with
// the canonical prefix map ).

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  vocabularyToQuads,
  collectQuads,
  writeTurtle,
  PREFIXES,
} from 'glossarist/rdf';

const __dirname = dirname(fileURLToPath(import.meta.url));

// When running from source (tsx), this file is at scripts/lib/ and
// the data dir is two levels up. When bundled by esbuild into
// scripts/*.js, __dirname is scripts/ and the data dir is one level up.
function findVocabPath(): string {
  const candidates = [
    join(__dirname, '..', '..', 'data', 'glossarist-vocab.json'),
    join(__dirname, '..', 'data', 'glossarist-vocab.json'),
  ];
  for (const p of candidates) {
    if (existsSync(p)) return p;
  }
  throw new Error(
    `glossarist-vocab.json not found. Tried:\n${candidates.map(p => '  ' + p).join('\n')}`,
  );
}

function loadVocab() {
  return JSON.parse(readFileSync(findVocabPath(), 'utf8'));
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
