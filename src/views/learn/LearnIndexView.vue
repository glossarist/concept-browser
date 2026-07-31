<script setup lang="ts">
/**
 * LearnIndexView — entry point for the /learn section.
 *
 * Cards link to each topic with a one-line description. Phase 1 pages
 * (relationships, designations, statuses) are linked; Phase 2 pages
 * are not yet wired.
 *
 * Reader-focused: this section explains how to READ this site and the
 * terminology behind its labels. For authoring datasets in glossarist
 * format, see glossarist.org.
 */
import { useI18n } from '../../i18n';
import LearnCard from '../../components/learn/LearnCard.vue';

const { t } = useI18n();

interface TopicLink {
  to: string;
  title: string;
  description: string;
}

const phase1Topics: readonly TopicLink[] = [
  {
    to: '/learn/relationships',
    title: t('learn.relationships.title'),
    description: t('learn.relationships.short'),
  },
  {
    to: '/learn/designations',
    title: t('learn.designations.title'),
    description: t('learn.designations.short'),
  },
  {
    to: '/learn/statuses',
    title: t('learn.statuses.title'),
    description: t('learn.statuses.short'),
  },
];
</script>

<template>
  <div class="learn-index max-w-5xl mx-auto px-4 py-8">
    <header class="mb-8">
      <h1 class="text-3xl font-serif text-ink-800 dark:text-ink-50 mb-2">
        {{ t('nav.learn') }}
      </h1>
      <p class="text-ink-500 dark:text-ink-300 max-w-2xl">{{ t('learn.intro') }}</p>
    </header>

    <nav class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" aria-label="Learn topics">
      <RouterLink v-for="topic in phase1Topics" :key="topic.to" :to="topic.to"
                  class="learn-topic-link block no-underline">
        <LearnCard :title="topic.title">
          <div class="flex items-center justify-between">
            <h2 class="text-base font-semibold text-ink-800 dark:text-ink-50">{{ topic.title }}</h2>
            <span class="text-ink-300 dark:text-ink-500 text-sm">→</span>
          </div>
          <p class="text-sm text-ink-600 dark:text-ink-300 mt-1">{{ topic.description }}</p>
        </LearnCard>
      </RouterLink>
    </nav>

    <p class="text-xs text-ink-400 dark:text-ink-500 mt-8">
      {{ t('learn.glossaristOrgNote') }}
    </p>
  </div>
</template>

<style scoped>
.learn-topic-link:hover :deep(.learn-card) {
  border-color: var(--color-accent, #0d9488);
}
</style>
