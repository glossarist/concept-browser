import { defineStore } from 'pinia';
import { ref, shallowRef, computed } from 'vue';
import { getFactory } from '../adapters/factory';
import type { DatasetAdapter } from '../adapters/DatasetAdapter';
import type { Manifest, SearchHit, GraphEdge } from '../adapters/types';
import type { Concept } from 'glossarist';
import { conceptUri } from '../adapters/model-bridge';
import { GraphEngine } from '../graph';
import { UriRouter } from '../adapters/UriRouter';
import { deduplicateSearchHits } from '../utils/search';
import { UnknownDatasetError } from '../errors';

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
      const newMap = new Map(datasets.value);
      for (const adapter of adapters) {
        newMap.set(adapter.registerId, adapter);
        if (adapter.manifest) {
          manifests.value.set(adapter.registerId, adapter.manifest);
        }
      }
      datasets.value = newMap;
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
      const newMap = new Map(datasets.value);
      newMap.set(registerId, adapter);
      datasets.value = newMap;
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

        if (nodeResult.status === 'fulfilled' && nodeResult.value.uriPrefix) {
          engine.addGraphNodes(nodeResult.value.uriPrefix, adapter.registerId, nodeResult.value.nodes);
        }

        if (edgeResult.status === 'fulfilled' && Array.isArray(edgeResult.value)) {
          engine.addEdges(edgeResult.value);
          edgeStatus.value[adapter.registerId] = { loaded: true, count: edgeResult.value.length };
        }

        if (domainResult.status === 'fulfilled') {
          engine.addDomainNodes(domainResult.value);
        }
      } catch {
        // Individual adapter failures are non-critical for graph view
      }
    }));

    touchGraph();
  }

  async function loadEdges(adapter: DatasetAdapter): Promise<GraphEdge[]> {
    try {
      const [edges, domainNodes, graphNodes] = await Promise.all([
        adapter.loadEdgeIndex(),
        adapter.loadDomainNodes(),
        adapter.loadGraphNodes(),
      ]);
      const engine = graph.value;
      engine.addDomainNodes(domainNodes);
      if (graphNodes.uriPrefix) {
        engine.addGraphNodes(graphNodes.uriPrefix, adapter.registerId, graphNodes.nodes);
      }
      engine.addEdges(edges);
      edgeStatus.value[adapter.registerId] = { loaded: true, count: edges.length };
      return edges;
    } catch {
      edgeStatus.value[adapter.registerId] = { loaded: false, count: 0 };
      return [];
    }
  }

  async function ensureEdgesForDataset(registerId: string) {
    const adapter = datasets.value.get(registerId);
    let loadedEdges: GraphEdge[] = [];
    if (adapter && !edgeStatus.value[registerId]?.loaded) {
      loadedEdges = await loadEdges(adapter);
    }

    // Load graph nodes for any target datasets referenced by this dataset's edges
    if (adapter && loadedEdges.length > 0) {
      const targetRegisters = new Set<string>();
      for (const edge of loadedEdges) {
        const parsed = UriRouter.parseUri(edge.target);
        if (parsed?.registerId && parsed.registerId !== registerId) {
          targetRegisters.add(parsed.registerId);
        }
      }
      await Promise.all([...targetRegisters].map(async (targetId) => {
        const targetAdapter = datasets.value.get(targetId);
        if (!targetAdapter) return;
        try {
          const gn = await targetAdapter.loadGraphNodes();
          if (gn.uriPrefix) {
            graph.value.addGraphNodes(gn.uriPrefix, targetId, gn.nodes);
          }
        } catch { /* non-critical */ }
      }));
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
      if (!adapter) throw UnknownDatasetError.make(registerId);

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
      const uriBase = adapter.manifest?.uriBase;
      if (!uriBase) throw new Error('vocabulary store: manifest.uriBase is required — set uriBase in site-config.yml');
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
      engine.seedConceptNode(uri, registerId, conceptId, designations, indexEntry?.status ?? 'unknown');
      engine.addDomainEdgesWithNodes(domainEdges, registerId);

      touchGraph();
      const related = engine.getRelated(uri);
      conceptEdges.value = [...related.outgoing, ...related.incoming];
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
    ensureEdgesForDataset,
    viewConcept,
    navigateToUri,
    searchAcrossDatasets,
    loadAllGraphData,
    getRandomConcept,
  };
});
