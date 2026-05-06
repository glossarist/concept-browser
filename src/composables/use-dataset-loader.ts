import { ref, onMounted, watch } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';

export function useDatasetLoader(registerId: () => string) {
  const store = useVocabularyStore();
  const loading = ref(false);
  const localError = ref<string | null>(null);

  async function ensureLoaded() {
    const id = registerId();
    const adapter = store.datasets.get(id);
    if (adapter?.index) return;
    loading.value = true;
    localError.value = null;
    try {
      await store.loadDataset(id);
    } catch (e: any) {
      localError.value = e.message || 'Failed to load dataset';
    }
    loading.value = false;
  }

  onMounted(ensureLoaded);
  watch(registerId, ensureLoaded);

  return { loading, localError, ensureLoaded };
}
