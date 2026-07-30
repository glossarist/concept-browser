// Local module augmentation for glossarist 0.4.26.
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
// PR glossarist/glossarist-js#31.
//
// v2 PartitiveRelation block (below) tracks glossarist 0.4.26 — the runtime
// exports PartitiveRelation/PartitiveMember from src/models/index.js, but
// the d.ts has not been updated. Remove the v2 block when upstream PRs the
// d.ts changes.

import type { ConceptSource, Citation, GlossaristModel } from 'glossarist';
import type { PartitivePresence, PartitiveCount } from '../../utils/partitive-multiplicity';

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

  // ── PartitiveRelation (glossarist 0.4.26 — MECE presence × count) ─
  // Runtime exports these from src/models/index.js; d.ts is stale.
  // (Tracked by PR glossarist/glossarist-js#31.)

  type Completeness = 'complete' | 'partial';
  const COMPLETENESS: { readonly COMPLETE: 'complete'; readonly PARTIAL: 'partial' };
  const COMPLETENESS_VALUES: readonly Completeness[];
  const DEFAULT_COMPLETENESS: Completeness;
  function isValidCompleteness(value: unknown): value is Completeness;

  const PARTITIVE_PRESENCE: { readonly REQUIRED: 'required'; readonly OPTIONAL: 'optional' } & { readonly VALUES: readonly ['required', 'optional'] };
  type PartitivePresence = (typeof PARTITIVE_PRESENCE.VALUES)[number];
  const PARTITIVE_PRESENCE_VALUES: readonly PartitivePresence[];
  const DEFAULT_PRESENCE: PartitivePresence;
  function isValidPresence(value: unknown): value is PartitivePresence;

  const PARTITIVE_COUNT: { readonly EXACTLY_ONE: 'exactly_one'; readonly AT_LEAST_ONE: 'at_least_one'; readonly MULTIPLE: 'multiple' } & { readonly VALUES: readonly ['exactly_one', 'at_least_one', 'multiple'] };
  type PartitiveCount = (typeof PARTITIVE_COUNT.VALUES)[number];
  const PARTITIVE_COUNT_VALUES: readonly PartitiveCount[];
  const DEFAULT_COUNT: PartitiveCount;
  function isValidCount(value: unknown): value is PartitiveCount;

  type Multiplicity =
    | 'compulsory' | 'optional' | 'compulsory_multiple'
    | 'optional_multiple' | 'compulsory_at_least_one';
  const MULTIPLICITY: Record<string, Multiplicity>;
  const MULTIPLICITY_VALUES: readonly Multiplicity[];
  const DEFAULT_MULTIPLICITY: Multiplicity;
  function isValidMultiplicity(value: unknown): value is Multiplicity;
  function multiplicityFromPair(presence: PartitivePresence, count: PartitiveCount): Multiplicity;
  function pairFromMultiplicity(name: Multiplicity): { presence: PartitivePresence; count: PartitiveCount };

  interface Concept {
    readonly relations: AbstractHyperedge[];
  }

  // Re-exposed here so callers importing from the top-level `glossarist`
  // entry get the MECE-augmented shape, not the stale d.ts type.
  export class HyperedgeMember extends GlossaristModel {
    constructor(data?: {
      ref?: ConceptRef;
      presence?: PartitivePresence;
      count?: PartitiveCount;
    });
    readonly ref: ConceptRef;
    readonly presence: PartitivePresence;
    readonly count: PartitiveCount;
    required(): boolean;
    optional(): boolean;
    toJSON(): Record<string, unknown>;
    static fromJSON(data: Record<string, unknown>): HyperedgeMember;
    static identityOf(value: unknown): string;
  }

  export class PartitiveMember extends HyperedgeMember {
    constructor(data?: {
      ref?: ConceptRef;
      presence?: PartitivePresence;
      count?: PartitiveCount;
      is_delimiting?: boolean;
    });
    readonly is_delimiting: boolean;
    get isDelimiting(): boolean;
  }

  export class GenericMember extends HyperedgeMember {
    constructor(data?: {
      ref?: ConceptRef;
      presence?: PartitivePresence;
      count?: PartitiveCount;
      delimitingCharacteristic?: Record<string, string> | string;
    });
    readonly delimitingCharacteristic: Record<string, string>;
  }

  export class AbstractHyperedge extends GlossaristModel {
    readonly comprehensive: ConceptRef;
    readonly members: HyperedgeMember[];
    readonly completeness: Completeness;
    readonly criterion: Record<string, string> | null;
    readonly sources: ConceptSource[];
    readonly notes: Record<string, string> | null;
    readonly status: string | null;
    readonly isComplete: boolean;
    readonly isPartial: boolean;
    readonly isCoordinate: boolean;
    toJSON(): Record<string, unknown>;
    static fromJSON(data: Record<string, unknown>): AbstractHyperedge;
    static identityOf(value: unknown): string;
  }

  export class PartitiveHyperedge extends AbstractHyperedge {
    get partitives(): HyperedgeMember[];
    static fromJSON(data: Record<string, unknown>): PartitiveHyperedge;
    static identityOf(value: unknown): string;
  }

  export class GenericHyperedge extends AbstractHyperedge {
    static fromJSON(data: Record<string, unknown>): GenericHyperedge;
    static identityOf(value: unknown): string;
  }

  // Legacy aliases (deprecated — use Hyperedge-based names)
  export class PartitiveRelation extends PartitiveHyperedge {}
}

