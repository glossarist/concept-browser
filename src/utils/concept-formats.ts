import type { ConceptDocument, LocalizedConcept } from '../adapters/types';

export interface FormatDescriptor {
  extension: string;
  label: string;
  mediaType: string;
}

export const FORMAT_REGISTRY: Record<string, FormatDescriptor> = {
  ttl: { extension: 'ttl', label: 'Turtle RDF', mediaType: 'text/turtle' },
  jsonld: { extension: 'jsonld', label: 'JSON-LD', mediaType: 'application/ld+json' },
  tbx: { extension: 'tbx', label: 'TBX-XML', mediaType: 'application/xml' },
  yaml: { extension: 'yaml', label: 'YAML', mediaType: 'text/yaml' },
};

function getLocalizedData(concept: ConceptDocument) {
  const result: Record<string, {
    prefLabels: string[];
    altLabels: string[];
    definitions: string[];
    notes: string[];
  }> = {};

  for (const [lang, lc] of Object.entries(concept['gl:localizedConcept'] || {})) {
    const descs = lc['gl:designation'] || [];
    const prefLabels = descs
      .filter(d => d['gl:normativeStatus'] === 'preferred' && d['gl:term'])
      .map(d => d['gl:term']!);
    const altLabels = descs
      .filter(d => d['gl:normativeStatus'] !== 'preferred' && d['gl:term'])
      .map(d => d['gl:term']!);
    const definitions = (lc['gl:definition'] || [])
      .map(d => d['gl:content'] || '')
      .filter(Boolean);
    const notes = (lc['gl:notes'] || [])
      .map(d => d['gl:content'] || '')
      .filter(Boolean);

    if (prefLabels.length || definitions.length) {
      result[lang] = { prefLabels, altLabels, definitions, notes };
    }
  }

  return result;
}

function escapeTurtle(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

export function conceptToTurtle(concept: ConceptDocument): string {
  const uri = concept['@id'] || '';
  const id = concept['gl:identifier'] || '';
  const data = getLocalizedData(concept);

  const lines: string[] = [
    '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .',
    '@prefix dcterms: <http://purl.org/dc/terms/> .',
    '',
  ];

  const props: string[] = ['a skos:Concept'];
  props.push(`  skos:notation "${escapeTurtle(id)}"`);

  for (const [lang, d] of Object.entries(data)) {
    for (const label of d.prefLabels) {
      props.push(`  skos:prefLabel "${escapeTurtle(label)}"@${lang}`);
    }
    for (const label of d.altLabels) {
      props.push(`  skos:altLabel "${escapeTurtle(label)}"@${lang}`);
    }
    for (const def of d.definitions) {
      props.push(`  skos:definition "${escapeTurtle(def)}"@${lang}`);
    }
    for (const note of d.notes) {
      props.push(`  skos:scopeNote "${escapeTurtle(note)}"@${lang}`);
    }
  }

  lines.push(`<${uri}>`);
  lines.push(props.join(' ;\n'));
  lines.push(' .');

  return lines.join('\n');
}

export function conceptToSkosJsonLd(concept: ConceptDocument): string {
  const uri = concept['@id'] || '';
  const id = concept['gl:identifier'] || '';
  const data = getLocalizedData(concept);

  const doc: Record<string, any> = {
    '@context': {
      skos: 'http://www.w3.org/2004/02/skos/core#',
      dcterms: 'http://purl.org/dc/terms/',
      '@language': { '@container': '@language' },
    },
    '@id': uri,
    '@type': 'skos:Concept',
    'skos:notation': id,
  };

  const prefLabels: Record<string, string> = {};
  const altLabels: Record<string, string> = {};
  const definitions: Record<string, string> = {};
  const scopeNotes: Record<string, string> = {};

  for (const [lang, d] of Object.entries(data)) {
    if (d.prefLabels[0]) prefLabels[lang] = d.prefLabels[0];
    if (d.altLabels[0]) altLabels[lang] = d.altLabels[0];
    if (d.definitions[0]) definitions[lang] = d.definitions[0];
    if (d.notes[0]) scopeNotes[lang] = d.notes[0];
  }

  if (Object.keys(prefLabels).length) doc['skos:prefLabel'] = prefLabels;
  if (Object.keys(altLabels).length) doc['skos:altLabel'] = altLabels;
  if (Object.keys(definitions).length) doc['skos:definition'] = definitions;
  if (Object.keys(scopeNotes).length) doc['skos:scopeNote'] = scopeNotes;

  return JSON.stringify(doc, null, 2);
}
