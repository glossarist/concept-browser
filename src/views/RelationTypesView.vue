<script setup lang="ts">
/**
 * RelationTypesView — teaching page explaining every relation type
 * the app renders, grouped into:
 *
 *   1. Hyperedge relations (one-to-many decompositions)
 *      - partitive (rake diagram) — ISO 704:2022 §5.5.3
 *      - general  (pipe-and-thread diagram) — ISO 704:2022 §5.5.4
 *
 *   2. Bilateral relations (one-to-one) — grouped by category, labels
 *      and definitions pulled from the live ontology taxonomy. Adding
 *      a new type to src/data/taxonomies.json automatically flows
 *      through to this page (no code change).
 *
 * Sphere legend labels deep-link here via `#<type>` anchors
 * (e.g. `#__generic__`, `#__partitive__`, `#broader_generic`).
 */
import { computed } from 'vue';
import { useI18n } from '../i18n';
import {
  RELATIONSHIP_CATEGORIES,
  relationshipLabel,
  relationshipDefinition,
} from '../utils/relationship-categories';
import HyperedgeDiagram from '../components/HyperedgeDiagram.vue';

const { t } = useI18n();

interface HyperedgeCard {
  readonly anchor: string;
  readonly kind: 'partitive' | 'generic';
  readonly label: string;
  readonly iso: string;
  readonly definition: string;
  readonly example: { conceptId: string; description: string };
}

const HYPEREDGE_CARDS: readonly HyperedgeCard[] = [
  {
    anchor: '__partitive__',
    kind: 'partitive',
    label: 'partitive relation',
    iso: 'ISO 704:2022 §5.5.3',
    definition:
      'A whole/part decomposition. The comprehensive concept is the whole; each member is a part. Per-member multiplicity (presence × count) is encoded in the tooth stroke style — solid for required, dashed for optional, double-line for multiple or at-least-one, 3× width for delimiting members.',
    example: { conceptId: '1.3', description: 'system of quantities' },
  },
  {
    anchor: '__generic__',
    kind: 'generic',
    label: 'general relation',
    iso: 'ISO 704:2022 §5.5.4',
    definition:
      'A genus/species decomposition. The comprehensive concept is the genus; each member is a species (coordinate concept) differing along a shared dimension. The thick parent pipe carries the shared criterion (the dimension); thin direct threads radiate from a middle node to each member.',
    example: { conceptId: '1.9', description: 'measurement unit' },
  },
];

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
</script>

<template>
  <div class="relation-types-view max-w-5xl mx-auto px-4 py-8">
    <header class="mb-8">
      <h1 class="text-3xl font-serif text-ink-800 dark:text-ink-50 mb-2">
        {{ t('nav.relationTypes') }}
      </h1>
      <p class="text-ink-500 dark:text-ink-300">{{ t('relationTypes.intro') }}</p>
    </header>

    <!-- ── Hyperedge relations ─────────────────────────────────────── -->
    <section class="mb-12" :aria-label="t('relationTypes.hyperedgeSection')">
      <h2 class="text-xl font-semibold text-ink-700 dark:text-ink-100 mb-4 border-b border-ink-100 dark:border-ink-700 pb-2">
        {{ t('relationTypes.hyperedgeSection') }}
      </h2>
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <article
          v-for="card in HYPEREDGE_CARDS"
          :key="card.anchor"
          :id="card.anchor"
          class="hyperedge-card card p-5 scroll-mt-20"
        >
          <div class="flex items-baseline justify-between mb-3 gap-3">
            <h3 class="text-lg font-semibold text-ink-800 dark:text-ink-50">{{ card.label }}</h3>
            <span class="text-xs font-mono text-ink-400 dark:text-ink-500">{{ card.iso }}</span>
          </div>
          <div class="grid grid-cols-[auto_1fr] gap-4 items-start">
            <div class="diagram-frame bg-surface-alt dark:bg-ink-800 rounded-md p-2 border border-ink-100 dark:border-ink-700">
              <HyperedgeDiagram :kind="card.kind" />
            </div>
            <div>
              <p class="text-sm text-ink-600 dark:text-ink-200 mb-3">{{ card.definition }}</p>
              <p class="text-xs text-ink-400 dark:text-ink-400">
                {{ t('relationTypes.example') }}: VIM {{ card.example.conceptId }} — {{ card.example.description }}
              </p>
            </div>
          </div>
        </article>
      </div>
    </section>

    <!-- ── Bilateral relations ─────────────────────────────────────── -->
    <section :aria-label="t('relationTypes.bilateralSection')">
      <h2 class="text-xl font-semibold text-ink-700 dark:text-ink-100 mb-4 border-b border-ink-100 dark:border-ink-700 pb-2">
        {{ t('relationTypes.bilateralSection') }}
      </h2>
      <div class="space-y-6">
        <article
          v-for="cat in bilateralCategories"
          :key="cat.id"
          class="card p-4"
        >
          <header class="flex items-center gap-2 mb-3">
            <span :class="['text-xs font-semibold uppercase tracking-wide px-2 py-0.5 rounded', cat.color]">
              {{ cat.label }}
            </span>
            <span class="text-xs text-ink-400">{{ cat.types.length }}</span>
          </header>
          <ul class="space-y-2">
            <li
              v-for="item in cat.types"
              :key="item.type"
              :id="item.type"
              class="bilateral-row scroll-mt-20"
            >
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
  </div>
</template>

<style scoped>
.hyperedge-card {
  scroll-margin-top: 5rem;
}
.bilateral-row {
  scroll-margin-top: 5rem;
}
</style>
