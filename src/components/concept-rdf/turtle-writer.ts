import { RDF_PREFIXES } from './rdf-prefixes';
import type { RdfGraph, RdfResource, RdfTerm, RdfTriple } from './rdf-graph';

const INDENT = '  ';

const ABSOLUTE_SCHEMES = new Set(['http', 'https', 'urn', 'file', 'mailto', 'ftp']);

function isPrefixedName(s: string): boolean {
  const colonIdx = s.indexOf(':');
  if (colonIdx < 1) return false;
  const prefix = s.slice(0, colonIdx);
  if (!/^[A-Za-z][A-Za-z0-9._-]*$/.test(prefix)) return false;
  if (ABSOLUTE_SCHEMES.has(prefix)) return false;
  const local = s.slice(colonIdx + 1);
  return !local.startsWith('//');
}

function formatIri(value: string): string {
  if (!isPrefixedName(value)) return `<${value}>`;
  const colonIdx = value.indexOf(':');
  const prefix = value.slice(0, colonIdx + 1);
  const local = value.slice(colonIdx + 1);
  const escaped = local.replace(/([/])/g, '\\$1');
  return prefix + escaped;
}

export function writeTurtle(graph: RdfGraph): string {
  const lines: string[] = [];

  for (const p of RDF_PREFIXES) {
    lines.push(`@prefix ${p.prefix}: <${p.iri}> .`);
  }

  let first = true;
  for (const r of graph.resources()) {
    if (first) {
      lines.push('');
      first = false;
    } else {
      lines.push('');
    }
    writeResource(lines, r);
  }

  return lines.join('\n');
}

function writeResource(lines: string[], r: RdfResource): void {
  const subjectForm = formatSubject(r.subject);

  if (r.types.length === 0 && r.triples.length === 0) {
    lines.push(`${subjectForm} .`);
    return;
  }

  if (r.types.length === 0) {
    const [first, ...rest] = r.triples;
    lines.push(`${subjectForm} ${first.predicate} ${formatObject(first.object)} ;`);
    for (const t of rest) {
      lines.push(`${INDENT}${t.predicate} ${formatObject(t.object)} ;`);
    }
    const last = lines.length - 1;
    lines[last] = lines[last].replace(/ ;$/, ' .');
    return;
  }

  const head = `${subjectForm} a ${r.types.join(', ')}`;
  if (r.triples.length === 0) {
    lines.push(`${head} .`);
    return;
  }
  lines.push(`${head} ;`);
  for (const t of r.triples) {
    lines.push(`${INDENT}${t.predicate} ${formatObject(t.object)} ;`);
  }
  const last = lines.length - 1;
  lines[last] = lines[last].replace(/ ;$/, ' .');
}

function formatSubject(subject: string): string {
  return formatIri(subject);
}

function formatObject(term: RdfTerm): string {
  switch (term.kind) {
    case 'iri':
      return formatIri(term.value);
    case 'literal':
      return formatLiteral(term.value, term.lang, term.datatype);
    case 'blank':
      return formatBlankNode(term.triples);
  }
}

function formatLiteral(value: string, lang?: string, datatype?: string): string {
  const escaped = escapeLiteral(value);
  let s = `"${escaped}"`;
  if (lang) s += `@${lang}`;
  else if (datatype) s += `^^${datatype}`;
  return s;
}

function formatBlankNode(triples: readonly RdfTriple[]): string {
  if (triples.length === 0) return '[]';
  const parts = triples.map(t => `${t.predicate} ${formatObject(t.object)}`);
  return `[ ${parts.join(' ; ')} ]`;
}

function escapeLiteral(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}
