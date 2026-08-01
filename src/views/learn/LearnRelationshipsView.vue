<script setup lang="ts">
/**
 * LearnRelationshipsView — expanded from the former /relation-types.
 *
 * Three sections:
 *   1. Bilateral relations (one-to-one) — grouped by category.
 *   2. Partitive hyperedge — card + per-dimension breakdown (presence,
 *      count, delimiting) anchored in ISO 704:2022 §5.5.4.3.1.
 *   3. General hyperedge — card + criterion + thick/thin hierarchy
 *      anchored in ISO 704:2022 §5.5.4.2 + §5.6.3.
 *
 * Sphere legend labels deep-link here via `#<type>` anchors
 * (e.g. `#__generic__`, `#__partitive__`, `#broader_generic`).
 */
import { computed } from 'vue';
import { useI18n } from '../../i18n';
import {
  RELATIONSHIP_CATEGORIES,
  relationshipLabel,
  relationshipDefinition,
} from '../../utils/relationship-categories';
import LearnCard from '../../components/learn/LearnCard.vue';
import DimensionCard, { type DimensionValue } from '../../components/learn/DimensionCard.vue';
import HyperedgeDiagram from '../../components/HyperedgeDiagram.vue';
import {
  NORMAL_STROKE_WIDTH,
  DELIMITING_STROKE_WIDTH,
} from '../../utils/partitive-multiplicity';

const { t } = useI18n();

const bilateralCategories = computed(() =>
  RELATIONSHIP_CATEGORIES.map(cat => ({
    id: cat.id,
    label: cat.label,
    color: cat.color,
    types: cat.types.map(type => ({
      type,
      label: relationshipLabel(type),
      definition: relationshipDefinition(type),
    })),
  })),
);

/* Per-dimension values for the partitive hyperedge (ISO 704:2022 §5.5.4.3.1). */
const presenceValues: readonly DimensionValue[] = [
  {
    value: 'required',
    label: t('learn.dimensions.presence.required.label'),
    meaning: t('learn.dimensions.presence.required.meaning'),
  },
  {
    value: 'optional',
    label: t('learn.dimensions.presence.optional.label'),
    meaning: t('learn.dimensions.presence.optional.meaning'),
  },
];

const countValues: readonly DimensionValue[] = [
  {
    value: 'exactly_one',
    label: t('learn.dimensions.count.exactly_one.label'),
    meaning: t('learn.dimensions.count.exactly_one.meaning'),
  },
  {
    value: 'at_least_one',
    label: t('learn.dimensions.count.at_least_one.label'),
    meaning: t('learn.dimensions.count.at_least_one.meaning'),
  },
  {
    value: 'multiple',
    label: t('learn.dimensions.count.multiple.label'),
    meaning: t('learn.dimensions.count.multiple.meaning'),
  },
];

const delimitingValues: readonly DimensionValue[] = [
  {
    value: 'false',
    label: t('learn.dimensions.delimiting.false.label'),
    meaning: t('learn.dimensions.delimiting.false.meaning'),
  },
  {
    value: 'true',
    label: t('learn.dimensions.delimiting.true.label'),
    meaning: t('learn.dimensions.delimiting.true.meaning'),
  },
];

const validCombinations = [
  {
    description: t('learn.dimensions.combo.compulsory'),
    uml: '1..1',
    model: 'required + exactly_one',
    svg: '<svg width="44" height="14"><line x1="2" y1="7" x2="42" y2="7" stroke="currentColor" stroke-width="1.5"/></svg>',
  },
  {
    description: t('learn.dimensions.combo.atLeastOne'),
    uml: '1..*',
    model: 'required + at_least_one',
    svg: '<svg width="44" height="14"><line x1="2" y1="5" x2="42" y2="5" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="9" x2="42" y2="9" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/></svg>',
  },
  {
    description: t('learn.dimensions.combo.optional'),
    uml: '0..1',
    model: 'optional + exactly_one',
    svg: '<svg width="44" height="14"><line x1="2" y1="7" x2="42" y2="7" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/></svg>',
  },
  {
    description: t('learn.dimensions.combo.optionalMultiple'),
    uml: '0..*',
    model: 'optional + multiple',
    svg: '<svg width="44" height="14"><line x1="2" y1="5" x2="42" y2="5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><line x1="2" y1="9" x2="42" y2="9" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/></svg>',
  },
  {
    description: t('learn.dimensions.combo.compulsoryMultiple'),
    uml: '2..*',
    model: 'required + multiple',
    svg: '<svg width="44" height="14"><line x1="2" y1="5" x2="42" y2="5" stroke="currentColor" stroke-width="1.5"/><line x1="2" y1="9" x2="42" y2="9" stroke="currentColor" stroke-width="1.5"/></svg>',
  },
];
</script>

