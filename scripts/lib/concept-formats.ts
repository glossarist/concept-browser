/**
 * Concept format emitters — Turtle, SKOS JSON-LD, TBX.
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

export function conceptJsonToSkosJsonLd(concept: Record<string, any>): string {
  const uri = concept['@id'] || '';
  const id = concept['gl:identifier'] || '';

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

  return JSON.stringify(doc);
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
