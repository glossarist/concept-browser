<script setup lang="ts">
/**
 * LearnDesignationsView — explains the term/designation vocabulary.
 *
 * Three cards:
 *   1. Normative status (preferred / admitted / deprecated) — ISO 10241-1:2011 §3.4.1.3.
 *      Each explicitly allows multiple (per ISO Notes 1).
 *   2. Kinds and forms of term (full form, abbreviated form, borrowed, variant) —
 *      ISO 10241-1:2011 §3.4.1.2.
 *   3. Designation types (term / proper name / symbol) with abbreviation subtypes
 *      (acronym vs initialism) — ISO 704:2022 §7.
 *
 * Addresses the user's specific concerns:
 *   - "preferred/admitted term means, that they can be multiple" → Card 1
 *   - "types of acronym" → Card 3 (acronym vs initialism vs symbol)
 */
import { useI18n } from '../../i18n';
import LearnCard from '../../components/learn/LearnCard.vue';

const { t } = useI18n();
</script>

<template>
  <div class="learn-designations max-w-5xl mx-auto px-4 py-8">
    <header class="mb-8">
      <h1 class="text-3xl font-serif text-ink-800 dark:text-ink-50 mb-2">
        {{ t('learn.designations.title') }}
      </h1>
      <p class="text-ink-500 dark:text-ink-300 max-w-3xl">{{ t('learn.designations.intro') }}</p>
    </header>

    <!-- ── Normative status ──────────────────────────────────────── -->
    <section class="mb-12" :aria-label="t('learn.designations.normativeSection')">
      <h2 class="text-xl font-semibold text-ink-700 dark:text-ink-100 mb-4 border-b border-ink-100 dark:border-ink-700 pb-2">
        {{ t('learn.designations.normativeSection') }}
      </h2>
      <p class="text-sm text-ink-500 dark:text-ink-400 mb-4">
        {{ t('learn.designations.normativeIntro') }}
      </p>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <LearnCard
          :title="t('learn.designations.preferred.label')"
          iso-reference="ISO 10241-1:2011 §3.4.1.3.1"
          learn-more-url="https://www.glossarist.org/model/designations"
        >
          <p>{{ t('learn.designations.preferred.meaning') }}</p>
          <p class="mt-3 text-xs italic text-ink-500 dark:text-ink-400">
            {{ t('learn.designations.preferred.multipleNote') }}
          </p>
          <template #example>
            VIM 1.9: <strong>measurement unit</strong> (preferred) — the primary term.
          </template>
        </LearnCard>

        <LearnCard
          :title="t('learn.designations.admitted.label')"
          iso-reference="ISO 10241-1:2011 §3.4.1.3.2"
        >
          <p>{{ t('learn.designations.admitted.meaning') }}</p>
          <p class="mt-3 text-xs italic text-ink-500 dark:text-ink-400">
            {{ t('learn.designations.admitted.multipleNote') }}
          </p>
          <template #example>
            VIM 1.9: <strong>unit of measurement</strong> (admitted) — a synonym for "measurement unit".
          </template>
        </LearnCard>

        <LearnCard
          :title="t('learn.designations.deprecated.label')"
          iso-reference="ISO 10241-1:2011 §3.4.1.3.3"
        >
          <p>{{ t('learn.designations.deprecated.meaning') }}</p>
          <p class="mt-3 text-xs italic text-ink-500 dark:text-ink-400">
            {{ t('learn.designations.deprecated.multipleNote') }}
          </p>
          <template #example>
            A term still in use but discouraged, e.g. an outdated spelling or a vendor name
            used as a generic term.
          </template>
        </LearnCard>
      </div>
    </section>

    <!-- ── Kinds and forms of term ───────────────────────────────── -->
    <section class="mb-12" :aria-label="t('learn.designations.kindsSection')">
      <h2 class="text-xl font-semibold text-ink-700 dark:text-ink-100 mb-4 border-b border-ink-100 dark:border-ink-700 pb-2">
        {{ t('learn.designations.kindsSection') }}
      </h2>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <LearnCard
          :title="t('learn.designations.fullForm.label')"
          iso-reference="ISO 10241-1:2011 §3.4.1.2.3"
        >
          <p>{{ t('learn.designations.fullForm.meaning') }}</p>
          <template #example>
            <strong>compact disc</strong> is the full form of "CD".
          </template>
        </LearnCard>

        <LearnCard
          :title="t('learn.designations.abbreviatedForm.label')"
          iso-reference="ISO 10241-1:2011 §3.4.1.2.4"
        >
          <p>{{ t('learn.designations.abbreviatedForm.meaning') }}</p>
          <p class="mt-3 text-xs italic text-ink-500 dark:text-ink-400">
            {{ t('learn.designations.abbreviatedForm.multipleNote') }}
          </p>
          <template #example>
            <strong>CD</strong> is the abbreviated form of "compact disc".
            World Wide Web has two: <strong>WWW</strong> and <strong>W3</strong>.
          </template>
        </LearnCard>

        <LearnCard
          :title="t('learn.designations.borrowed.label')"
          iso-reference="ISO 10241-1:2011 §3.4.1.2.1"
        >
          <p>{{ t('learn.designations.borrowed.meaning') }}</p>
          <template #example>
            English "kindergarten" (borrowed from German).
          </template>
        </LearnCard>

        <LearnCard
          :title="t('learn.designations.variant.label')"
          iso-reference="ISO 10241-1:2011 §3.4.1.2.2"
        >
          <p>{{ t('learn.designations.variant.meaning') }}</p>
          <template #example>
            <strong>colour</strong> (UK) ↔ <strong>color</strong> (US);
            <strong>multi-word term</strong> ↔ <strong>multiword term</strong>.
          </template>
        </LearnCard>
      </div>
    </section>

    <!-- ── Designation types ─────────────────────────────────────── -->
    <section :aria-label="t('learn.designations.typesSection')">
      <h2 class="text-xl font-semibold text-ink-700 dark:text-ink-100 mb-4 border-b border-ink-100 dark:border-ink-700 pb-2">
        {{ t('learn.designations.typesSection') }}
      </h2>
      <p class="text-sm text-ink-500 dark:text-ink-400 mb-4">
        {{ t('learn.designations.typesIntro') }}
      </p>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <LearnCard
          :title="t('learn.designations.term.label')"
          iso-reference="ISO 704:2022 §7.3"
        >
          <p>{{ t('learn.designations.term.meaning') }}</p>
          <template #example>
            <strong>system of quantities</strong> (VIM 1.3)
          </template>
        </LearnCard>

        <LearnCard
          :title="t('learn.designations.acronym.label')"
          iso-reference="ISO 704:2022 §7.3.2"
        >
          <p>{{ t('learn.designations.acronym.meaning') }}</p>
          <template #example>
            <strong>laser</strong> — light amplification by stimulated emission of radiation.
            Pronounced as one word.
          </template>
        </LearnCard>

        <LearnCard
          :title="t('learn.designations.initialism.label')"
          iso-reference="ISO 704:2022 §7.3.2"
        >
          <p>{{ t('learn.designations.initialism.meaning') }}</p>
          <template #example>
            <strong>OIML</strong> — Organisation Internationale de Métrologie Légale.
            Each letter pronounced separately.
          </template>
        </LearnCard>

        <LearnCard
          :title="t('learn.designations.symbol.label')"
          iso-reference="ISO 704:2022 §7.5 + ISO 80000"
        >
          <p>{{ t('learn.designations.symbol.meaning') }}</p>
          <template #example>
            <strong>kg</strong> for kilogram. <strong>m/s</strong> for metre per second.
          </template>
        </LearnCard>
      </div>
    </section>
  </div>
</template>
