import { defineStore } from 'pinia';
import { ref, computed, toRaw } from 'vue';
import { getFactory } from '../adapters/factory';
import type { DatasetAdapter } from '../adapters/DatasetAdapter';
import type { Manifest, ConceptDocument, SearchHit, GraphEdge } from '../adapters/types';
import { GraphEngine } from '../graph';

export const useVocabularyStore = defineStore('vocabulary', () => {
  // State
  const datasets = ref<Map<string, DatasetAdapter>>(new Map());
  const manifests = ref<Map<string, Manifest>>(new Map());
  const currentConcept = ref<ConceptDocument | null>(null);
  const currentRegisterId = ref<string>('');
  const currentConceptId = ref<string>('');
  const loading = ref(false);
  const error = ref<string | null>(null);
  const graph = ref(new GraphEngine());
  const conceptEdges = ref<GraphEdge[]>([]);
  const initialized = ref(false);

  // Graph reactivity: increment to trigger computed updates
  const graphVersion = ref(0);
  function touchGraph() { graphVersion.value++; }

  // Edge loading status
  const edgeStatus = ref<Record<string, { loaded: boolean; count: number }>>({});

  const factory = getFactory();

  // Computed
  const currentManifest = computed(() =>
    manifests.value.get(currentRegisterId.value)
  );

  const currentAdapter = computed(() =>
    datasets.value.get(currentRegisterId.value)
  );

  const datasetList = computed(() => {
    const list: { id: string; manifest: Manifest; adapter: DatasetAdapter }[] = [];
    for (const [id, adapter] of datasets.value) {
      const m = manifests.value.get(id);
      if (m) list.push({ id, manifest: m, adapter: adapter as DatasetAdapter });
    }
    return list;
  });

  // Actions
  async function discoverDatasets() {
    loading.value = true;
    error.value = null;
    try {
      const adapters = await factory.discoverDatasets('/datasets.json');
      for (const adapter of adapters) {
        datasets.value.set(adapter.registerId, adapter);
        if (adapter.manifest) {
          manifests.value.set(adapter.registerId, adapter.manifest);
        }
      }
      initialized.value = true;
    } catch (e: any) {
      error.value = `Failed to discover datasets: ${e.message}`;
    } finally {
      loading.value = false;
    }
  }

  async function loadDataset(registerId: string) {
    error.value = null;
    try {
      const adapter = await factory.loadDataset(registerId);
      datasets.value.set(registerId, adapter);
      if (adapter.manifest) {
        manifests.value.set(registerId, adapter.manifest);
      }

      // Load pre-computed edges (lightweight)
      await loadEdges(adapter);

      touchGraph();

      // Seed graph nodes lazily — don't block UI for large datasets
      seedGraphNodes(registerId, adapter);
    } catch (e: any) {
      error.value = `Failed to load dataset ${registerId}: ${e.message}`;
      throw e;
    }
  }

  function seedGraphNodes(registerId: string, adapter: DatasetAdapter, sync = false) {
    const entries = adapter.getConcepts();
    const uriBase = adapter.manifest?.uriBase ?? 'https://glossarist.org';

    if (sync) {
      for (const entry of entries) {
        if (!entry) continue;
        const uri = `${uriBase}/${registerId}/concept/${entry.id}`;
        graph.value.addNode({
          uri,
          register: registerId,
          conceptId: entry.id,
          designations: entry.eng ? { eng: entry.eng } : {},
          status: entry.status,
          loaded: false,
        });
      }
      touchGraph();
      return;
    }

    const batchSize = 500;
    let offset = 0;
    const schedule = typeof requestIdleCallback !== 'undefined'
      ? requestIdleCallback
      : (cb: () => void) => setTimeout(cb, 0);

    function processBatch() {
      const end = Math.min(offset + batchSize, entries.length);
      for (let i = offset; i < end; i++) {
        const entry = entries[i];
        if (!entry) continue;
        const uri = `${uriBase}/${registerId}/concept/${entry.id}`;
        graph.value.addNode({
          uri,
          register: registerId,
          conceptId: entry.id,
          designations: entry.eng ? { eng: entry.eng } : {},
          status: entry.status,
          loaded: false,
        });
      }
      offset = end;
      if (offset < entries.length) {
        schedule(processBatch);
      } else {
        touchGraph();
      }
    }

    schedule(processBatch);
  }

  async function loadAllGraphData() {
    const engine = toRaw(graph.value);
    const adapters = factory.getAdapters();

    await Promise.allSettled(adapters.map(async (adapter) => {
      try {
        const [nodeResult, edgeResult] = await Promise.allSettled([
          adapter.loadGraphNodes(),
          !edgeStatus.value[adapter.registerId]?.loaded
            ? adapter.loadEdgeIndex()
            : Promise.resolve([] as GraphEdge[]),
        ]);

        if (nodeResult.status === 'fulfilled') {
          const { uriPrefix, nodes } = nodeResult.value;
          for (const [id, term, lang, status] of nodes) {
            engine.addNode({
              uri: uriPrefix + id,
              register: adapter.registerId,
              conceptId: id,
              designations: term ? { [lang || 'eng']: term } : {},
              status,
              loaded: false,
            });
          }
        }

        if (edgeResult.status === 'fulfilled' && Array.isArray(edgeResult.value)) {
          for (const edge of edgeResult.value) {
            engine.addEdge(edge);
          }
          edgeStatus.value[adapter.registerId] = { loaded: true, count: edgeResult.value.length };
        }
      } catch {
        // Individual adapter failures are non-critical for graph view
      }
    }));

    touchGraph();
  }

  async function loadEdges(adapter: DatasetAdapter) {
    try {
      const edges = await adapter.loadEdgeIndex();
      for (const edge of edges) {
        // Mark source node as having edges
        graph.value.addEdge(edge);
      }
      edgeStatus.value[adapter.registerId] = { loaded: true, count: edges.length };
    } catch {
      edgeStatus.value[adapter.registerId] = { loaded: false, count: 0 };
    }
  }

  async function viewConcept(registerId: string, conceptId: string) {
    error.value = null;
    currentRegisterId.value = registerId;
    currentConceptId.value = conceptId;

    try {
      const adapter = datasets.value.get(registerId);
      if (!adapter) throw new Error(`Dataset ${registerId} not loaded`);

      const concept = await adapter.fetchConcept(conceptId);
      currentConcept.value = concept;

      // Extract and register edges for this specific concept
      const edges = adapter.extractEdges(concept);
      const uri = concept['@id'];

      // Update graph node with full data
      graph.value.addNode({
        uri,
        register: registerId,
        conceptId,
        designations: (() => {
          const d: Record<string, string> = {};
          const entry = adapter.getIndexEntry(conceptId);
          if (entry?.eng) d.eng = entry.eng;
          for (const [lang, lc] of Object.entries(concept['gl:localizedConcept'] || {})) {
            const preferred = lc['gl:designation']?.find(
              (dd: any) => dd['gl:normativeStatus'] === 'preferred'
            );
            if (preferred?.['gl:term']) d[lang] = preferred['gl:term'];
          }
          return d;
        })(),
        status: adapter.getIndexEntry(conceptId)?.status ?? 'unknown',
        loaded: true,
      });

      for (const edge of edges) {
        graph.value.addEdge(edge);
      }

      touchGraph();
      conceptEdges.value = graph.value.getEdges(uri);
    } catch (e: any) {
      error.value = `Failed to load concept ${conceptId}: ${e.message}`;
      currentConcept.value = null;
      throw e;
    }
  }

  async function navigateToUri(uri: string) {
    const resolved = factory.resolveUri(uri);
    if (!resolved) {
      error.value = `Cannot resolve URI: ${uri}`;
      return;
    }

    if (!datasets.value.has(resolved.adapter.registerId)) {
      await loadDataset(resolved.adapter.registerId);
    }

    try {
      await viewConcept(resolved.adapter.registerId, resolved.conceptId);
    } catch {
      // viewConcept already sets error.value
    }
  }

  async function searchAcrossDatasets(query: string, lang: string = 'eng'): Promise<SearchHit[]> {
    const hits: SearchHit[] = [];
    for (const adapter of datasets.value.values()) {
      if (adapter.index || adapter.manifest) {
        await adapter.ensureAllChunksLoaded();
        hits.push(...adapter.search(query, lang));
      }
    }
    return hits;
  }

  async function getRandomConcept(): Promise<{ registerId: string; conceptId: string } | null> {
    const loaded = [...datasets.value.values()].filter(a => a.index);
    if (!loaded.length) return null;
    const adapter = loaded[Math.floor(Math.random() * loaded.length)];
    const concepts = adapter.getConcepts() as (import('../adapters/types').ConceptSummary | undefined)[];
    const dense = concepts.filter((c): c is import('../adapters/types').ConceptSummary => c != null);
    if (!dense.length) return null;
    const pick = dense[Math.floor(Math.random() * dense.length)];
    return { registerId: adapter.registerId, conceptId: pick.id };
  }

  return {
    datasets,
    manifests,
    currentConcept,
    currentRegisterId,
    currentConceptId,
    loading,
    error,
    graph,
    graphVersion,
    conceptEdges,
    initialized,
    edgeStatus,
    currentManifest,
    currentAdapter,
    datasetList,
    discoverDatasets,
    loadDataset,
    viewConcept,
    navigateToUri,
    searchAcrossDatasets,
    loadAllGraphData,
    getRandomConcept,
  };
});
