/**
 * Formula bridge — JSON-LD → Formula (TS model).
 *
 * Wire format:
 *
 *   {
 *     "@type": "gl:Formula",
 *     "gl:id": "{id}",
 *     "gl:identifier": "Formula 5",
 *     "gl:caption": { ... },
 *     "gl:description": { ... },
 *     "gl:expression": { "eng": "E = mc^2", "fra": "E = mc^2" },
 *     "gl:notation": "latex" | "mathml" | "asciimath",
 *     "gl:source": [ ... ]
 *   }
 */

import type { Formula, FormulaNotation } from './types';
import { isType, pickField, localized } from './prefix';
import { sourcesFromJsonLd } from './source-bridge';

const NOTATION_SET: ReadonlySet<string> = new Set(['latex', 'mathml', 'asciimath']);

export function formulaFromJsonLd(doc: Record<string, unknown>): Formula | null {
  if (!isType(doc, 'Formula')) return null;

  const id = pickField<string>(doc, 'id') ?? '';
  if (!id) return null;

  const expression = localized(doc, 'expression');
  if (!expression) return null;

  const notationRaw = (pickField<string>(doc, 'notation') ?? '').toLowerCase();
  const notation = NOTATION_SET.has(notationRaw) ? (notationRaw as FormulaNotation) : 'latex';

  const identifier = pickField<string>(doc, 'identifier');
  const caption = localized(doc, 'caption');
  const description = localized(doc, 'description');
  const sources = sourcesFromJsonLd(pickField(doc, 'source'));

  const f: Formula = { kind: 'formula', id, expression, notation };
  if (identifier) f.identifier = identifier;
  if (caption) f.caption = caption;
  if (description) f.description = description;
  if (sources.length) f.sources = sources;

  return f;
}
