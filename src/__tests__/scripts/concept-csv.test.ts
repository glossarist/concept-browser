import { describe, it, expect } from 'vitest';
import { conceptsToCsv, conceptsToSkosJsonLdGraph, CSV_COLUMNS } from '../../../scripts/lib/concept-formats';

function parseCsv(csv: string): string[][] {
  const body = csv.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (quoted) {
      if (ch === '"') {
        if (body[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ',') {
      row.push(field); field = '';
    } else if (ch === '\r' && body[i + 1] === '\n') {
      row.push(field); rows.push(row); row = []; field = ''; i++;
    } else {
      field += ch;
    }
  }
  return rows;
}

const baseConcept = {
  '@id': 'https://example.com/vocab/concept/1-1-010',
  'gl:identifier': '1-1-010',
  'gl:status': 'valid',
  'gl:domain': [{ 'gl:conceptId': 'section-1' }],
  'gl:source': [{
    'gl:sourceType': 'authoritative',
    'gl:origin': { 'gl:ref': { 'gl:source': 'IALA Dictionary' }, 'gl:link': 'https://example.com/source' },
  }],
  'gl:localizedConcept': {
    eng: {
      'gl:designation': [
        { 'gl:normativeStatus': 'preferred', 'gl:term': 'Buoyage and beaconage' },
        { 'gl:normativeStatus': 'admitted', 'gl:term': 'Sea-marking (G.B.)' },
      ],
      'gl:definition': [{ 'gl:content': 'Ensemble of beacons, buoys, seamarks and small lights.' }],
      'gl:notes': [{ 'gl:content': 'Note one.' }, { 'gl:content': 'Note two.' }],
    },
    fra: {
      'gl:designation': [{ 'gl:normativeStatus': 'preferred', 'gl:term': 'Balisage' }],
      'gl:definition': [{ 'gl:content': 'Ensemble de balises.' }],
    },
  },
};

describe('conceptsToCsv', () => {
  it('emits UTF-8 BOM, CRLF line endings, and the model-driven header', () => {
    const csv = conceptsToCsv([baseConcept]);
    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    expect(csv).toContain('\r\n');
    const rows = parseCsv(csv);
    expect(rows[0]).toEqual([...CSV_COLUMNS]);
  });

  it('emits one row per concept and language', () => {
    const rows = parseCsv(conceptsToCsv([baseConcept]));
    expect(rows).toHaveLength(3);
    expect(rows[1][CSV_COLUMNS.indexOf('termid')]).toBe('1-1-010');
    expect(rows[1][CSV_COLUMNS.indexOf('language')]).toBe('eng');
    expect(rows[2][CSV_COLUMNS.indexOf('language')]).toBe('fra');
  });

  it('honors languageOrder from the deployment config', () => {
    const rows = parseCsv(conceptsToCsv([baseConcept], { languageOrder: ['fra', 'eng'] }));
    expect(rows[1][CSV_COLUMNS.indexOf('language')]).toBe('fra');
    expect(rows[2][CSV_COLUMNS.indexOf('language')]).toBe('eng');
  });

  it('keeps languages missing from languageOrder at the end', () => {
    const rows = parseCsv(conceptsToCsv([baseConcept], { languageOrder: ['deu', 'eng'] }));
    expect(rows.slice(1).map(r => r[CSV_COLUMNS.indexOf('language')])).toEqual(['eng', 'fra']);
  });

  it('separates the preferred term from alt terms', () => {
    const rows = parseCsv(conceptsToCsv([baseConcept]));
    const eng = rows[1];
    expect(eng[CSV_COLUMNS.indexOf('term')]).toBe('Buoyage and beaconage');
    expect(eng[CSV_COLUMNS.indexOf('alt_terms')]).toBe('Sea-marking (G.B.)');
  });

  it('joins multi-entry notes with a newline inside a quoted cell', () => {
    const rows = parseCsv(conceptsToCsv([baseConcept]));
    expect(rows[1][CSV_COLUMNS.indexOf('notes')]).toBe('Note one.\nNote two.');
  });

  it('escapes quotes and commas per RFC 4180', () => {
    const concept = JSON.parse(JSON.stringify(baseConcept));
    concept['gl:localizedConcept'].eng['gl:definition'] = [{ 'gl:content': 'Says "hello", loudly' }];
    const csv = conceptsToCsv([concept]);
    expect(csv).toContain('"Says ""hello"", loudly"');
    expect(parseCsv(csv)[1][CSV_COLUMNS.indexOf('definition')]).toBe('Says "hello", loudly');
  });

  it('falls back to managed sources when the localization has none', () => {
    const rows = parseCsv(conceptsToCsv([baseConcept]));
    for (const row of rows.slice(1)) {
      expect(row[CSV_COLUMNS.indexOf('sources')]).toBe('IALA Dictionary');
      expect(row[CSV_COLUMNS.indexOf('source_links')]).toBe('https://example.com/source');
    }
  });

  it('still emits a row for concepts with no localizations', () => {
    const bare = {
      '@id': 'https://example.com/vocab/concept/9-9-999',
      'gl:identifier': '9-9-999',
      'gl:status': 'retired',
    };
    const rows = parseCsv(conceptsToCsv([bare]));
    expect(rows).toHaveLength(2);
    expect(rows[1][CSV_COLUMNS.indexOf('termid')]).toBe('9-9-999');
    expect(rows[1][CSV_COLUMNS.indexOf('language')]).toBe('');
    expect(rows[1][CSV_COLUMNS.indexOf('term')]).toBe('');
  });

  it('carries section domains and status columns', () => {
    const rows = parseCsv(conceptsToCsv([baseConcept]));
    expect(rows[1][CSV_COLUMNS.indexOf('section')]).toBe('section-1');
    expect(rows[1][CSV_COLUMNS.indexOf('status')]).toBe('valid');
  });
});

describe('conceptsToSkosJsonLdGraph', () => {
  it('wraps concepts in a shared @context and @graph', () => {
    const parsed = JSON.parse(conceptsToSkosJsonLdGraph([baseConcept]));
    expect(parsed['@context']['skos']).toBe('http://www.w3.org/2004/02/skos/core#');
    expect(parsed['@graph']).toHaveLength(1);
    expect(parsed['@graph'][0]['@id']).toBe(baseConcept['@id']);
    expect(parsed['@graph'][0]['skos:prefLabel']['eng']).toBe('Buoyage and beaconage');
  });
});
