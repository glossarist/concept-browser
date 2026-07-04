/**
 * Dataset group type registry.
 *
 * Maps each `DatasetGroupKind` to its semantic metadata. Adding a new kind
 * is a single entry here + a new renderer component — no edits to existing
 * components needed (open/closed principle).
 *
 * The registry is intentionally pure data — no Vue imports — so it can be
 * consumed by both the sidebar (compact rendering) and the home page (rich
 * rendering) without coupling.
 */
import type { DatasetGroupKind } from './types';

export interface GroupTypeMeta {
  /** Discriminator value matching `DatasetGroup.kind`. */
  kind: DatasetGroupKind;
  /** Human label for the kind, e.g. "Edition series". */
  label: string;
  /** Short description shown in tooltips / section headers. */
  description: string;
  /** Icon glyph — used in section headers and breadcrumbs. */
  glyph: string;
  /** Whether members have an inherent temporal ordering. */
  ordered: boolean;
  /** Whether members have a supersession chain (newer supersedes older). */
  supersession: boolean;
  /** Whether members share the same vocabulary identity across editions. */
  sameVocabulary: boolean;
}

export const GROUP_TYPES: Record<DatasetGroupKind, GroupTypeMeta> = {
  lineage: {
    kind: 'lineage',
    label: 'Edition series',
    description: 'Same vocabulary, different editions over time',
    glyph: '⏳',
    ordered: true,
    supersession: true,
    sameVocabulary: true,
  },
  topic: {
    kind: 'topic',
    label: 'Topic bundle',
    description: 'Different vocabularies covering the same subject',
    glyph: '◆',
    ordered: false,
    supersession: false,
    sameVocabulary: false,
  },
  family: {
    kind: 'family',
    label: 'Publication family',
    description: 'Related vocabularies from the same publisher or program',
    glyph: '✦',
    ordered: false,
    supersession: false,
    sameVocabulary: false,
  },
  collection: {
    kind: 'collection',
    label: 'Curated collection',
    description: 'Hand-picked bundle of datasets for a specific audience',
    glyph: '❖',
    ordered: false,
    supersession: false,
    sameVocabulary: false,
  },
  default: {
    kind: 'default',
    label: 'Datasets',
    description: 'Grouped datasets',
    glyph: '▸',
    ordered: false,
    supersession: false,
    sameVocabulary: false,
  },
};

/**
 * Normalize a group config (which may use the legacy `series: true` flag or
 * the new `kind` discriminator) into a canonical `kind`. Pure function.
 */
export function resolveGroupKind(group: { kind?: DatasetGroupKind; series?: boolean }): DatasetGroupKind {
  if (group.kind) return group.kind;
  if (group.series) return 'lineage';
  return 'default';
}

/** Lookup the metadata for any group, using `resolveGroupKind` for compat. */
export function groupTypeMeta(group: { kind?: DatasetGroupKind; series?: boolean }): GroupTypeMeta {
  return GROUP_TYPES[resolveGroupKind(group)];
}
