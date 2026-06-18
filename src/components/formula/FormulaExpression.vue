<script setup lang="ts">
/**
 * FormulaExpression — renders one formula expression in its notation.
 *
 * Uses Plurimath (the project's existing math library, NOT KaTeX) to
 * render LaTeX / AsciiMath / MathML to MathML+HTML. Plurimath output
 * includes semantic MathML for screen readers as a by-product of its
 * internal pipeline, so no extra a11y work is needed.
 *
 * The expression is a LocalizedString — different locales can name
 * variables in their local language while keeping the same notation type.
 */
import { computed, ref, watch, onMounted } from 'vue';
import type { LocalizedString, FormulaNotation } from '../../adapters/non-verbal/types';
import { pickLocaleMap, localeToBcp47 } from '../../utils/locale';
import { loadPlurimath } from '../../utils/plurimath';

const props = defineProps<{
  expression: LocalizedString;
  notation: FormulaNotation;
  locale: string;
  fallbackChain?: readonly string[];
}>();

const resolved = computed(() => pickLocaleMap(props.expression, props.locale, props.fallbackChain));
const html = ref<string>('');
const lang = computed(() => resolved.value ? localeToBcp47(resolved.value.locale) : undefined);

const PLURIMATH_FORMAT: Record<FormulaNotation, string> = {
  latex: 'latex',
  asciimath: 'asciimath',
  mathml: 'mathml',
};

async function render() {
  const r = resolved.value;
  if (!r) { html.value = ''; return; }
  try {
    const Plurimath = await loadPlurimath();
    const p = new Plurimath(r.text, PLURIMATH_FORMAT[props.notation]);
    html.value = p.toMathml().replace('display="block"', 'display="inline"').trim();
  } catch {
    html.value = `<code class="formula-fallback">${r.text}</code>`;
  }
}

onMounted(render);
watch([resolved, () => props.notation], render);
</script>

<template>
  <span class="formula__expression" :lang="lang">
    <span v-if="html" v-html="html"></span>
    <code v-else></code>
  </span>
</template>

<style scoped>
.formula__expression {
  display: inline-block;
  font-family: 'Latin Modern Math', 'STIX Two Math', serif;
}
.formula-fallback {
  font-family: var(--font-mono, monospace);
  background: var(--surface-alt, #f5f5f5);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875rem;
}
</style>
