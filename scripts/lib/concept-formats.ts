/**
 * Concept format emitters — Turtle, SKOS JSON-LD, TBX, aggregate CSV.
 *
 * Extracted from generate-data.ts. Each function takes a JSON-LD concept
 * object and serializes it to a different interchange format.
 */

import { ttlLit } from './turtle-escape';

export function escapeTurtle(s: string): string {
  return ttlLit(s).slice(1, -1);
}

export function escapeXml(s: any): string {
  const str = Array.isArray(s) ? s.join(', ') : String(s ?? '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function conceptJsonToTurtle(concept: Record<string, any>): string {
  const uri = concept['@id'] || '';
  const id = concept['gl:identifier'] || '';
  const lines = [
    '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .',
    '@prefix dcterms: <http://purl.org/dc/terms/> .',
    '',
  ];

  const props = ['  a skos:Concept'];
  props.push(`  skos:notation "${escapeTurtle(id)}"`);

  for (const [lang, lc] of Object.entries(concept['gl:localizedConcept'] || {}) as [string, any][]) {
    if (lc['gl:designation']) {
      for (const d of lc['gl:designation']) {
        const term = d['gl:term'];
        if (!term) continue;
        const pred = d['gl:normativeStatus'] === 'preferred' ? 'skos:prefLabel' : 'skos:altLabel';
        props.push(`  ${pred} "${escapeTurtle(term)}"@${lang}`);
      }
    }
    if (lc['gl:definition']) {
      for (const d of lc['gl:definition']) {
        if (d['gl:content']) props.push(`  skos:definition "${escapeTurtle(d['gl:content'])}"@${lang}`);
      }
    }
    if (lc['gl:notes']) {
      for (const d of lc['gl:notes']) {
        if (d['gl:content']) props.push(`  skos:scopeNote "${escapeTurtle(d['gl:content'])}"@${lang}`);
      }
    }
  }

  lines.push(`<${uri}>`);
  lines.push(props.join(' ;\n'));
  lines.push(' .');
  return lines.join('\n');
}

const SKOS_JSON_LD_CONTEXT = {
  skos: 'http://www.w3.org/2004/02/skos/core#',
  dcterms: 'http://purl.org/dc/terms/',
  '@language': { '@container': '@language' },
};

function buildSkosJsonLdObject(concept: Record<string, any>): Record<string, any> {
  const uri = concept['@id'] || '';
  const id = concept['gl:identifier'] || '';

  const doc: Record<string, any> = {
    '@id': uri,
    '@type': 'skos:Concept',
    'skos:notation': id,
  };

  const prefLabels: Record<string, string> = {};
  const altLabels: Record<string, string> = {};
  const definitions: Record<string, string> = {};
  const scopeNotes: Record<string, string> = {};
  for (const [lang, lc] of Object.entries(concept['gl:localizedConcept'] || {}) as [string, any][]) {
    const descs = lc['gl:designation'] || [];
    const pref = descs.find((d: any) => d['gl:normativeStatus'] === 'preferred' && d['gl:term']);
    const alt = descs.find((d: any) => d['gl:normativeStatus'] !== 'preferred' && d['gl:term']);
    if (pref) prefLabels[lang] = pref['gl:term'];
    if (alt) altLabels[lang] = alt['gl:term'];
    const def = (lc['gl:definition'] || [])[0];
    if (def?.['gl:content']) definitions[lang] = def['gl:content'];
    const note = (lc['gl:notes'] || [])[0];
    if (note?.['gl:content']) scopeNotes[lang] = note['gl:content'];
  }

  if (Object.keys(prefLabels).length) doc['skos:prefLabel'] = prefLabels;
  if (Object.keys(altLabels).length) doc['skos:altLabel'] = altLabels;
  if (Object.keys(definitions).length) doc['skos:definition'] = definitions;
  if (Object.keys(scopeNotes).length) doc['skos:scopeNote'] = scopeNotes;

  return doc;
}

export function conceptJsonToSkosJsonLd(concept: Record<string, any>): string {
  return JSON.stringify({
    '@context': SKOS_JSON_LD_CONTEXT,
    ...buildSkosJsonLdObject(concept),
  });
}

export function conceptsToSkosJsonLdGraph(concepts: Record<string, any>[]): string {
  return JSON.stringify(
    {
      '@context': SKOS_JSON_LD_CONTEXT,
      '@graph': concepts.map(buildSkosJsonLdObject),
    },
    null,
    2,
  );
}

export const CSV_COLUMNS = [
  'termid',
  'uri',
  'status',
  'section',
  'language',
  'term',
  'alt_terms',
  'definition',
  'notes',
  'examples',
  'sources',
  'source_links',
] as const;

function csvEscape(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function joinLines(items: string[]): string {
  return items.filter(Boolean).join('\n');
}

function localizedLanguages(localized: Record<string, any>, languageOrder?: string[]): string[] {
  const present = Object.keys(localized);
  if (!languageOrder?.length) return present;
  const ordered = languageOrder.filter(lang => present.includes(lang));
  return ordered.concat(present.filter(lang => !ordered.includes(lang)));
}

function sourceRefString(src: Record<string, any>): string {
  const ref = src?.['gl:origin']?.['gl:ref'];
  if (!ref) return '';
  return [ref['gl:source'], ref['gl:id']].filter(Boolean).join(': ');
}

function sourceLinkString(src: Record<string, any>): string {
  return src?.['gl:origin']?.['gl:link'] || '';
}

/**
 * Aggregate CSV export: one row per (concept × language). Columns follow the
 * Glossarist concept-model fields. UTF-8 BOM + CRLF so Excel opens the file
 * with correct encoding without an import wizard.
 */
export function conceptsToCsv(
  concepts: Record<string, any>[],
  opts: { languageOrder?: string[] } = {},
): string {
  const rows: string[] = [CSV_COLUMNS.join(',')];

  for (const concept of concepts) {
    const localized = concept['gl:localizedConcept'] || {};
    const domains = (concept['gl:domain'] || [])
      .map((d: any) => d['gl:conceptId'])
      .filter(Boolean)
      .join('; ');
    const managedSources = concept['gl:source'] || [];
    const shared = {
      termid: concept['gl:identifier'] || '',
      uri: concept['@id'] || '',
      status: concept['gl:status'] || '',
      section: domains,
    };

    const languages = localizedLanguages(localized, opts.languageOrder);
    if (languages.length === 0) {
      rows.push([shared.termid, shared.uri, shared.status, shared.section, '', '', '', '', '', '', '', ''].map(csvEscape).join(','));
      continue;
    }

    for (const lang of languages) {
      const lc = localized[lang] || {};
      const designations = (lc['gl:designation'] || []).filter((d: any) => d['gl:term']);
      const preferred = designations.find((d: any) => d['gl:normativeStatus'] === 'preferred') || designations[0];
      const altTerms = designations.filter((d: any) => d !== preferred).map((d: any) => d['gl:term']);
      const localizedSources = lc['gl:source']?.length ? lc['gl:source'] : managedSources;

      rows.push([
        shared.termid,
        shared.uri,
        shared.status,
        shared.section,
        lang,
        preferred?.['gl:term'] || '',
        altTerms.join('; '),
        joinLines((lc['gl:definition'] || []).map((d: any) => d['gl:content'])),
        joinLines((lc['gl:notes'] || []).map((d: any) => d['gl:content'])),
        joinLines((lc['gl:examples'] || []).map((d: any) => d['gl:content'])),
        localizedSources.map(sourceRefString).filter(Boolean).join('; '),
        localizedSources.map(sourceLinkString).filter(Boolean).join('; '),
      ].map(csvEscape).join(','));
    }
  }

  return '\uFEFF' + rows.join('\r\n') + '\r\n';
}

export function conceptJsonToTbx(concept: Record<string, any>): string {
  const id = concept['gl:identifier'] || '';
  const uri = concept['@id'] || '';
  const localized = concept['gl:localizedConcept'] || {};

  const langSections: { lang: string; termEntries: string[]; blocks: string }[] = [];
  for (const [lang, lc] of Object.entries(localized) as [string, any][]) {
    const descs = lc['gl:designation'] || [];
    const definitions = (lc['gl:definition'] || []).filter((d: any) => d['gl:content']);
    const notes = (lc['gl:notes'] || []).filter((d: any) => d['gl:content']);
    const examples = (lc['gl:examples'] || []).filter((d: any) => d['gl:content']);
    const sources = lc['gl:source'] || [];
    const entryStatus = lc['gl:entryStatus'] || '';

    if (!descs.length && !definitions.length) continue;

    const termEntries: string[] = [];
    for (const d of descs) {
      const term = d['gl:term'];
      if (!term) continue;
      const status = d['gl:normativeStatus'] || '';
      const type = d['@type'] || '';
      let gramGrp = '';
      if (d['gl:grammarInfo'] && d['gl:grammarInfo'].length > 0) {
        const gi = d['gl:grammarInfo'][0];
        if (gi['gl:gender']) gramGrp = `\n            <grammaticalGender>${escapeXml(gi['gl:gender'])}</grammaticalGender>`;
        if (gi['gl:number']) gramGrp += `\n            <grammaticalNumber>${escapeXml(gi['gl:number'])}</grammaticalNumber>`;
        for (const pos of ['noun', 'verb', 'adj', 'adverb', 'preposition', 'participle']) {
          if (gi[`gl:${pos}`]) gramGrp += `\n            <partOfSpeech>${pos}</partOfSpeech>`;
        }
      }
      let posBlock = '';
      if (type.includes('Abbreviation')) posBlock = '\n            <partOfSpeech>abbreviation</partOfSpeech>';
      if (type.includes('Symbol')) posBlock = '\n            <partOfSpeech>symbol</partOfSpeech>';

      termEntries.push(`          <termEntry>
            <langSet xml:lang="${lang}">
              <tig>
                <term>${escapeXml(term)}</term>${gramGrp}${posBlock}
              </tig>
            </langSet>
          </termEntry>`);
    }

    let defBlock = '';
    if (definitions.length) {
      const defParts = definitions.map((d: any) => `            <p>${escapeXml(d['gl:content'])}</p>`).join('\n');
      defBlock = `\n          <descrip type="definition">\n${defParts}\n          </descrip>`;
    }

    let noteBlock = '';
    for (let i = 0; i < notes.length; i++) {
      noteBlock += `\n          <note type="note">${escapeXml(notes[i]['gl:content'])}</note>`;
    }
    for (let i = 0; i < examples.length; i++) {
      noteBlock += `\n          <note type="example">${escapeXml(examples[i]['gl:content'])}</note>`;
    }

    let sourceBlock = '';
    for (const src of sources) {
      const origin = src['gl:origin'] || {};
      const parts: string[] = [];
      const ref = origin['gl:ref'];
      if (ref) {
        const refParts: string[] = [];
        if (ref['gl:source']) refParts.push(ref['gl:source']);
        if (ref['gl:id']) refParts.push(ref['gl:id']);
        parts.push(refParts.join(' ') || '');
      }
      if (origin['gl:locality']) {
        const loc = origin['gl:locality'];
        if (loc['gl:referenceFrom']) parts.push(loc['gl:localityType'] ? `${loc['gl:localityType']} ${loc['gl:referenceFrom']}` : loc['gl:referenceFrom']);
      }
      if (parts.filter(Boolean).length) {
        sourceBlock += `\n          <ref>${escapeXml(parts.filter(Boolean).join(', '))}</ref>`;
      }
    }

    let statusBlock = '';
    if (entryStatus) {
      statusBlock += `\n          <descrip type="entryStatus">${escapeXml(entryStatus)}</descrip>`;
    }

    const termEntriesBlock = termEntries.length ? '\n' + termEntries.join('\n') : '';
    langSections.push({ lang, termEntries, blocks: [defBlock, noteBlock, sourceBlock, statusBlock].filter(b => b).join('') });
  }

  if (!langSections.length) return '';

  const bodyEntries = langSections.map(ls => {
    return `      <languageSection xml:lang="${ls.lang}">${ls.blocks}\n      </languageSection>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<tbx style="dca" type="TBX-Basic" xml:lang="en" xmlns="urn:iso:std:iso:30042:ed-2">
  <tbxHeader>
    <fileDesc>
      <source>${escapeXml(uri)}</source>
    </fileDesc>
  </tbxHeader>
  <text>
    <body>
      <conceptEntry id="${escapeXml(id)}">
${bodyEntries}
      </conceptEntry>
    </body>
  </text>
</tbx>
`;
}
