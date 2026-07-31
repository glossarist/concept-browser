<script setup lang="ts">
/**
 * LearnCard — the standard topic container across all /learn pages.
 *
 * Layout: title + ISO reference on top, then a flexible body. Optional
 * named slots:
 *   - `diagram` — a small visual (live SVG, badge samples, etc.)
 *   - `example` — a concrete real-world example
 * Optional `learnMoreUrl` renders a "Learn more on glossarist.org"
 * link at the bottom — keeps concept-browser reader-focused while
 * bridging to the canonical author docs on glossarist.org.
 *
 * Anchored at the `id` prop so URLs like `/learn/relationships#partitive`
 * deep-link to the right card.
 */
defineProps<{
  id?: string;
  title: string;
  isoReference?: string;
  learnMoreUrl?: string;
  learnMoreLabel?: string;
}>();
</script>

<template>
  <article :id="id" class="learn-card card p-5 scroll-mt-20">
    <header class="flex items-baseline justify-between gap-3 mb-3 flex-wrap">
      <h3 class="text-lg font-semibold text-ink-800 dark:text-ink-50">{{ title }}</h3>
      <span v-if="isoReference" class="text-xs font-mono text-ink-400 dark:text-ink-500">
        {{ isoReference }}
      </span>
    </header>
    <div v-if="$slots.diagram" class="learn-card-diagram mb-3">
      <slot name="diagram" />
    </div>
    <div class="learn-card-body text-sm text-ink-600 dark:text-ink-200">
      <slot />
    </div>
    <div v-if="$slots.example" class="learn-card-example mt-3 pt-3 border-t border-ink-100 dark:border-ink-700 text-xs text-ink-500 dark:text-ink-400">
      <slot name="example" />
    </div>
    <footer v-if="learnMoreUrl" class="learn-card-footer mt-3 text-xs">
      <a :href="learnMoreUrl" target="_blank" rel="noopener"
         class="text-ink-500 dark:text-ink-400 hover:text-ink-800 dark:hover:text-ink-100 underline">
        {{ learnMoreLabel ?? 'Learn more on glossarist.org' }} ↗
      </a>
    </footer>
  </article>
</template>

<style scoped>
.learn-card {
  scroll-margin-top: 5rem;
}
.learn-card-diagram {
  display: flex;
  justify-content: center;
}
</style>
