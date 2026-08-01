/**
 * Table bridge — JSON-LD → Table (TS model).
 *
 * Wire format:
 *
 *   {
 *     "@type": "gl:Table",
 *     "gl:id": "{id}",
 *     "gl:identifier": "Table 2",
 *     "gl:caption": { ... },
 *     "gl:description": { ... },
 *     "gl:content": {
 *       "gl:type": "structured" | "markup",
 *       "gl:headers": [ { "eng": "..." }, ... ],   // structured
 *       "gl:rows": [ [ { "eng": "..." }, ... ], ... ],   // structured
 *       "gl:markup": { "eng": "<table>...</table>" }   // markup
 *     },
 *     "gl:format": "html" | "markdown" | "asciidoc",
 *     "gl:source": [ ... ]
 *   }
 */

import { Table } from 'glossarist';
import type { TableContent } from './types';
import { isType, pickField, localized } from './prefix';
import { sourcesFromJsonLd } from './source-bridge';

const FORMAT_SET: ReadonlySet<string> = new Set(['html', 'markdown', 'asciidoc']);

function isLocalizedObj(v: unknown): v is Record<string, string> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.values(v).every(x => typeof x === 'string');
}

function contentFromJsonLd(raw: unknown): TableContent | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const c = raw as Record<string, unknown>;
  const typeRaw = (pickField<string>(c, 'type') ?? '').toLowerCase();

  if (typeRaw === 'markup') {
    const markup = localized(c, 'markup');
    if (!markup) return null;
    return { kind: 'markup', markup };
  }

  if (typeRaw === 'structured' || !typeRaw) {
    const headersRaw = pickField<unknown[]>(c, 'headers');
    const rowsRaw = pickField<unknown[]>(c, 'rows');
    if (!Array.isArray(headersRaw) || !Array.isArray(rowsRaw)) return null;

    const headers: Record<string, string>[] = [];
    for (const h of headersRaw) {
      if (isLocalizedObj(h)) headers.push(h);
    }
    if (headers.length === 0) return null;

    const rows: Record<string, string>[][] = [];
    for (const r of rowsRaw) {
      if (!Array.isArray(r)) continue;
      const cells: Record<string, string>[] = [];
      for (const cell of r) {
        if (isLocalizedObj(cell)) cells.push(cell);
      }
      if (cells.length) rows.push(cells);
    }
    if (rows.length === 0) return null;

    return { kind: 'structured', headers, rows };
  }

  return null;
}

export function tableFromJsonLd(doc: Record<string, unknown>): Table | null {
  if (!isType(doc, 'Table')) return null;

  const id = pickField<string>(doc, 'id') ?? '';
  if (!id) return null;

  const identifier = pickField<string>(doc, 'identifier');
  const caption = localized(doc, 'caption');
  const description = localized(doc, 'description');
  const content = contentFromJsonLd(pickField(doc, 'content'));
  if (!content) return null;

  const formatRaw = (pickField<string>(doc, 'format') ?? '').toLowerCase();
  const format = FORMAT_SET.has(formatRaw) ? formatRaw : undefined;

  const sources = sourcesFromJsonLd(pickField(doc, 'source'));

  return new Table({
    id,
    content: content as any,
    ...(identifier && { identifier }),
    ...(caption && { caption }),
    ...(description && { description }),
    ...(format && { format }),
    ...(sources.length && { sources }),
  } as any);
}
