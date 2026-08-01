/**
 * Figure bridge — JSON-LD → Figure (TS model).
 *
 * Wire format (per task 11 + glossarist-ruby's planned export):
 *
 *   {
 *     "@id": "https://glossarist.org/{ds}/figure/{id}",
 *     "@type": "gl:Figure" | "gloss:Figure",
 *     "gl:id": "{id}",
 *     "gl:identifier": "Figure 7c",            // plain string
 *     "gl:caption": { "eng": "...", "fra": "..." },
 *     "gl:altText": { "eng": "..." },           // mapped to model.alt
 *     "gl:description": { "eng": "..." },
 *     "gl:image": [
 *       { "gl:src": "x.png", "gl:format": "png", "gl:role": "raster",
 *         "gl:width": 1600, "gl:height": 1200, "gl:scale": 1 }
 *     ],
 *     "gl:subfigure": [ ... recursive Figure docs ... ],
 *     "gl:source": [ ... NonVerbalSource docs ... ]
 *   }
 *
 * The wire field `gl:altText` is mapped to the model field `alt` to avoid
 * ambiguity with the HTML `<img alt>` attribute.
 */

import { Figure, FigureImage } from 'glossarist';
import { isType, pickField, pickFieldArray, localized } from './prefix';
import { sourcesFromJsonLd } from './source-bridge';

const FORMAT_SET: ReadonlySet<string> = new Set(['svg', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'avif']);

const ROLE_SET: ReadonlySet<string> = new Set(['vector', 'raster', 'dark', 'light', 'print']);

function imageFromJsonLd(raw: Record<string, unknown>): FigureImage | null {
  const src = pickField<string>(raw, 'src');
  if (!src) return null;
  const formatRaw = (pickField<string>(raw, 'format') ?? '').toLowerCase();
  const format = FORMAT_SET.has(formatRaw) ? formatRaw : 'svg';
  const roleRaw = pickField<string>(raw, 'role');
  const role = roleRaw && ROLE_SET.has(roleRaw) ? roleRaw : undefined;
  const width = pickField<number>(raw, 'width');
  const height = pickField<number>(raw, 'height');
  const scale = pickField<number>(raw, 'scale');
  return new FigureImage({
    src,
    format,
    ...(role !== undefined && { role }),
    ...(typeof width === 'number' && { width }),
    ...(typeof height === 'number' && { height }),
    ...(typeof scale === 'number' && { scale }),
  } as any);
}

function imagesFromJsonLd(raw: unknown): FigureImage[] {
  if (!Array.isArray(raw)) return [];
  const out: FigureImage[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const img = imageFromJsonLd(entry as Record<string, unknown>);
    if (img) out.push(img);
  }
  return out;
}

function subfiguresFromJsonLd(raw: unknown): Figure[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const out: Figure[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const sub = figureFromJsonLd(entry as Record<string, unknown>);
    if (sub) out.push(sub);
  }
  return out.length ? out : undefined;
}

export function figureFromJsonLd(doc: Record<string, unknown>): Figure | null {
  if (!isType(doc, 'Figure')) return null;

  const id = pickField<string>(doc, 'id') ?? '';
  if (!id) return null;

  const identifier = pickField<string>(doc, 'identifier');
  const caption = localized(doc, 'caption');
  const alt = localized(doc, 'altText');
  const description = localized(doc, 'description');
  const images = imagesFromJsonLd(pickFieldArray(doc, 'image'));
  const subfigures = subfiguresFromJsonLd(pickField(doc, 'subfigure'));
  const sources = sourcesFromJsonLd(pickField(doc, 'source'));

  return new Figure({
    id,
    images,
    ...(identifier && { identifier }),
    ...(caption && { caption }),
    ...(alt && { alt }),
    ...(description && { description }),
    ...(subfigures && { subfigures }),
    ...(sources.length && { sources }),
  } as any);
}
