<script setup lang="ts">
/**
 * DatasetGroupRenderer — OCP dispatcher. Maps group.kind to the
 * appropriate sidebar renderer component. New kinds: add entry to
 * GROUP_RENDERERS + new component. Zero edits to existing code.
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
  <component :is="renderer" :entries="entries" :current-dataset="currentDataset" />
</template>