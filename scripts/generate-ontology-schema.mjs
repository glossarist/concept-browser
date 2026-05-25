#!/usr/bin/env node
/**
 * Parse the glossarist OWL ontology (TTL) into a structured JSON schema
 * for the Ontospy-style browser view.
 *
 * Reads:  ../concept-model/ontologies/glossarist.ttl
 * Writes: src/data/ontology-schema.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const ONTOLOGY_TTL = resolve(ROOT, '..', 'concept-model', 'ontologies', 'glossarist.ttl');
const OUTPUT = resolve(ROOT, 'src', 'data', 'ontology-schema.json');

const KNOWN_PREFIXES = {
  gloss: 'https://www.glossarist.org/ontologies/',
  owl: 'http://www.w3.org/2002/07/owl#',
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  xl: 'http://www.w3.org/2008/05/skos-xl#',
  'iso-thes': 'http://purl.org/iso25964/skos-thes#',
  dcterms: 'http://purl.org/dc/terms/',
  prov: 'http://www.w3.org/ns/prov#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
};

function expandPrefixed(term) {
  for (const [prefix, uri] of Object.entries(KNOWN_PREFIXES)) {
    if (term.startsWith(prefix + ':')) {
      return uri + term.slice(prefix.length + 1);
    }
  }
  return term;
}

function compactIri(iri) {
  for (const [prefix, uri] of Object.entries(KNOWN_PREFIXES)) {
    if (iri.startsWith(uri)) {
      return prefix + ':' + iri.slice(uri.length);
    }
  }
  return iri;
}

/**
 * Minimal TTL subject-block splitter. Handles nested [] and () and quoted strings.
 */
function splitSubjectBlocks(text) {
  const blocks = [];
  let depth = 0;
  let start = -1;
  let inTripleQuote = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inTripleQuote) {
      if (ch === '"' && text.slice(i, i + 3) === '"""') {
        inTripleQuote = false;
        i += 2;
      }
      continue;
    }

    if (ch === '"' && text.slice(i, i + 3) === '"""') {
      inTripleQuote = true;
      i += 2;
      continue;
    }

    if (ch === '"') {
      i++;
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\') i++;
        i++;
      }
      continue;
    }

    if (ch === '[' || ch === '(') depth++;
    if (ch === ']' || ch === ')') depth--;

    if (depth === 0 && ch === '.') {
      if (start >= 0) {
        blocks.push(text.slice(start, i));
        start = -1;
      }
    } else if (start < 0 && /\S/.test(ch)) {
      start = i;
    }
  }

  return blocks;
}

function extractLiteral(block, predicate) {
  const tripleQuoted = new RegExp(predicate + '\\s+"""([^]*?)"""@en');
  let m = block.match(tripleQuoted);
  if (m) return m[1].replace(/\s+/g, ' ').trim();

  const singleQuoted = new RegExp(predicate + '\\s+"([^"]*?)"@en');
  m = block.match(singleQuoted);
  if (m) return m[1];

  // Without @en
  const plain = new RegExp(predicate + '\\s+"""([^]*?)"""');
  m = block.match(plain);
  if (m) return m[1].replace(/\s+/g, ' ').trim();

  const plainSingle = new RegExp(predicate + '\\s+"([^"]*?)"');
  m = block.match(plainSingle);
  return m ? m[1] : null;
}

function extractResource(block, predicate) {
  const re = new RegExp(predicate + '\\s+([^\\s,;]+)');
  const m = block.match(re);
  if (!m) return null;
  let val = m[1].replace(/[;.]+$/, '');
  if (val === 'a') return null;
  return val;
}

function extractAllResources(block, predicate) {
  const results = [];
  const re = new RegExp(predicate + '\\s+', 'g');
  let match;
  while ((match = re.exec(block)) !== null) {
    const rest = block.slice(match.index + match[0].length).trimStart();
    // Read comma-separated resources until ; or .
    const tokens = rest.split(/[\s;.\n]+/)[0];
    if (tokens && tokens !== 'a') {
      results.push(tokens.replace(/[;,]+$/, ''));
    }
  }
  return [...new Set(results)];
}

