<script setup lang="ts">
/**
 * TableMarkup — renders a markup table (HTML / Markdown / AsciiDoc).
 *
 * The content is a LocalizedString — one markup string per locale. The
 * renderer picks the locale via the SSOT, then applies the format-specific
 * transform:
 *   - `html`     → render as-is (sanitized by the DOMPurify-driven
 *                  v-html trust boundary upstream — V1 trusts authored HTML)
 *   - `markdown` → render via the lightweight markdown utility
 *   - `asciidoc` → render via the lightweight asciidoc utility
 */
import { computed } from 'vue';
import type { LocalizedString, TableFormat } from '../../adapters/non-verbal/types';
import { pickLocaleMap } from '../../utils/locale';
import { renderMarkdown } from '../../utils/markdown-lite';
import { renderAsciiDocLite } from '../../utils/asciidoc-lite';

const props = defineProps<{
  content: LocalizedString;
  format?: TableFormat;
  locale: string;
  fallbackChain?: readonly string[];
}>();

const resolved = computed(() => pickLocaleMap(props.content, props.locale, props.fallbackChain));

const html = computed(() => {
  const r = resolved.value;
  if (!r) return '';
  const fmt = props.format ?? 'html';
  if (fmt === 'markdown') return renderMarkdown(r.text);
  if (fmt === 'asciidoc') return renderAsciiDocLite(r.text);
  return r.text;
});

const lang = computed(() => resolved.value?.locale);
</script>

<template>
  <div class="nv-table nv-table--markup" :lang="lang" v-html="html"></div>
</template>

<style scoped>
.nv-table {
  width: 100%;
  overflow-x: auto;
  font-size: 0.875rem;
}
.nv-table :deep(table) {
  width: 100%;
  border-collapse: collapse;
}
.nv-table :deep(th),
.nv-table :deep(td) {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--ink-100, #e5e5e5);
}
.nv-table :deep(th) {
  background: var(--surface-alt, #f5f5f5);
  font-weight: 600;
}
</style>
