/**
 * Non-verbal entity model — TypeScript projection of the authoritative
 * glossarist-ruby model.
 *
 * The authoritative model lives in glossarist-ruby (Figure, Table, Formula
 * inherit from NonVerbalEntity). This file mirrors that model in TypeScript
 * for the consumer side. It does not redefine the model — every field here
 * corresponds to a field in the authoritative source.
 *
 * See:
 *   ../glossarist-ruby/lib/glossarist/non_verbal_entity.rb
 *   ../glossarist-ruby/lib/glossarist/figure.rb
 *   ../glossarist-ruby/lib/glossarist/table.rb
 *   ../glossarist-ruby/lib/glossarist/formula.rb
 *   ../glossarist-ruby/lib/glossarist/figure_image.rb
 */

export type LocalizedString = Record<string, string>;

export type NonVerbalKind = 'figure' | 'table' | 'formula';

export type FigureImageFormat = 'svg' | 'png' | 'jpg' | 'jpeg' | 'gif' | 'webp' | 'avif';

export type FigureImageRole = 'vector' | 'raster' | 'dark' | 'light' | 'print';

export interface FigureImage {
  src: string;
  format: FigureImageFormat;
  role?: FigureImageRole;
  width?: number;
  height?: number;
  scale?: number;
}

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

export interface NonVerbalEntityBase {
  id: string;
  identifier?: string;
  caption?: LocalizedString;
  description?: LocalizedString;
  alt?: LocalizedString;
  sources?: NonVerbalSource[];
}

export interface Figure extends NonVerbalEntityBase {
  kind: 'figure';
  images: FigureImage[];
  subfigures?: Figure[];
}

export type TableFormat = 'html' | 'markdown' | 'asciidoc';

export type TableContent =
  | { kind: 'structured'; headers: LocalizedString[]; rows: LocalizedString[][] }
  | { kind: 'markup'; markup: LocalizedString };

export interface Table extends NonVerbalEntityBase {
  kind: 'table';
  content: TableContent;
  format?: TableFormat;
}

export type FormulaNotation = 'latex' | 'mathml' | 'asciimath';

export interface Formula extends NonVerbalEntityBase {
  kind: 'formula';
  expression: LocalizedString;
  notation: FormulaNotation;
}

export type NonVerbalEntity = Figure | Table | Formula;

/**
 * V3 NonVerbRep runtime shape.
 *
 * glossarist-js's runtime `NonVerbRep` (post-V3 reshape) holds the same
 * localized fields as `NonVerbalEntityBase` plus a `type` discriminator
 * and an `images[]` array. The published `.d.ts` (still stale at v0.4.2)
 * describes the pre-V3 `ref`/`text` shape; this local interface lets
 * consumer code type-check against reality. Drop when upstream ships a
 * corrected `.d.ts`.
 */
export interface NonVerbRepV3 extends NonVerbalEntityBase {
  type: string | null;
  images: FigureImage[];
}

export interface NonVerbalReference {
  kind: NonVerbalKind;
  entityId: string;
  display?: string;
}
