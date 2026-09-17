// CSV aggregate export — now routed through glossarist's canonical
// output API (glossarist@0.4.58, glossarist-js#132). These specs pin the
// production contract that shipped in concept-browser#214: column order,
// preferred/alt split, RFC 4180 quoting, BOM + CRLF, languageOrder,
// and no-drop rows for concepts without localizations.

import { describe, it, expect } from 'vitest';
import { Concept, CSV_COLUMNS, conceptsToCsv } from 'glossarist';

function parseCsv(csv: string): string[][] {
  const body = csv.replace(/^﻿/, '');
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

const baseConcept = () => new Concept({
  id: '1-1-010',
  termid: '1-1-010',
  status: 'valid',
  uri: 'https://example.com/vocab/concept/1-1-010',
  domains: [{ conceptId: 'section-1' }],
  sources: [{ type: 'authoritative', origin: { ref: { source: 'IALA Dictionary' }, link: 'https://example.com/source' } }],
  localizations: {
    eng: {
      terms: [
        { designation: 'Buoyage and beaconage', normative_status: 'preferred' },
        { designation: 'Sea-marking (G.B.)', normative_status: 'admitted' },
      ],
      definition: [{ content: 'Ensemble of beacons, buoys, seamarks and small lights.' }],
      notes: [{ content: 'Note one.' }, { content: 'Note two.' }],
    },
    fra: {
      terms: [{ designation: 'Balisage', normative_status: 'preferred' }],
      definition: [{ content: 'Ensemble de balises.' }],
    },
  },
});

describe('conceptsToCsv (glossarist output API)', () => {
  it('emits UTF-8 BOM, CRLF line endings, and the model-driven header', () => {
    const csv = conceptsToCsv([baseConcept()]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv.endsWith('\r\n')).toBe(true);
    const rows = parseCsv(csv);
    expect(rows[0]!.join(',')).toBe(CSV_COLUMNS.join(','));
  });

  it('one row per concept × language; preferred designation first', () => {
    const rows = parseCsv(conceptsToCsv([baseConcept()]));
    expect(rows).toHaveLength(3);
    const eng = rows[1]!;
    expect(eng[0]).toBe('1-1-010');
    expect(eng[4]).toBe('eng');
    expect(eng[5]).toBe('Buoyage and beaconage');
    expect(eng[6]).toBe('Sea-marking (G.B.)');
  });

  it('definition/notes columns carry the full content', () => {
    const rows = parseCsv(conceptsToCsv([baseConcept()]));
    expect(rows[1]![7]).toBe('Ensemble of beacons, buoys, seamarks and small lights.');
    expect(rows[1]![8]).toBe('Note one.\nNote two.');
    expect(rows[2]![7]).toBe('Ensemble de balises.');
  });

  it('sources and source_links from origin ref/link', () => {
    const rows = parseCsv(conceptsToCsv([baseConcept()]));
    expect(rows[1]![10]).toBe('IALA Dictionary');
    expect(rows[1]![11]).toBe('https://example.com/source');
  });

  it('languageOrder reorders rows; unlisted languages append after', () => {
    const rows = parseCsv(conceptsToCsv([baseConcept()], { languageOrder: ['fra', 'deu'] }));
    expect(rows[1]![4]).toBe('fra');
    expect(rows[2]![4]).toBe('eng');
  });

  it('concept without localizations still gets a row (no silent drops)', () => {
    const bare = new Concept({ id: '222-02-02', termid: '222-02-02' });
    const rows = parseCsv(conceptsToCsv([bare]));
    expect(rows).toHaveLength(2);
    expect(rows[1]![0]).toBe('222-02-02');
    expect(rows[1]![4]).toBe('');
  });
});
