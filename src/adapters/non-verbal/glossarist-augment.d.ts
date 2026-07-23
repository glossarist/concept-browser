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
//
// v2 PartitiveRelation block (below) tracks glossarist 0.4.20 — the runtime
// exports PartitiveRelation/PartitiveMember/TypeSharedPlurality from
// src/models/index.js, but the d.ts has not been updated. Remove the v2
// block when upstream PRs the d.ts changes.

import type { ConceptSource, Citation, GlossaristModel } from 'glossarist';

declare module 'glossarist' {
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

  // ── v2 PartitiveRelation (glossarist 0.4.20) ────────────────────────────
  // Runtime exports these from src/models/index.js; d.ts is stale.

  type Completeness = 'complete' | 'partial';
  const COMPLETENESS: { readonly COMPLETE: 'complete'; readonly PARTIAL: 'partial' };
  const COMPLETENESS_VALUES: readonly Completeness[];
  const DEFAULT_COMPLETENESS: Completeness;
  function isValidCompleteness(value: unknown): value is Completeness;

  type MemberCertainty = 'confirmed' | 'possible';
  const MEMBER_CERTAINTY: { readonly CONFIRMED: 'confirmed'; readonly POSSIBLE: 'possible' };
  const MEMBER_CERTAINTY_VALUES: readonly MemberCertainty[];
  const DEFAULT_MEMBER_CERTAINTY: MemberCertainty;
  function isValidMemberCertainty(value: unknown): value is MemberCertainty;

  class TypeSharedPlurality extends GlossaristModel {
    constructor(data?: {
      isShared?: boolean;
      is_shared?: boolean;
      isUncertain?: boolean;
      is_uncertain?: boolean;
      sharedType?: ConceptRef;
      shared_type?: ConceptRef;
    });
    readonly isShared: boolean;
    readonly isUncertain: boolean;
    readonly sharedType: ConceptRef | null;
    hasSharedType(): boolean;
    toJSON(): { is_shared: boolean; is_uncertain?: boolean; shared_type?: ReturnType<ConceptRef['toJSON']> };
    static fromJSON(data: Record<string, unknown>): TypeSharedPlurality;
  }

  class PartitiveMember extends GlossaristModel {
    constructor(data?: { ref?: ConceptRef; certainty?: MemberCertainty });
    readonly ref: ConceptRef;
    readonly certainty: MemberCertainty;
    readonly isConfirmed: boolean;
    readonly isPossible: boolean;
    toJSON(): { ref: ReturnType<ConceptRef['toJSON']>; certainty?: MemberCertainty };
    static fromJSON(data: Record<string, unknown>): PartitiveMember;
    static identityOf(value: unknown): string;
  }

  class PartitiveRelation extends GlossaristModel {
    constructor(data?: {
      comprehensive?: ConceptRef;
      partitives?: PartitiveMember[];
      completeness?: Completeness;
      plurality?: TypeSharedPlurality;
      criterion?: Record<string, string> | string;
    });
    readonly comprehensive: ConceptRef;
    readonly partitives: PartitiveMember[];
    readonly completeness: Completeness;
    readonly plurality: TypeSharedPlurality | null;
    readonly criterion: Record<string, string> | null;
    readonly isComplete: boolean;
    readonly isPartial: boolean;
    readonly isCoordinate: boolean;
    hasPlurality(): boolean;
    hasCriterion(): boolean;
    toJSON(): {
      comprehensive: ReturnType<ConceptRef['toJSON']>;
      partitives: ReturnType<PartitiveMember['toJSON']>[];
      completeness: Completeness;
      plurality?: ReturnType<TypeSharedPlurality['toJSON']>;
      criterion?: Record<string, string>;
    };
    static fromJSON(data: Record<string, unknown>): PartitiveRelation;
    static identityOf(value: unknown): string;
  }

  interface Concept {
    readonly partitiveRelations: PartitiveRelation[];
  }
}

// Re-declare the same exports under the 'glossarist/models' subpath so
// deep-import callers can use them. Upstream's d.ts is stale on this
// subpath too.
declare module 'glossarist/models' {
  export type Completeness = 'complete' | 'partial';
  export const COMPLETENESS: { readonly COMPLETE: 'complete'; readonly PARTIAL: 'partial' };
  export const COMPLETENESS_VALUES: readonly Completeness[];
  export const DEFAULT_COMPLETENESS: Completeness;
  export function isValidCompleteness(value: unknown): value is Completeness;

  export type MemberCertainty = 'confirmed' | 'possible';
  export const MEMBER_CERTAINTY: { readonly CONFIRMED: 'confirmed'; readonly POSSIBLE: 'possible' };
  export const MEMBER_CERTAINTY_VALUES: readonly MemberCertainty[];
  export const DEFAULT_MEMBER_CERTAINTY: MemberCertainty;
  export function isValidMemberCertainty(value: unknown): value is MemberCertainty;

  export class TypeSharedPlurality extends GlossaristModel {
    constructor(data?: {
      isShared?: boolean;
      is_shared?: boolean;
      isUncertain?: boolean;
      is_uncertain?: boolean;
      sharedType?: ConceptRef;
      shared_type?: ConceptRef;
    });
    readonly isShared: boolean;
    readonly isUncertain: boolean;
    readonly sharedType: ConceptRef | null;
    hasSharedType(): boolean;
    toJSON(): { is_shared: boolean; is_uncertain?: boolean; shared_type?: ReturnType<ConceptRef['toJSON']> };
    static fromJSON(data: Record<string, unknown>): TypeSharedPlurality;
  }

  export class PartitiveMember extends GlossaristModel {
    constructor(data?: { ref?: ConceptRef; certainty?: MemberCertainty });
    readonly ref: ConceptRef;
    readonly certainty: MemberCertainty;
    readonly isConfirmed: boolean;
    readonly isPossible: boolean;
    toJSON(): { ref: ReturnType<ConceptRef['toJSON']>; certainty?: MemberCertainty };
    static fromJSON(data: Record<string, unknown>): PartitiveMember;
    static identityOf(value: unknown): string;
  }

  export class PartitiveRelation extends GlossaristModel {
    constructor(data?: {
      comprehensive?: ConceptRef;
      partitives?: PartitiveMember[];
      completeness?: Completeness;
      plurality?: TypeSharedPlurality;
      criterion?: Record<string, string> | string;
    });
    readonly comprehensive: ConceptRef;
    readonly partitives: PartitiveMember[];
    readonly completeness: Completeness;
    readonly plurality: TypeSharedPlurality | null;
    readonly criterion: Record<string, string> | null;
    readonly isComplete: boolean;
    readonly isPartial: boolean;
    readonly isCoordinate: boolean;
    hasPlurality(): boolean;
    hasCriterion(): boolean;
    toJSON(): {
      comprehensive: ReturnType<ConceptRef['toJSON']>;
      partitives: ReturnType<PartitiveMember['toJSON']>[];
      completeness: Completeness;
      plurality?: ReturnType<TypeSharedPlurality['toJSON']>;
      criterion?: Record<string, string>;
    };
    static fromJSON(data: Record<string, unknown>): PartitiveRelation;
    static identityOf(value: unknown): string;
  }
}
