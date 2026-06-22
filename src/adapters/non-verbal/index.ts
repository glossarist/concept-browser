/**
 * Public API for the non-verbal entity model layer.
 *
 * Re-exports the types, bridges, and dispatch table. Components and
 * composables import from here — never from individual files — so the
 * internal layout can evolve without breaking the public surface.
 */

export type {
  LocalizedString,
  NonVerbalKind,
  FigureImage,
  FigureImageFormat,
  FigureImageRole,
  NonVerbalSource,
  NonVerbalSourceOrigin,
  NonVerbalSourceRef,
  NonVerbalSourceLocality,
  NonVerbalEntityBase,
  Figure,
  Table,
  TableContent,
  TableFormat,
  Formula,
  FormulaNotation,
  NonVerbalEntity,
  NonVerbRepV3,
  NonVerbalReference,
} from './types';

export { figureFromJsonLd } from './figure-bridge';
export { tableFromJsonLd } from './table-bridge';
export { formulaFromJsonLd } from './formula-bridge';

export {
  KIND_TO_DIR,
  KIND_TO_TYPE_FIELD,
  KIND_TO_BRIDGE,
  ALL_KINDS,
  MENTION_KIND_TO_ENTITY_KIND,
  kindFromType,
  entityKindFromMentionKind,
} from './kind';

export type { BridgeFn } from './kind';

export {
  pickField,
  pickFieldArray,
  pickFieldRecord,
  isType,
  localized,
} from './prefix';
