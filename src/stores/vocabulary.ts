import { defineStore } from 'pinia';
import { ref, shallowRef, computed } from 'vue';
import { getFactory } from '../adapters/factory';
import type { DatasetAdapter } from '../adapters/DatasetAdapter';
import type { Manifest, SearchHit, GraphEdge } from '../adapters/types';
import type { Concept } from 'glossarist';
import { conceptUri } from '../adapters/model-bridge';
import { GraphEngine } from '../graph';
import { deduplicateSearchHits } from '../utils/search';

export const useVocabularyStore = defineStore('vocabulary', () => {
  // State
  const datasets = shallowRef<Map<string, DatasetAdapter>>(new Map());
  const manifests = ref<Map<string, Manifest>>(new Map());
  const currentConcept = ref<Concept | null>(null);
  const currentRegisterId = ref<string>('');
  const currentConceptId = ref<string>('');
  const loading = ref(false);
  const error = ref<string | null>(null);
  const graph = shallowRef(new GraphEngine());
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
      const adapters = await factory.discoverDatasets(`${import.meta.env.BASE_URL}datasets.json`);
      for (const adapter of adapters) {
        datasets.value.set(adapter.registerId, adapter);
        if (adapter.manifest) {
          manifests.value.set(adapter.registerId, adapter.manifest);
        }
      }
      initialized.value = true;
    } catch (e: unknown) {
      error.value = `Failed to discover datasets: ${e instanceof Error ? e.message : String(e)}`;
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

      touchGraph();
    } catch (e: unknown) {
      error.value = `Failed to load dataset ${registerId}: ${e instanceof Error ? e.message : String(e)}`;
      throw e;
    }
  }

  async function loadAllGraphData() {
    if (!initialized.value) {
      await discoverDatasets();
    }

    const engine = graph.value;
    const adapters = factory.getAdapters();

    await Promise.allSettled(adapters.map(async (adapter) => {
      try {
        const [nodeResult, edgeResult, domainResult] = await Promise.allSettled([
          adapter.loadGraphNodes(),
          !edgeStatus.value[adapter.registerId]?.loaded
            ? adapter.loadEdgeIndex()
            : Promise.resolve([] as GraphEdge[]),
          adapter.loadDomainNodes(),
        ]);

        if (nodeResult.status === 'fulfilled') {
          const { uriPrefix, nodes } = nodeResult.value;
          for (const [id, designations, status] of nodes) {
            engine.addNode({
              uri: uriPrefix + id,
              register: adapter.registerId,
              conceptId: id,
              designations: designations || {},
              status: status || 'unknown',
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

        if (domainResult.status === 'fulfilled') {
          for (const dn of domainResult.value) {
            engine.addNode(dn);
          }
        }
      } catch {
        // Individual adapter failures are non-critical for graph view
      }
    }));

    touchGraph();
  }

  async function loadEdges(adapter: DatasetAdapter) {
    try {
      const [edges, domainNodes] = await Promise.all([
        adapter.loadEdgeIndex(),
        adapter.loadDomainNodes(),
      ]);
      const engine = graph.value;
      for (const dn of domainNodes) {
        engine.addNode(dn);
      }
      for (const edge of edges) {
        engine.addEdge(edge);
      }
      edgeStatus.value[adapter.registerId] = { loaded: true, count: edges.length };
    } catch {
      edgeStatus.value[adapter.registerId] = { loaded: false, count: 0 };
    }
  }

  async function ensureEdgesForDataset(registerId: string) {
    const adapter = datasets.value.get(registerId);
    if (adapter && !edgeStatus.value[registerId]?.loaded) {
      await loadEdges(adapter);
    }

    const index = await factory.loadCrossRefIndex();
    const refs = index[registerId] || [];
    for (const refId of refs) {
      if (edgeStatus.value[refId]?.loaded) continue;
      const refAdapter = datasets.value.get(refId);
      if (!refAdapter) continue;
      await loadEdges(refAdapter);
    }
  }

  async function viewConcept(registerId: string, conceptId: string) {
    error.value = null;
    currentRegisterId.value = registerId;
    currentConceptId.value = conceptId;

    try {
      const adapter = datasets.value.get(registerId);
      if (!adapter) throw new Error(`Dataset ${registerId} not loaded`);

      // Fetch concept and cross-dataset edges in parallel
      const [concept] = await Promise.all([
        adapter.fetchConcept(conceptId),
        ensureEdgesForDataset(registerId),
      ]);
      currentConcept.value = concept;

      // Note: edges are loaded from the pre-built edges.json via ensureEdgesForDataset.
      // We do NOT call adapter.extractEdges(concept) here because that would duplicate
      // edges already present in edges.json, causing double-rendering of relations.
      const domainEdges = adapter.extractDomainEdges(concept);
      const uriBase = adapter.manifest?.uriBase || 'https://glossarist.org';
      const uri = conceptUri(concept, registerId, uriBase);

      const designations: Record<string, string> = {};
      const indexEntry = adapter.getIndexEntry(conceptId);
      if (indexEntry) {
        for (const [lang, term] of Object.entries(indexEntry.designations)) {
          if (term) designations[lang] = term;
        }
      }
      for (const lang of concept.languages) {
        const lc = concept.localization(lang);
        if (lc?.primaryDesignation) {
          designations[lang] = lc.primaryDesignation;
        }
      }

      const engine = graph.value;
      engine.addNode({
        uri,
        register: registerId,
        conceptId,
        designations,
        status: indexEntry?.status ?? 'unknown',
        loaded: true,
      });

      for (const edge of domainEdges) {
        engine.addEdge(edge);
        const existing = engine.getNode(edge.target);
        if (!existing || !existing.loaded) {
          engine.addNode({
            uri: edge.target,
            register: registerId,
            conceptId: '',
            designations: edge.label ? { eng: edge.label } : {},
            status: 'domain',
            loaded: true,
            nodeType: 'domain',
          });
        }
      }

      touchGraph();
      conceptEdges.value = [
        ...engine.getEdges(uri),
        ...engine.getIncomingEdges(uri),
      ];
    } catch (e: unknown) {
      error.value = `Failed to load concept ${conceptId}: ${e instanceof Error ? e.message : String(e)}`;
      currentConcept.value = null;
      throw e;
    }
  }

  async function navigateToUri(uri: string) {
    const resolution = factory.resolve(uri);

    if (resolution.type !== 'internal') {
      error.value = `Cannot resolve URI: ${uri}`;
      return;
    }

    if (!datasets.value.has(resolution.registerId)) {
      await loadDataset(resolution.registerId);
    }

    try {
      await viewConcept(resolution.registerId, resolution.conceptId);
    } catch {
      // viewConcept already sets error.value
    }
  }

  async function searchAcrossDatasets(query: string): Promise<SearchHit[]> {
    if (!initialized.value) {
      await discoverDatasets();
    }

    const MIN_RESULTS = 20;

    // Pass 1: search loaded data only
    const loadedHits: SearchHit[] = [];
    const unloadedAdapters: DatasetAdapter[] = [];

    for (const adapter of datasets.value.values()) {
      if (!adapter.manifest) continue;
      if (!adapter.index) {
        try {
          await adapter.loadIndex();
        } catch {
          continue;
        }
      }
      const hits = adapter.search(query);
      if (hits.length > 0) {
        loadedHits.push(...hits);
      } else {
        unloadedAdapters.push(adapter);
      }
    }

    const pass1 = deduplicateSearchHits(loadedHits);
    if (pass1.length >= MIN_RESULTS) return pass1;

    // Pass 2: load chunks lazily for datasets that found nothing in index
    let allHits = [...loadedHits];
    for (const adapter of unloadedAdapters) {
      if (deduplicateSearchHits(allHits).length >= MIN_RESULTS) break;
      try {
        await adapter.ensureAllChunksLoaded();
        const hits = adapter.search(query);
        allHits.push(...hits);
      } catch {
        // Skip datasets that fail to load
      }
    }

    return deduplicateSearchHits(allHits);
  }

  async function getRandomConcept(): Promise<{ registerId: string; conceptId: string } | null> {
    const loaded = [...datasets.value.values()].filter(a => a.index);
    if (!loaded.length) return null;
    const adapter = loaded[Math.floor(Math.random() * loaded.length)];
    const concepts = adapter.getConcepts();
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
