/**
 * Public API for the non-verbal entity model layer.
 *
 * Model classes (Figure, Table, Formula, FigureImage, NonVerbalEntity) are
 * re-exported from `glossarist` — upstream is the SSOT for the model.
 * Consumer-owned types live in `./types`.
 */

export type {
  LocalizedString,
  NonVerbalKind,
  FigureImageFormat,
  FigureImageRole,
  NonVerbalSource,
  NonVerbalSourceOrigin,
  NonVerbalSourceRef,
  NonVerbalSourceLocality,
  TableContent,
  TableFormat,
  FormulaNotation,
  NonVerbRepV3,
  NonVerbalReference,
} from './types';

export type {
  Figure,
  FigureImage,
  Table,
  Formula,
  NonVerbalEntity,
  SharedNonVerbalEntity,
} from 'glossarist';

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
