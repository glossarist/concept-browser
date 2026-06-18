import type { NonVerbalEntity, NonVerbalKind } from './types';
import {
  ENTITY_DIRECTORIES,
  ENTITY_TYPES,
} from 'glossarist';
import { figureFromJsonLd } from './figure-bridge';
import { tableFromJsonLd } from './table-bridge';
import { formulaFromJsonLd } from './formula-bridge';

export type BridgeFn = (doc: Record<string, unknown>) => NonVerbalEntity | null;

export const KIND_TO_DIR: Readonly<Record<NonVerbalKind, string>> = Object.freeze(
  Object.fromEntries(ENTITY_DIRECTORIES),
) as Readonly<Record<NonVerbalKind, string>>;

export const KIND_TO_TYPE_FIELD: Readonly<Record<NonVerbalKind, string>> = {
  figure: 'Figure',
  table: 'Table',
  formula: 'Formula',
};

export const KIND_TO_BRIDGE: Readonly<Record<NonVerbalKind, BridgeFn>> = {
  figure: figureFromJsonLd,
  table: tableFromJsonLd,
  formula: formulaFromJsonLd,
};

export const ALL_KINDS: readonly NonVerbalKind[] = ENTITY_TYPES as readonly NonVerbalKind[];

export const MENTION_KIND_TO_ENTITY_KIND: Readonly<Record<string, NonVerbalKind>> = {
  'fig-ref': 'figure',
  'table-ref': 'table',
  'formula-ref': 'formula',
};

export function kindFromType(typeField: string): NonVerbalKind | null {
  const bare = typeField.replace(/^(gl|gloss):/, '');
  for (const k of ALL_KINDS) {
    if (bare === KIND_TO_TYPE_FIELD[k]) return k;
  }
  return null;
}

export function entityKindFromMentionKind(mentionKind: string): NonVerbalKind | null {
  return MENTION_KIND_TO_ENTITY_KIND[mentionKind] ?? null;
}
