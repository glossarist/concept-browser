// Local module augmentation for glossarist 0.4.2.
//
// Upstream's published src/models/index.d.ts declares ZERO classes for the
// non-verbal hierarchy (Figure, Table, Formula, FigureImage, NonVerbalEntity,
// SharedNonVerbalEntity, NonVerbalReference + subclasses, BibliographyEntry,
// BibliographyData) plus the localized-string helpers. The top-level
// index.d.ts re-exports the names, so TypeScript silently resolves every
// consumer import to `any`.
//
// This file declares the runtime shape so consumer code can be type-checked.
// DELETE this file when upstream ships proper declarations — tracked by
// PR glossarist/glossarist-js#31 (targets v0.4.3+).

import type { ConceptSource, Citation, GlossaristModel } from 'glossarist';

declare module 'glossarist' {
  interface ConceptSource {
    sourced_from?: Citation[];
  }

  class RegistrableModel extends GlossaristModel {
    static register(type: string, cls: typeof RegistrableModel): void;
    static fromData(data: Record<string, unknown>): RegistrableModel;
  }

  class FigureImage extends GlossaristModel {
    constructor(data?: {
      src?: string | null;
      format?: string | null;
      role?: string | null;
      width?: number | null;
      height?: number | null;
      scale?: number | null;
    });
    readonly src: string | null;
    readonly format: string | null;
    readonly role: string | null;
    readonly width: number | null;
    readonly height: number | null;
    readonly scale: number | null;
    static fromJSON(data: Record<string, unknown>): FigureImage;
  }

  class NonVerbalEntity extends RegistrableModel {
    constructor(data?: Record<string, unknown>);
    readonly caption: Record<string, string> | null;
    readonly description: Record<string, string> | null;
    readonly alt: Record<string, string> | null;
    readonly sources: ConceptSource[];
    findById(targetId: string): NonVerbalEntity | null;
    allIds(): string[];
    static fromJSON(data: Record<string, unknown>): NonVerbalEntity;
  }

  class SharedNonVerbalEntity extends NonVerbalEntity {
    constructor(data?: Record<string, unknown>);
    readonly id: string | null;
    readonly identifier: string | null;
    findById(targetId: string): SharedNonVerbalEntity | null;
    allIds(): string[];
    static fromJSON(data: Record<string, unknown>): SharedNonVerbalEntity;
  }

  class Figure extends SharedNonVerbalEntity {
    constructor(data?: Record<string, unknown>);
    readonly images: FigureImage[];
    readonly subfigures: Figure[];
    findById(targetId: string): Figure | null;
    allIds(): string[];
    static fromJSON(data: Record<string, unknown>): Figure;
  }

  class Table extends SharedNonVerbalEntity {
    constructor(data?: Record<string, unknown>);
    readonly content: Record<string, unknown> | null;
    readonly format: string | null;
    static fromJSON(data: Record<string, unknown>): Table;
  }

  class Formula extends SharedNonVerbalEntity {
    constructor(data?: Record<string, unknown>);
    readonly expression: Record<string, string> | null;
    readonly notation: string | null;
    static fromJSON(data: Record<string, unknown>): Formula;
  }

  const NON_VERBAL_TYPES: readonly string[];

  class NonVerbalReference extends RegistrableModel {
    constructor(data?: Record<string, unknown>);
    readonly entityId: string | null;
    readonly display: string | null;
    readonly dedupKey: readonly [string, string | null];
    static fromJSON(data: Record<string, unknown> | string): NonVerbalReference;
    static register(type: string, cls: typeof NonVerbalReference): void;
  }

  interface NonVerbRep {
    readonly caption: string | null;
    readonly description: string | null;
    readonly alt: string | null;
    readonly images: FigureImage[];
  }

  class FigureReference extends NonVerbalReference {
    static fromJSON(data: Record<string, unknown> | string): FigureReference;
  }

  class TableReference extends NonVerbalReference {
    static fromJSON(data: Record<string, unknown> | string): TableReference;
  }

  class FormulaReference extends NonVerbalReference {
    static fromJSON(data: Record<string, unknown> | string): FormulaReference;
  }

  class BibliographyEntry extends GlossaristModel {
    constructor(data?: Record<string, unknown>);
    readonly id: string | null;
    readonly reference: string | null;
    readonly title: string | null;
    readonly link: string | null;
    readonly type: string | null;
    static fromJSON(data: Record<string, unknown>): BibliographyEntry;
  }

  class BibliographyData extends GlossaristModel {
    constructor(data?: Record<string, unknown>);
    readonly entries: BibliographyEntry[];
    find(id: string): BibliographyEntry | null;
    readonly keys: string[];
    toYAML(): string;
    toJSON(): { bibliography: BibliographyEntry[] };
    static fromYAML(yamlString: string): BibliographyData;
    static fromJSON(data: Record<string, unknown>): BibliographyData;
  }
}
