<script setup lang="ts">
/**
 * LearnStatusesView — quick reference for the status badges used
 * across the site.
 *
 * Three categories:
 *   1. Entry status (glossarist lifecycle: valid, withdrawn, draft)
 *   2. Normative status (preferred/admitted/deprecated — cross-links
 *      /learn/designations, no duplication)
 *   3. Source status (identical, modified, restyled — provenance)
 */
import { useI18n } from '../../i18n';
import LearnCard from '../../components/learn/LearnCard.vue';

const { t } = useI18n();

interface StatusRow {
  value: string;
  label: string;
  meaning: string;
}

const entryStatuses: readonly StatusRow[] = [
  { value: 'valid', label: t('learn.statuses.entry.valid.label'), meaning: t('learn.statuses.entry.valid.meaning') },
  { value: 'withdrawn', label: t('learn.statuses.entry.withdrawn.label'), meaning: t('learn.statuses.entry.withdrawn.meaning') },
  { value: 'draft', label: t('learn.statuses.entry.draft.label'), meaning: t('learn.statuses.entry.draft.meaning') },
  { value: 'superseded', label: t('learn.statuses.entry.superseded.label'), meaning: t('learn.statuses.entry.superseded.meaning') },
];

const sourceStatuses: readonly StatusRow[] = [
  { value: 'identical', label: t('learn.statuses.source.identical.label'), meaning: t('learn.statuses.source.identical.meaning') },
  { value: 'modified', label: t('learn.statuses.source.modified.label'), meaning: t('learn.statuses.source.modified.meaning') },
  { value: 'restyled', label: t('learn.statuses.source.restyled.label'), meaning: t('learn.statuses.source.restyled.meaning') },
  { value: 'lineage', label: t('learn.statuses.source.lineage.label'), meaning: t('learn.statuses.source.lineage.meaning') },
];
</script>

<template>
  <div class="learn-statuses max-w-5xl mx-auto px-4 py-8">
    <header class="mb-8">
      <h1 class="text-3xl font-serif text-ink-800 dark:text-ink-50 mb-2">
        {{ t('learn.statuses.title') }}
      </h1>
      <p class="text-ink-500 dark:text-ink-300 max-w-3xl">{{ t('learn.statuses.intro') }}</p>
    </header>

    <!-- ── Entry status ──────────────────────────────────────────── -->
    <section class="mb-12" :aria-label="t('learn.statuses.entrySection')">
      <h2 class="text-xl font-semibold text-ink-700 dark:text-ink-100 mb-4 border-b border-ink-100 dark:border-ink-700 pb-2">
        {{ t('learn.statuses.entrySection') }}
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LearnCard
          v-for="s in entryStatuses"
          :key="s.value"
          :id="`entry-${s.value}`"
          :title="s.label"
        >
          <p>{{ s.meaning }}</p>
          <template #example>
            <span class="inline-block text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wide"
                  :class="{
                    'bg-green-50 text-green-700 dark:bg-green-900/40 dark:text-green-300': s.value === 'valid',
                    'bg-red-50 text-red-700 dark:bg-red-900/40 dark:text-red-300': s.value === 'withdrawn',
                    'bg-amber-50 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300': s.value === 'draft',
                    'bg-gray-50 text-gray-700 dark:bg-gray-700/40 dark:text-gray-300': s.value === 'superseded',
                  }">
              {{ s.label }}
            </span>
          </template>
        </LearnCard>
      </div>
    </section>

    <!-- ── Normative status (cross-link) ─────────────────────────── -->
    <section class="mb-12" :aria-label="t('learn.statuses.normativeSection')">
      <h2 class="text-xl font-semibold text-ink-700 dark:text-ink-100 mb-4 border-b border-ink-100 dark:border-ink-700 pb-2">
        {{ t('learn.statuses.normativeSection') }}
      </h2>
      <LearnCard
        :title="t('learn.statuses.normativeTitle')"
        iso-reference="ISO 10241-1:2011 §3.4.1.3"
      >
        <p>{{ t('learn.statuses.normativeSummary') }}</p>
        <p class="mt-3">
          <RouterLink to="/learn/designations" class="text-ink-500 dark:text-ink-400 underline">
            {{ t('learn.statuses.normativeGoDeeper') }} →
          </RouterLink>
        </p>
      </LearnCard>
    </section>

    <!-- ── Source status ─────────────────────────────────────────── -->
    <section :aria-label="t('learn.statuses.sourceSection')">
      <h2 class="text-xl font-semibold text-ink-700 dark:text-ink-100 mb-4 border-b border-ink-100 dark:border-ink-700 pb-2">
        {{ t('learn.statuses.sourceSection') }}
      </h2>
      <p class="text-sm text-ink-500 dark:text-ink-400 mb-4">
        {{ t('learn.statuses.sourceIntro') }}
      </p>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LearnCard
          v-for="s in sourceStatuses"
          :key="s.value"
          :id="`source-${s.value}`"
          :title="s.label"
          learn-more-url="https://www.glossarist.org/model/sources"
        >
          <p>{{ s.meaning }}</p>
        </LearnCard>
      </div>
    </section>
  </div>
</template>
