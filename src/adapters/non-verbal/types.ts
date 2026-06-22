/**
 * Consumer-side types for non-verbal entities.
 *
 * Model classes (Figure, Table, Formula, FigureImage, NonVerbalEntity) are
 * imported from `glossarist` — the upstream library is the SSOT for the
 * model. This file holds only what is genuinely consumer-owned:
 *
 *   - `NonVerbalKind`: routing discriminator used by the resolver, the
 *     anchor scheme, the mention dispatcher, and the section router.
 *   - `NonVerbRepV3`: local view of NonVerbRep's V3 shape. Upstream's
 *     published .d.ts still describes the pre-V3 `ref`/`text` shape; this
 *     interface lets the consumer type-check against runtime reality.
 *     Delete when upstream ships a corrected declaration.
 *   - `NonVerbalReference`: consumer-side view of inline mentions like
 *     `{{fig:foo}}`. Carries a `kind` for UI routing.
 *   - `LocalizedString`, `FigureImageFormat`, `FigureImageRole`,
 *     `TableFormat`, `TableContent`, `FormulaNotation`: string-union
 *     refinements the consumer validates at bridge time.
 *   - `NonVerbalSource*`: wire shape for JSON-LD source entries. Stays
 *     consumer-side until upstream ships a V3 NonVerbalSource model.
 */

export type LocalizedString = Record<string, string>;

export type NonVerbalKind = 'figure' | 'table' | 'formula';

export type FigureImageFormat = 'svg' | 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp' | 'avif';

export type FigureImageRole = 'vector' | 'raster' | 'dark' | 'light' | 'print';

export interface NonVerbalSourceRef {
  source?: string;
  id?: string;
  version?: string;
  text?: string;
}

export interface NonVerbalSourceLocality {
  type?: string;
  referenceFrom?: string;
  referenceTo?: string;
}

export interface NonVerbalSourceOrigin {
  ref?: NonVerbalSourceRef;
  locality?: NonVerbalSourceLocality;
  link?: string;
  id?: string;
  version?: string;
  source?: string;
}

export interface NonVerbalSource {
  id?: string;
  type?: string;
  status?: string;
  modification?: string;
  origin?: NonVerbalSourceOrigin;
}

export type TableFormat = 'html' | 'markdown' | 'asciidoc';

export type TableContent =
  | { kind: 'structured'; headers: LocalizedString[]; rows: LocalizedString[][] }
  | { kind: 'markup'; markup: LocalizedString };

export type FormulaNotation = 'latex' | 'mathml' | 'asciimath';

/**
 * V3 NonVerbRep runtime shape.
 *
 * glossarist-js's runtime `NonVerbRep` (post-V3 reshape) holds the same
 * localized fields as the base NonVerbalEntity plus a `type` discriminator
 * and an `images[]` array. The published `.d.ts` (still stale at v0.4.2)
 * describes the pre-V3 `ref`/`text` shape; this local interface lets
 * consumer code type-check against reality. Drop when upstream ships a
 * corrected `.d.ts` (glossarist/glossarist-js#31).
 */
export interface NonVerbRepV3 {
  id: string;
  identifier?: string | null;
  type: string | null;
  caption?: LocalizedString | null;
  description?: LocalizedString | null;
  alt?: LocalizedString | null;
  images: NonVerbRepImage[];
  sources?: NonVerbalSource[];
}

export interface NonVerbRepImage {
  src: string;
  format?: string | null;
  role?: string | null;
  width?: number | null;
  height?: number | null;
  scale?: number | null;
}

export interface NonVerbalReference {
  kind: NonVerbalKind;
  entityId: string;
  display?: string;
}
