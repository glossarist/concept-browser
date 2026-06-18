/**
 * Anchor scheme SSOT for non-verbal entities.
 *
 * The anchor id format is `{kind}-{datasetId}-{entityId}` (e.g.
 * `figure-iala-2023-mixed-reflection`). Components, cross-ref click
 * handlers, router guards, and prose mentions all use this module to
 * compute or match anchor ids — keeping the scheme in one place means
 * changing it later is a one-file edit.
 *
 * The kind prefix is the kind itself (e.g. `figure`), not a shortened
 * alias. This matches the wire format and the anchor selector prefix
 * used by the cross-ref composable.
 */

import type { NonVerbalKind } from '../adapters/non-verbal/types';

const ANCHOR_KIND_PREFIX: Record<NonVerbalKind, string> = {
  figure: 'figure',
  table: 'table',
  formula: 'formula',
};

export const ANCHOR_KIND_SELECTORS: readonly string[] = Object
  .values(ANCHOR_KIND_PREFIX)
  .map(k => `a[href^="#${k}-"]`);

export function anchorId(kind: NonVerbalKind, datasetId: string, entityId: string): string {
  return `${ANCHOR_KIND_PREFIX[kind]}-${datasetId}-${entityId}`;
}

export function anchorSelector(kind: NonVerbalKind, datasetId: string, entityId: string): string {
  return `#${CSS.escape(anchorId(kind, datasetId, entityId))}`;
}

export interface ParsedAnchor {
  kind: NonVerbalKind;
  datasetId: string;
  entityId: string;
}

const PARSER_RE = /^(figure|table|formula)-(.+)-(.+)$/;

export function parseAnchorId(id: string): ParsedAnchor | null {
  const m = id.match(PARSER_RE);
  if (!m) return null;
  return { kind: m[1] as NonVerbalKind, datasetId: m[2], entityId: m[3] };
}

export function hrefFromAnchor(id: string): string {
  return `#${id}`;
}
