#!/usr/bin/env node
/**
 * Extract SKOS taxonomy data from concept-model TTL files into JSON
 * for browser consumption via the OntologyRegistry.
 *
 * Reads from:  data/concept-model/taxonomies/*.ttl  (vendored from glossarist/concept-model)
 * Writes to:   src/data/taxonomies.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TAXONOMY_DIR = resolve(ROOT, 'data', 'concept-model', 'taxonomies');
const OUTPUT = resolve(ROOT, 'src', 'data', 'taxonomies.json');

/**
 * Minimal Turtle parser for SKOS taxonomy files.
 * Handles the specific patterns used in our taxonomy TTL files:
 * - Subject blocks terminated by "."
 * - Predicate-object pairs separated by ";"
 * - Quoted strings with @lang tags
 * - Comma-separated objects
 */
function parseTurtle(text) {
  // Remove comments
  const cleaned = text.replace(/#[^\n]*/g, '');
  // Split into subject blocks (terminated by ".")
  const subjectBlocks = splitSubjects(cleaned);

  const concepts = {};
  let scheme = null;
  let schemeLabel = null;
  let schemeDefinition = null;

  for (const block of subjectBlocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Parse subject and type
    const subjectMatch = trimmed.match(/^([^\s]+)\s+a\s+(.+?)(?:\s*[;.,]|$)/s);
    if (!subjectMatch) continue;

    const subject = subjectMatch[1];
    const types = subjectMatch[2];

    const isScheme = /\bskos:ConceptScheme\b/.test(types);
    const isConcept = /\bskos:Concept\b/.test(types);

    if (isScheme) {
      scheme = subject;
      schemeLabel = findLiteral(trimmed, 'skos:prefLabel');
      schemeDefinition = findLiteral(trimmed, 'skos:definition');
    }

    if (isConcept && !isScheme) {
      const id = subject.includes('/') ? subject.split('/').pop() : subject;
      const prefLabel = findLiteral(trimmed, 'skos:prefLabel');
      const altLabel = findLiteral(trimmed, 'skos:altLabel');
      const definition = findLiteral(trimmed, 'skos:definition');
      const broader = findResource(trimmed, 'skos:broader');

      concepts[id] = {
        id,
        iri: subject,
        prefLabel: prefLabel || id,
        ...(altLabel && { altLabel }),
        ...(definition && { definition }),
        ...(broader && { broader }),
      };
    }
  }

  return { scheme, schemeLabel, schemeDefinition, concepts };
}

function splitSubjects(text) {
  const blocks = [];
  let depth = 0;
  let start = -1;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (ch === '"') {
      // Skip quoted strings
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i++;
        i++;
      }
      continue;
    }

    if (ch === '[') depth++;
    if (ch === ']') depth--;
    if (ch === '(') depth++;
    if (ch === ')') depth--;

    if (depth === 0 && ch === '.' && start >= 0) {
      blocks.push(text.slice(start, i));
      start = -1;
    } else if (start < 0 && ch === '\n') {
      // Skip blank lines
      const rest = text.slice(i).trimStart();
      if (rest && !rest.startsWith('#')) {
        start = i + 1;
      }
    } else if (start < 0 && /[^\s]/.test(ch)) {
      start = i;
    }
  }

  return blocks;
}

function findLiteral(block, predicate) {
  // Match: predicate "value"@lang or predicate """value"""@lang
  const tripleQuoted = new RegExp(predicate + '\\s+"""([^"]*?)"""@en');
  let m = block.match(tripleQuoted);
  if (m) return m[1].replace(/\s+/g, ' ').trim();

  const singleQuoted = new RegExp(predicate + '\\s+"([^"]*?)"@en');
  m = block.match(singleQuoted);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

function findResource(block, predicate) {
  const re = new RegExp(predicate + '\\s+([^\\s,;]+)');
  const m = block.match(re);
  if (!m) return null;
  const val = m[1].replace(/[;.]+$/, '');
  return val.includes('/') ? val.split('/').pop() : val;
}

const TAXONOMY_MAP = {
  'concept-status.ttl': 'conceptStatus',
  'entry-status.ttl': 'entryStatus',
  'normative-status.ttl': 'normativeStatus',
  'source-type.ttl': 'sourceType',
  'source-status.ttl': 'sourceStatus',
  'relationship-type.ttl': 'relationshipType',
  'designation-type.ttl': 'designationType',
  'term-type.ttl': 'termType',
  'grammar-gender.ttl': 'grammarGender',
  'grammar-number.ttl': 'grammarNumber',
};

function main() {
  if (!existsSync(TAXONOMY_DIR)) {
    console.error(`Taxonomy directory not found: ${TAXONOMY_DIR}`);
    console.error('Run `npm run sync:model` to vendor concept-model data.');
    process.exit(1);
  }

  const result = {};

  for (const [filename, key] of Object.entries(TAXONOMY_MAP)) {
    const filepath = join(TAXONOMY_DIR, filename);
    if (!existsSync(filepath)) {
      console.warn(`  Skipping ${filename} (not found)`);
      continue;
    }
    const text = readFileSync(filepath, 'utf-8');
    const parsed = parseTurtle(text);
    result[key] = {
      scheme: parsed.scheme,
      schemeLabel: parsed.schemeLabel,
      schemeDefinition: parsed.schemeDefinition,
      concepts: parsed.concepts,
    };
    const count = Object.keys(parsed.concepts).length;
    console.log(`  ${key}: ${count} concepts`);
  }

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(result, null, 2) + '\n');
  console.log(`\nWrote ${OUTPUT}`);
  console.log(`Total taxonomies: ${Object.keys(result).length}`);
}

main();
