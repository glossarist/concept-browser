<script setup lang="ts">
/**
 * DatasetGroupRenderer — OCP dispatcher. Maps group.kind to the
 * appropriate sidebar renderer component.
 *
 * Adding a new kind: add an entry to GROUP_RENDERERS + create the new
 * sidebar component. Zero edits to existing components or to
 * AppSidebar.
 *
 * Forwards the `expanded` slot scoped per-entry so callers can render
 * shared per-entry content (sub-pages, sections, etc.) regardless of kind.
 */
import { computed } from 'vue';
import { groupRendererFor } from '../../config/group-renderers';
import { resolveGroupKind } from '../../config/group-types';
import type { DatasetGroupKind } from '../../config/types';

const props = defineProps<{
  kind: DatasetGroupKind;
  entries: Array<{
    id: string;
    title: string;
    ref?: string;
    loaded: boolean;
    conceptCount: number;
    year?: number;
    status?: string;
    isCurrent?: boolean;
  }>;
  currentDataset: string;
}>();

const renderer = computed(() => groupRendererFor(resolveGroupKind({ kind: props.kind })).sidebar);
</script>

<template>
  <component :is="renderer" :entries="entries" :current-dataset="currentDataset">
    <template #expanded="slotProps">
      <slot name="expanded" v-bind="slotProps" />
    </template>
  </component>
</template>
