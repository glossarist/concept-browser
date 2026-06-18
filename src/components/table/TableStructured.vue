<script setup lang="ts">
/**
 * TableStructured — renders a structured table (headers + rows).
 *
 * Each cell is a LocalizedString. Headers are LocalizedString[] and rows
 * are LocalizedString[][]. The locale SSOT picks one language per cell —
 * cells can fall back to English independently.
 */
import { computed } from 'vue';
import type { LocalizedString } from '../../adapters/non-verbal/types';
import { pickLocaleText } from '../../utils/locale';

interface StructuredContent {
  kind: 'structured';
  headers: LocalizedString[];
  rows: LocalizedString[][];
}

const props = defineProps<{
  content: StructuredContent;
  locale: string;
  fallbackChain?: readonly string[];
}>();

const headerTexts = computed(() =>
  props.content.headers.map(h => pickLocaleText(h, props.locale, props.fallbackChain)),
);

const rowTexts = computed(() =>
  props.content.rows.map(r =>
    r.map(cell => pickLocaleText(cell, props.locale, props.fallbackChain)),
  ),
);
</script>

<template>
  <table class="nv-table nv-table--structured">
    <thead v-if="headerTexts.length">
      <tr>
        <th v-for="(h, i) in headerTexts" :key="i" scope="col">{{ h }}</th>
      </tr>
    </thead>
    <tbody>
      <tr v-for="(row, ri) in rowTexts" :key="ri">
        <td v-for="(cell, ci) in row" :key="ci">{{ cell }}</td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.nv-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.nv-table th, .nv-table td {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--ink-100, #e5e5e5);
  text-align: left;
}
.nv-table th {
  background: var(--surface-alt, #f5f5f5);
  font-weight: 600;
}
</style>
