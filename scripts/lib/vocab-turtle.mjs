const PREFIXES = [
  ['skos',    'http://www.w3.org/2004/02/skos/core#'],
  ['rdf',     'http://www.w3.org/1999/02/22-rdf-syntax-ns#'],
  ['rdfs',    'http://www.w3.org/2000/01/rdf-schema#'],
  ['xsd',     'http://www.w3.org/2001/XMLSchema#'],
  ['dcterms', 'http://purl.org/dc/terms/'],
  ['gloss',   'https://www.glossarist.org/ontologies/'],
];

function ttlLit(s) {
  if (s == null) return '""';
  const escaped = String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${escaped}"`;
}

function ttlPrefixed(qname) {
  const colonIdx = qname.indexOf(':');
  if (colonIdx < 0) return qname;
  const local = qname.slice(colonIdx + 1);
  const escaped = local.replace(/([/])/g, '\\$1');
  return `${qname.slice(0, colonIdx + 1)}${escaped}`;
}

const VOCAB_SCHEMES = [
  {
    schemeIri: 'gloss:status-scheme',
    label: 'Concept status',
    terms: [
      { iri: 'gloss:status/valid',      label: 'valid' },
      { iri: 'gloss:status/superseded', label: 'superseded' },
      { iri: 'gloss:status/withdrawn',  label: 'withdrawn' },
      { iri: 'gloss:status/draft',      label: 'draft' },
    ],
  },
  {
    schemeIri: 'gloss:entstatus-scheme',
    label: 'Entry status',
    terms: [
      { iri: 'gloss:entstatus/valid',      label: 'valid' },
      { iri: 'gloss:entstatus/superseded', label: 'superseded' },
      { iri: 'gloss:entstatus/withdrawn',  label: 'withdrawn' },
      { iri: 'gloss:entstatus/draft',      label: 'draft' },
    ],
  },
  {
    schemeIri: 'gloss:norm-scheme',
    label: 'Normative status',
    terms: [
      { iri: 'gloss:norm/preferred',  label: 'preferred' },
      { iri: 'gloss:norm/admitted',   label: 'admitted' },
      { iri: 'gloss:norm/deprecated', label: 'deprecated' },
    ],
  },
  {
    schemeIri: 'gloss:srcstatus-scheme',
    label: 'Source status',
    terms: [
      { iri: 'gloss:srcstatus/identical', label: 'identical' },
      { iri: 'gloss:srcstatus/restyled',  label: 'restyled' },
      { iri: 'gloss:srcstatus/modified',  label: 'modified' },
      { iri: 'gloss:srcstatus/adapted',   label: 'adapted' },
    ],
  },
  {
    schemeIri: 'gloss:srctype-scheme',
    label: 'Source type',
    terms: [
      { iri: 'gloss:srctype/authoritative', label: 'authoritative' },
      { iri: 'gloss:srctype/lineage',       label: 'lineage' },
    ],
  },
  {
    schemeIri: 'gloss:datetype-scheme',
    label: 'Date type',
    terms: [
      { iri: 'gloss:datetype/accepted', label: 'accepted' },
      { iri: 'gloss:datetype/amended',  label: 'amended' },
      { iri: 'gloss:datetype/retired',  label: 'retired' },
    ],
  },
  {
    schemeIri: 'gloss:rel-scheme',
    label: 'Relationship type',
    terms: [
      { iri: 'gloss:rel/supersedes',    label: 'supersedes' },
      { iri: 'gloss:rel/superseded_by', label: 'superseded_by' },
      { iri: 'gloss:rel/derived',       label: 'derived' },
      { iri: 'gloss:rel/compare',       label: 'compare' },
      { iri: 'gloss:rel/contrast',      label: 'contrast' },
      { iri: 'gloss:rel/see',           label: 'see' },
    ],
  },
];

export function buildVocabularyTurtle() {
  const lines = [];
  for (const [prefix, iri] of PREFIXES) {
    lines.push(`@prefix ${prefix}: <${iri}> .`);
  }
  lines.push('');

  for (const scheme of VOCAB_SCHEMES) {
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
  return VOCAB_SCHEMES;
}
