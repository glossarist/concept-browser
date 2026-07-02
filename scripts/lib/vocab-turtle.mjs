import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VOCAB_PATH = join(__dirname, '..', '..', 'data', 'glossarist-vocab.json');

function loadVocab(path = VOCAB_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

function ttlLit(s) {
  if (s == null) return '""';
  const escaped = String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    .replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

function ttlPrefixed(qname) {
  const colonIdx = qname.indexOf(':');
  if (colonIdx < 0) return qname;
  const local = qname.slice(colonIdx + 1);
  const escaped = local.replace(/([/])/g, '\\$1');
  return `${qname.slice(0, colonIdx + 1)}${escaped}`;
}

export function buildVocabularyTurtle() {
  const vocab = loadVocab();
  const lines = [
    '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .',
    '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .',
    '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .',
    '@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .',
    '@prefix dcterms: <http://purl.org/dc/terms/> .',
    '@prefix gloss: <https://www.glossarist.org/ontologies/> .',
    '',
  ];

  for (const scheme of vocab.schemes) {
    const schemeLines = [
      `${ttlPrefixed(scheme.schemeIri)} a skos:ConceptScheme ;`,
      `  rdfs:label ${ttlLit(scheme.label)} ;`,
    ];
    for (const term of scheme.terms) {
      schemeLines.push(`  skos:hasTopConcept ${ttlPrefixed(term.iri)} ;`);
    }
    schemeLines[schemeLines.length - 1] = schemeLines[schemeLines.length - 1].replace(/ ;$/, ' .');
    lines.push(...schemeLines);

    for (const term of scheme.terms) {
      lines.push(`${ttlPrefixed(term.iri)} a skos:Concept ;`);
      lines.push(`  rdfs:label ${ttlLit(term.label)} ;`);
      lines.push(`  skos:inScheme ${ttlPrefixed(scheme.schemeIri)} .`);
      lines.push('');
    }
    lines.push('');
  }

  return lines.join('\n') + '\n';
}

export function listVocabSchemes() {
  return loadVocab().schemes;
}
