<script setup lang="ts">
/**
 * DimensionCard — structured breakdown of a single dimension along
 * which hyperedge members vary. Used on /learn/relationships for the
 * partitive dimensions (presence, count, delimiting).
 *
 * Renders one row per value showing:
 *   - the raw value (machine key)
 *   - the human label
 *   - a short meaning (what it encodes)
 *   - a small visual representation (slot — typically a mini SVG)
 *
 * The user's specific concern: "individually show what dimensions
 * there are and how lines look like". This component is the answer.
 */
export interface DimensionValue {
  value: string;
  label: string;
  meaning: string;
}

defineProps<{
  id?: string;
  name: string;
  isoReference?: string;
  /** Plain-language summary of what this dimension captures. */
  summary: string;
  values: readonly DimensionValue[];
}>();
</script>

<template>
  <article :id="id" class="dimension-card card p-5 scroll-mt-20">
    <header class="flex items-baseline justify-between gap-3 mb-2 flex-wrap">
      <h4 class="text-base font-semibold text-ink-800 dark:text-ink-50">{{ name }}</h4>
      <span v-if="isoReference" class="text-xs font-mono text-ink-400 dark:text-ink-500">
        {{ isoReference }}
      </span>
    </header>
    <p class="text-sm text-ink-600 dark:text-ink-200 mb-4">{{ summary }}</p>
    <ul class="dimension-values space-y-3">
      <li v-for="v in values" :key="v.value" class="dimension-value-row">
        <div class="flex items-center gap-3">
          <div class="dimension-visual">
            <slot name="visual" :value="v.value" />
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-baseline gap-2 flex-wrap">
              <span class="font-medium text-ink-800 dark:text-ink-100">{{ v.label }}</span>
              <code class="text-xs text-ink-400 dark:text-ink-500 font-mono">{{ v.value }}</code>
            </div>
            <p class="text-sm text-ink-600 dark:text-ink-300 mt-0.5">{{ v.meaning }}</p>
          </div>
        </div>
      </li>
    </ul>
  </article>
</template>

<style scoped>
.dimension-card {
  scroll-margin-top: 5rem;
}
.dimension-visual {
  flex-shrink: 0;
  width: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
