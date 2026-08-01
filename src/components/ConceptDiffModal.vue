<script setup lang="ts">
/**
 * ConceptDiffModal — modal wrapper around ConceptDiffView that fetches
 * the comparison concept on demand.
 *
 * Triggered from ConceptEditionRail when the user clicks "compare"
 * next to a non-current edition. The current concept (props.concept)
 * becomes the "new" side; the selected edition becomes the "old" side.
 */
import { ref, watch, computed } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import ConceptDiffView from './ConceptDiffView.vue';
import type { ConceptLikeData } from '../composables/use-concept-diff';
import type { Concept } from 'glossarist';
import { useI18n } from '../i18n';

const props = defineProps<{
  open: boolean;
  /** The concept currently being viewed. */
  currentConcept: Concept | null;
  currentRegisterId: string;
  /** Edition to compare against. */
  targetRegisterId: string;
  targetConceptId: string;
  targetLabel?: string;
}>();

const emit = defineEmits<{ close: [] }>();

const store = useVocabularyStore();
const { t } = useI18n();

const targetConcept = ref<Concept | null>(null);
const loadError = ref<string | null>(null);

function conceptToData(c: any, registerId: string): ConceptLikeData | null {
  if (!c) return null;
  const langs = c.languages ?? [];
  const localizations: Record<string, unknown> = {};
  for (const lang of langs) {
    const lc = c.localization(lang);
    if (lc) localizations[lang] = lc;
  }
  return {
    conceptId: c.id,
    uri: c.uri ?? undefined,
    status: c.status ?? undefined,
    languages: langs,
    localizations,
  };
}

const oldData = computed(() => conceptToData(targetConcept.value, props.targetRegisterId));
const newData = computed(() => conceptToData(props.currentConcept as any, props.currentRegisterId));

async function loadTarget() {
  if (!props.open || !props.targetRegisterId || !props.targetConceptId) return;
  loadError.value = null;
  targetConcept.value = null;
  try {
    const adapter = store.datasets.get(props.targetRegisterId);
    if (!adapter) throw new Error(`dataset ${props.targetRegisterId} not loaded`);
    if (!adapter.index) await store.loadDataset(props.targetRegisterId);
    targetConcept.value = await adapter.fetchConcept(props.targetConceptId);
  } catch (e: unknown) {
    loadError.value = e instanceof Error ? e.message : String(e);
  }
}

watch(() => [props.open, props.targetRegisterId, props.targetConceptId] as const, () => {
  if (props.open) loadTarget();
}, { immediate: true });
</script>

<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="open"
        class="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
        @click.self="$emit('close')"
      >
        <div class="bg-surface rounded-lg shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col">
          <header class="px-5 py-3 border-b border-ink-100 dark:border-ink-700 flex items-center justify-between">
            <h2 class="text-sm font-semibold text-ink-700 dark:text-ink-200">
              {{ t('concept.compareEditions') || 'Compare editions' }}
            </h2>
            <button
              type="button"
              class="text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
              @click="$emit('close')"
              :aria-label="t('common.close') || 'Close'"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </header>
          <div class="p-5 overflow-y-auto">
            <div v-if="loadError" class="card p-4 border-red-200 bg-red-50/50">
              <p class="text-sm text-red-700">{{ loadError }}</p>
            </div>
            <ConceptDiffView
              v-else
              :old-concept="oldData"
              :new-concept="newData"
              :old-label="targetLabel || targetRegisterId"
              :new-label="currentRegisterId"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
