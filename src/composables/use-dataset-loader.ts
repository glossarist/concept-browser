import { ref, computed, onMounted, watch } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useSiteConfig } from '../config/use-site-config';

export function useDatasetLoader(registerId: () => string | undefined) {
  const store = useVocabularyStore();
  const { config } = useSiteConfig();
  const loading = ref(false);
  const localError = ref<string | null>(null);

  const resolvedId = computed(() => registerId() || config.value?.defaultDataset || '');

  async function ensureLoaded() {
    const id = resolvedId.value;
    if (!id) return;
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
  watch(resolvedId, ensureLoaded);

  return { loading, localError, ensureLoaded, resolvedId };
}