// Re-declare the same exports under the 'glossarist/models' subpath so
// deep-import callers can use them. Upstream's d.ts is stale on this
// subpath too.
//
// The duplication between the 'glossarist' block above and this block
// is forced by upstream's broken d.ts (PR glossarist/glossarist-js#31).
// We cannot `export import` from a local namespace because TypeScript
// requires `declare module` blocks to be self-contained. When upstream
// ships proper d.ts, DELETE this entire file.
declare module 'glossarist/models' {
  export type Completeness = 'complete' | 'partial';
  export const COMPLETENESS: { readonly COMPLETE: 'complete'; readonly PARTIAL: 'partial' };
  export const COMPLETENESS_VALUES: readonly Completeness[];
  export const DEFAULT_COMPLETENESS: Completeness;
  export function isValidCompleteness(value: unknown): value is Completeness;

  export const PARTITIVE_PRESENCE: { readonly REQUIRED: 'required'; readonly OPTIONAL: 'optional' } & { readonly VALUES: readonly ['required', 'optional'] };
  export type PartitivePresence = (typeof PARTITIVE_PRESENCE.VALUES)[number];
  export const PARTITIVE_PRESENCE_VALUES: readonly PartitivePresence[];
  export const DEFAULT_PRESENCE: PartitivePresence;
  export function isValidPresence(value: unknown): value is PartitivePresence;

  export const PARTITIVE_COUNT: { readonly EXACTLY_ONE: 'exactly_one'; readonly AT_LEAST_ONE: 'at_least_one'; readonly MULTIPLE: 'multiple' } & { readonly VALUES: readonly ['exactly_one', 'at_least_one', 'multiple'] };
  export type PartitiveCount = (typeof PARTITIVE_COUNT.VALUES)[number];
  export const PARTITIVE_COUNT_VALUES: readonly PartitiveCount[];
  export const DEFAULT_COUNT: PartitiveCount;
  export function isValidCount(value: unknown): value is PartitiveCount;

  export type Multiplicity =
    | 'compulsory' | 'optional' | 'compulsory_multiple'
    | 'optional_multiple' | 'compulsory_at_least_one';
  export const MULTIPLICITY: Record<string, Multiplicity>;
  export const MULTIPLICITY_VALUES: readonly Multiplicity[];
  export const DEFAULT_MULTIPLICITY: Multiplicity;
  export function isValidMultiplicity(value: unknown): value is Multiplicity;
  export function multiplicityFromPair(presence: PartitivePresence, count: PartitiveCount): Multiplicity;
  export function pairFromMultiplicity(name: Multiplicity): { presence: PartitivePresence; count: PartitiveCount };
  // (TypeSharedPlurality removed — superseded by presence/count on
  // PartitiveMember per MECE refactor. Was dead code.)

  // ── Hyperedge classes (glossarist 0.4.33 — unified n-ary model) ─

  export class HyperedgeMember extends GlossaristModel {
    constructor(data?: {
      ref?: ConceptRef;
      presence?: PartitivePresence;
      count?: PartitiveCount;
      is_delimiting?: boolean;
    });
    readonly ref: ConceptRef;
    readonly presence: PartitivePresence;
    readonly count: PartitiveCount;
    readonly is_delimiting: boolean;
    required(): boolean;
    optional(): boolean;
    get isDelimiting(): boolean;
    toJSON(): Record<string, unknown>;
    static fromJSON(data: Record<string, unknown>): HyperedgeMember;
    static identityOf(value: unknown): string;
  }

  export class PartitiveMember extends HyperedgeMember {}
  export class GenericMember extends HyperedgeMember {}

  export class AbstractHyperedge extends GlossaristModel {
    readonly comprehensive: ConceptRef;
    readonly members: HyperedgeMember[];
    readonly completeness: Completeness;
    readonly criterion: Record<string, string> | null;
    readonly sources: ConceptSource[];
    readonly notes: Record<string, string> | null;
    readonly status: string | null;
    readonly isComplete: boolean;
    readonly isPartial: boolean;
    readonly isCoordinate: boolean;
    toJSON(): Record<string, unknown>;
    static fromJSON(data: Record<string, unknown>): AbstractHyperedge;
    static identityOf(value: unknown): string;
  }

  export class PartitiveHyperedge extends AbstractHyperedge {
    get partitives(): HyperedgeMember[];
    static fromJSON(data: Record<string, unknown>): PartitiveHyperedge;
    static identityOf(value: unknown): string;
  }

  export class GenericHyperedge extends AbstractHyperedge {
    static fromJSON(data: Record<string, unknown>): GenericHyperedge;
    static identityOf(value: unknown): string;
  }

  // Legacy aliases (deprecated)
  export class PartitiveRelation extends PartitiveHyperedge {}
}
