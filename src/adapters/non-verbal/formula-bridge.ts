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

import { Formula } from 'glossarist';
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
  const notation = NOTATION_SET.has(notationRaw) ? notationRaw : 'latex';

  const identifier = pickField<string>(doc, 'identifier');
  const caption = localized(doc, 'caption');
  const description = localized(doc, 'description');
  const sources = sourcesFromJsonLd(pickField(doc, 'source'));

  return new Formula({
    id,
    expression: expression as any,
    notation,
    ...(identifier && { identifier }),
    ...(caption && { caption }),
    ...(description && { description }),
    ...(sources.length && { sources }),
  } as any);
}
