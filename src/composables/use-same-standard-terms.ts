import { computed, shallowRef, watch } from 'vue';
import type { StandardsIndex } from '../adapters/standards-index';
import { useVocabularyStore } from '../stores/vocabulary';
import { useUiStore } from '../stores/ui';
import { collectStandardKeys } from '../utils/source-standard';

export interface SameStandardTerms {
  key: string;
  label: string;
  terms: { conceptId: string; designation: string }[];
}

// Share in-flight requests too, including when multiple panes mount together.
const indexes = new Map<string, Promise<StandardsIndex>>();

function loadIndex(url: string): Promise<StandardsIndex> {
  let pending = indexes.get(url);
  if (!pending) {
    pending = (async () => {
      const response = await fetch(url);
      return response.ok ? await response.json() as StandardsIndex : {};
    })().catch(() => {
      // A transient failure should allow a later mount to retry.
      indexes.delete(url);
      return {};
    });
    indexes.set(url, pending);
  }
  return pending;
}

/** Related terms from the lightweight index, without fetching other concepts. */
export function useSameStandardTerms(baseUrl: string = import.meta.env.BASE_URL) {
  const vocabulary = useVocabularyStore();
  const ui = useUiStore();
  const index = shallowRef<StandardsIndex>({});
  const staleConcept = shallowRef<typeof vocabulary.currentConcept>(null);

  watch(() => vocabulary.currentRegisterId, async (registerId, _previous, onCleanup) => {
    let active = true;
    onCleanup(() => { active = false; });
    index.value = {};
    // The store changes registers before replacing the concept; IDs may overlap.
    if (_previous !== undefined) staleConcept.value = vocabulary.currentConcept;
    if (!registerId) return;

    const loaded = await loadIndex(`${baseUrl}data/${registerId}/standards.json`);
    if (active) index.value = loaded;
  }, { immediate: true, flush: 'sync' });

  return computed<SameStandardTerms[]>(() => {
    const concept = vocabulary.currentConcept;
    if (!concept || concept === staleConcept.value) return [];

    return collectStandardKeys(concept).flatMap(key => {
      const standard = index.value[key];
      if (!standard) return [];

      return [{
        key,
        label: standard.label,
        terms: standard.conceptIds
          .filter(conceptId => conceptId !== concept.id)
          .map(conceptId => {
            const designations = vocabulary.currentAdapter?.getIndexEntry(conceptId)?.designations;
            return {
              conceptId,
              designation: designations?.[ui.selectedLang] || designations?.eng || conceptId,
            };
          }),
      }];
    });
  });
}
