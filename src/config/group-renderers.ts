/**
 * Group renderer registry — maps each DatasetGroupKind to its sidebar
 * and homePage renderer components. Open/closed: adding a new kind
 * requires one entry here + one new component. Zero edits to existing
 * components.
 */
import type { Component } from 'vue';
import type { DatasetGroupKind } from './types';
import LineageGroupSidebar from '../components/groups/LineageGroupSidebar.vue';
import DefaultGroupSidebar from '../components/groups/DefaultGroupSidebar.vue';

export interface GroupRendererEntry {
  readonly kind: DatasetGroupKind;
  readonly sidebar: Component;
}

export const GROUP_RENDERERS: Record<DatasetGroupKind, GroupRendererEntry> = {
  lineage:    { kind: 'lineage', sidebar: LineageGroupSidebar },
  topic:      { kind: 'topic',   sidebar: DefaultGroupSidebar },
  family:     { kind: 'family',  sidebar: DefaultGroupSidebar },
  collection: { kind: 'collection', sidebar: DefaultGroupSidebar },
  default:    { kind: 'default', sidebar: DefaultGroupSidebar },
};

export function groupRendererFor(kind: DatasetGroupKind): GroupRendererEntry {
  return GROUP_RENDERERS[kind] ?? GROUP_RENDERERS.default;
}