function parseOntology(ttlText) {
  const rawLines = ttlText.split('\n');
  // Remove comment lines but keep content
  const cleaned = rawLines.map(l => l.replace(/#[^\n]*/g, '')).join('\n');

  const blocks = splitSubjectBlocks(cleaned);

  const classes = [];
  const properties = [];

  for (const block of blocks) {
    const trimmed = block.trim();
    if (!trimmed) continue;

    // Parse subject
    const subjectMatch = trimmed.match(/^([^\s]+)/);
    if (!subjectMatch) continue;
    const subject = subjectMatch[1];

    // Skip ontology declaration, prefix declarations
    if (subject === '@prefix' || subject.startsWith('@')) continue;
    if (subject.includes('glossarist>') && !subject.startsWith('gloss:')) continue;

    // Determine type
    const typeMatch = trimmed.match(/\ba\s+(.+?)(?:\s*[;.\n]|$)/);
    if (!typeMatch) continue;
    const typeStr = typeMatch[1];

    const isClass = /\bowl:Class\b/.test(typeStr);
    const isObjectProperty = /\bowl:ObjectProperty\b/.test(typeStr);
    const isDatatypeProperty = /\bowl:DatatypeProperty\b/.test(typeStr);

    if (!isClass && !isObjectProperty && !isDatatypeProperty) continue;

    const label = extractLiteral(trimmed, 'rdfs:label');
    const comment = extractLiteral(trimmed, 'rdfs:comment');
    const iri = expandPrefixed(subject);
    const compact = compactIri(iri);

    if (isClass) {
      const subClassOf = extractResource(trimmed, 'rdfs:subClassOf');
      const disjointWith = extractResource(trimmed, 'owl:disjointWith');

      classes.push({
        iri,
        compact,
        label: label || subject.replace('gloss:', ''),
        comment,
        subClassOf: subClassOf ? compactIri(expandPrefixed(subClassOf)) : null,
        disjointWith: disjointWith ? compactIri(expandPrefixed(disjointWith)) : null,
      });
    } else {
      const domain = extractResource(trimmed, 'rdfs:domain');
      const range = extractResource(trimmed, 'rdfs:range');
      const inverseOf = extractResource(trimmed, 'owl:inverseOf');

      // For unionOf domains/ranges, detect the bracket pattern
      // rdfs:domain [ a owl:Class ; owl:unionOf ( gloss:A gloss:B ) ] ;
      let domainUnion = null;
      let rangeUnion = null;

      const unionDomainMatch = trimmed.match(/rdfs:domain\s+\[\s*a\s+owl:Class\s*;\s*owl:unionOf\s*\(([^)]+)\)\s*\]/);
      if (unionDomainMatch) {
        domainUnion = unionDomainMatch[1].trim().split(/\s+/).map(t => compactIri(expandPrefixed(t)));
      }

      const unionRangeMatch = trimmed.match(/rdfs:range\s+\[\s*a\s+owl:Class\s*;\s*owl:unionOf\s*\(([^)]+)\)\s*\]/);
      if (unionRangeMatch) {
        rangeUnion = unionRangeMatch[1].trim().split(/\s+/).map(t => compactIri(expandPrefixed(t)));
      }

      properties.push({
        iri,
        compact,
        label: label || subject.replace('gloss:', ''),
        comment,
        type: isObjectProperty ? 'object' : 'datatype',
        domain: domain ? compactIri(expandPrefixed(domain)) : null,
        domainUnion: domainUnion,
        range: range ? compactIri(expandPrefixed(range)) : null,
        rangeUnion: rangeUnion,
        inverseOf: inverseOf ? compactIri(expandPrefixed(inverseOf)) : null,
      });
    }
  }

  return { classes, properties };
}

function buildClassHierarchy(classes) {
  const map = new Map();
  for (const c of classes) {
    map.set(c.compact, c);
    c.children = [];
    c.ancestors = [];
  }

  // Build children
  for (const c of classes) {
    if (c.subClassOf && map.has(c.subClassOf)) {
      map.get(c.subClassOf).children.push(c.compact);
    }
  }

  // Build ancestor chains
  for (const c of classes) {
    const chain = [];
    let current = c.subClassOf;
    while (current && map.has(current)) {
      chain.push(current);
      current = map.get(current).subClassOf;
    }
    // Add non-glossarist ancestors
    if (current) chain.push(current);
    c.ancestors = chain;
  }

  // Find roots (no subClassOf or subClassOf points outside our ontology)
  const roots = classes
    .filter(c => !c.subClassOf || !map.has(c.subClassOf))
    .map(c => c.compact);

  return { roots, map: Object.fromEntries(map) };
}

function groupPropertiesByDomain(properties) {
  const groups = {};
  for (const p of properties) {
    const domains = p.domainUnion || (p.domain ? [p.domain] : ['(unspecified)']);
    for (const d of domains) {
      if (!groups[d]) groups[d] = { object: [], datatype: [] };
      groups[d][p.type].push(p.compact);
    }
  }
  return groups;
}

function main() {
  if (!existsSync(ONTOLOGY_TTL)) {
    console.error(`Ontology file not found: ${ONTOLOGY_TTL}`);
    console.error('Ensure concept-model is available at ../concept-model/');
    process.exit(1);
  }

  const ttlText = readFileSync(ONTOLOGY_TTL, 'utf-8');
  const { classes, properties } = parseOntology(ttlText);

  const hierarchy = buildClassHierarchy(classes);
  const propsByDomain = groupPropertiesByDomain(properties);

  const output = {
    ontologyIri: 'https://www.glossarist.org/ontologies/glossarist',
    ontologyLabel: 'Glossarist Ontology',
    classes: hierarchy.map,
    classHierarchyRoots: hierarchy.roots,
    properties: Object.fromEntries(properties.map(p => [p.compact, p])),
    propertiesByDomain: propsByDomain,
    stats: {
      classCount: classes.length,
      objectPropertyCount: properties.filter(p => p.type === 'object').length,
      datatypePropertyCount: properties.filter(p => p.type === 'datatype').length,
    },
  };

  mkdirSync(dirname(OUTPUT), { recursive: true });
  writeFileSync(OUTPUT, JSON.stringify(output, null, 2) + '\n');

  console.log(`Parsed ${output.stats.classCount} classes, ${output.stats.objectPropertyCount} object properties, ${output.stats.datatypePropertyCount} datatype properties`);
  console.log(`Wrote ${OUTPUT}`);
}

main();