<template>
  <div class="learn-relationships max-w-5xl mx-auto px-4 py-8">
    <header class="mb-8">
      <h1 class="text-3xl font-serif text-ink-800 dark:text-ink-50 mb-2">
        {{ t('learn.relationships.title') }}
      </h1>
      <p class="text-ink-500 dark:text-ink-300 max-w-3xl">{{ t('learn.relationships.intro') }}</p>
    </header>

    <!-- ── Bilateral relations ────────────────────────────────────── -->
    <section class="mb-12" :aria-label="t('learn.relationships.bilateralSection')">
      <h2 class="text-xl font-semibold text-ink-700 dark:text-ink-100 mb-4 border-b border-ink-100 dark:border-ink-700 pb-2">
        {{ t('learn.relationships.bilateralSection') }}
      </h2>
      <p class="text-sm text-ink-500 dark:text-ink-400 mb-4">
        {{ t('learn.relationships.bilateralIntro') }}
      </p>
      <div class="space-y-4">
        <article v-for="cat in bilateralCategories" :key="cat.id" class="card p-4">
          <header class="flex items-center gap-2 mb-3">
            <span :class="['text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded', cat.color]">
              {{ cat.label }}
            </span>
            <span class="text-xs text-ink-400">{{ cat.types.length }}</span>
          </header>
          <ul class="space-y-2">
            <li v-for="item in cat.types" :key="item.type" :id="item.type" class="bilateral-row scroll-mt-20">
              <div class="flex items-baseline gap-2 flex-wrap">
                <span class="font-medium text-ink-800 dark:text-ink-100">{{ item.label }}</span>
                <code class="text-xs text-ink-400 dark:text-ink-500 font-mono">{{ item.type }}</code>
              </div>
              <p v-if="item.definition" class="text-sm text-ink-600 dark:text-ink-300 mt-0.5">
                {{ item.definition }}
              </p>
            </li>
          </ul>
        </article>
      </div>
    </section>

    <!-- ── Partitive hyperedge ────────────────────────────────────── -->
    <section class="mb-12" :aria-label="t('learn.relationships.partitiveSection')">
      <h2 class="text-xl font-semibold text-ink-700 dark:text-ink-100 mb-4 border-b border-ink-100 dark:border-ink-700 pb-2">
        {{ t('learn.relationships.partitiveSection') }}
      </h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <LearnCard
          id="__partitive__"
          :title="t('learn.relationships.partitiveTitle')"
          iso-reference="ISO 704:2022 §5.5.4.3"
          learn-more-url="https://www.glossarist.org/model/partitive-relations"
        >
          <template #diagram>
            <HyperedgeDiagram kind="partitive" />
          </template>
          {{ t('learn.relationships.partitiveBody') }}
          <template #example>
            {{ t('learn.example') }}: VIM 1.3 system of quantities
            — quantity equation (required, at_least_one), base quantity (required, multiple),
            derived quantity (required, at_least_one).
          </template>
        </LearnCard>
      </div>

      <h3 class="text-base font-semibold text-ink-700 dark:text-ink-100 mb-3">
        {{ t('learn.dimensions.sectionTitle') }}
      </h3>
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <DimensionCard
          id="partitive-presence"
          :name="t('learn.dimensions.presence.title')"
          iso-reference="ISO 704:2022 §5.5.4.3.1"
          :summary="t('learn.dimensions.presence.summary')"
          :values="presenceValues"
        >
          <template #visual="{ value }">
            <svg width="44" height="14" aria-hidden="true">
              <line x1="2" y1="7" x2="42" y2="7" stroke="currentColor" stroke-width="1.5"
                    :stroke-dasharray="value === 'optional' ? '4 3' : undefined" />
            </svg>
          </template>
        </DimensionCard>

        <DimensionCard
          id="partitive-count"
          :name="t('learn.dimensions.count.title')"
          iso-reference="ISO 704:2022 §5.5.4.3.1"
          :summary="t('learn.dimensions.count.summary')"
          :values="countValues"
        >
          <template #visual="{ value }">
            <svg width="44" height="14" aria-hidden="true">
              <line x1="2" y1="5" x2="42" y2="5" stroke="currentColor" stroke-width="1.5" />
              <line v-if="value !== 'exactly_one'" x1="2" y1="9" x2="42" y2="9" stroke="currentColor"
                    stroke-width="1.5" :stroke-dasharray="value === 'at_least_one' ? '4 3' : undefined" />
            </svg>
          </template>
        </DimensionCard>

        <DimensionCard
          id="partitive-delimiting"
          :name="t('learn.dimensions.delimiting.title')"
          iso-reference="ISO 704:2022 §5.5.4.3.1"
          :summary="t('learn.dimensions.delimiting.summary')"
          :values="delimitingValues"
        >
          <template #visual="{ value }">
            <svg width="44" height="14" aria-hidden="true">
              <line x1="2" y1="7" x2="42" y2="7" stroke="currentColor"
                    :stroke-width="value === 'true' ? DELIMITING_STROKE_WIDTH : NORMAL_STROKE_WIDTH" />
            </svg>
          </template>
        </DimensionCard>
      </div>

      <h3 class="text-base font-semibold text-ink-700 dark:text-ink-100 mt-6 mb-3">
        {{ t('learn.dimensions.combinationsTitle') }}
      </h3>
      <div class="card p-4 overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-ink-100 dark:border-ink-700 text-ink-500 dark:text-ink-400 text-xs uppercase tracking-wide">
              <th class="text-left py-2 pr-4">{{ t('learn.dimensions.combinationsDescription') }}</th>
              <th class="text-center py-2 px-2">UML</th>
              <th class="text-left py-2 px-2">{{ t('learn.dimensions.combinationsModel') }}</th>
              <th class="text-center py-2 pl-4">{{ t('learn.dimensions.combinationsVisual') }}</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-ink-100 dark:divide-ink-700">
            <tr v-for="combo in validCombinations" :key="combo.model">
              <td class="py-2 pr-4 text-ink-700 dark:text-ink-200">{{ combo.description }}</td>
              <td class="py-2 px-2 text-center font-mono text-ink-500 dark:text-ink-400">{{ combo.uml }}</td>
              <td class="py-2 px-2 font-mono text-xs text-ink-600 dark:text-ink-300">{{ combo.model }}</td>
              <td class="py-2 pl-4 text-center" v-html="combo.svg"></td>
            </tr>
            <tr class="opacity-50">
              <td class="py-2 pr-4 text-ink-500 dark:text-ink-400 italic">{{ t('learn.dimensions.invalidDescription') }}</td>
              <td class="py-2 px-2 text-center font-mono text-ink-400">—</td>
              <td class="py-2 px-2 font-mono text-xs text-ink-400">{{ t('learn.dimensions.invalidModel') }}</td>
              <td class="py-2 pl-4 text-center text-xs text-ink-400 italic">{{ t('learn.dimensions.invalidReason') }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <!-- ── General hyperedge ──────────────────────────────────────── -->
    <section :aria-label="t('learn.relationships.generalSection')">
      <h2 class="text-xl font-semibold text-ink-700 dark:text-ink-100 mb-4 border-b border-ink-100 dark:border-ink-700 pb-2">
        {{ t('learn.relationships.generalSection') }}
      </h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <LearnCard
          id="__generic__"
          :title="t('learn.relationships.generalTitle')"
          iso-reference="ISO 704:2022 §5.5.4.2"
          learn-more-url="https://www.glossarist.org/model/generic-relations"
        >
          <template #diagram>
            <HyperedgeDiagram kind="generic" />
          </template>
          {{ t('learn.relationships.generalBody') }}
          <template #example>
            {{ t('learn.example') }}: VIM 1.9 measurement unit
            — group criterion "by magnitude relationship" splits into
            multiple (1.17), submultiple (1.18), coherent derived (1.12).
          </template>
        </LearnCard>

        <div class="space-y-4">
          <LearnCard
            :title="t('learn.relationships.criterionTitle')"
            iso-reference="ISO 704:2022 §5.5.4.2 + §5.6.3"
          >
            {{ t('learn.relationships.criterionBody') }}
          </LearnCard>

          <LearnCard
            :title="t('learn.relationships.thickThinTitle')"
            iso-reference="ISO 704:2022 §5.6.3"
          >
            {{ t('learn.relationships.thickThinBody') }}
          </LearnCard>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.bilateral-row {
  scroll-margin-top: 5rem;
}
</style>
