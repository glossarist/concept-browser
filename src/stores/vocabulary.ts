import { defineStore } from 'pinia';
import { ref, computed, toRaw } from 'vue';
import { getFactory } from '../adapters/factory';
import type { DatasetAdapter } from '../adapters/DatasetAdapter';
import type { Manifest, SearchHit, GraphEdge } from '../adapters/types';
import type { Concept } from 'glossarist';
import { conceptUri } from '../adapters/model-bridge';
import { GraphEngine } from '../graph';

export const useVocabularyStore = defineStore('vocabulary', () => {
  // State
  const datasets = ref<Map<string, DatasetAdapter>>(new Map());
  const manifests = ref<Map<string, Manifest>>(new Map());
  const currentConcept = ref<Concept | null>(null);
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

      // Load pre-computed edges (lightweight)
      await loadEdges(adapter);

      touchGraph();

      // Seed graph nodes lazily — don't block UI for large datasets
      seedGraphNodes(registerId, adapter);
    } catch (e: unknown) {
      error.value = `Failed to load dataset ${registerId}: ${e instanceof Error ? e.message : String(e)}`;
      throw e;
    }
  }

  function seedGraphNodes(registerId: string, adapter: DatasetAdapter, sync = false) {
    const entries = adapter.getConcepts();

    if (sync) {
      for (const entry of entries) {
        if (!entry) continue;
        graph.value.addNode({
          uri: factory.router.buildUri(registerId, entry.id),
          register: registerId,
          conceptId: entry.id,
          designations: entry.designations,
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
        graph.value.addNode({
          uri: factory.router.buildUri(registerId, entry.id),
          register: registerId,
          conceptId: entry.id,
          designations: entry.designations,
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
    if (!initialized.value) {
      await discoverDatasets();
    }

    const engine = toRaw(graph.value);
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
      for (const dn of domainNodes) {
        graph.value.addNode(dn);
      }
      for (const edge of edges) {
        graph.value.addEdge(edge);
      }
      edgeStatus.value[adapter.registerId] = { loaded: true, count: edges.length };
    } catch {
      edgeStatus.value[adapter.registerId] = { loaded: false, count: 0 };
    }
  }

  async function ensureAllEdgesLoaded() {
    for (const [id, adapter] of datasets.value) {
      if (!edgeStatus.value[id]?.loaded) {
        try {
          const edges = await adapter.loadEdgeIndex();
          for (const edge of edges) {
            graph.value.addEdge(edge);
          }
          edgeStatus.value[id] = { loaded: true, count: edges.length };
        } catch {
          edgeStatus.value[id] = { loaded: false, count: 0 };
        }
      }
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
      const domainEdges = adapter.extractDomainEdges(concept);
      const uriBase = adapter.manifest?.uriBase || 'https://glossarist.org';
      const uri = conceptUri(concept, registerId, uriBase);

      // Update graph node with full data
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

      graph.value.addNode({
        uri,
        register: registerId,
        conceptId,
        designations,
        status: indexEntry?.status ?? 'unknown',
        loaded: true,
      });

      for (const edge of edges) {
        graph.value.addEdge(edge);
      }

      for (const edge of domainEdges) {
        graph.value.addEdge(edge);
        const existing = graph.value.getNode(edge.target);
        if (!existing || !existing.loaded) {
          graph.value.addNode({
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

      // Ensure edges from all datasets are loaded for cross-dataset supersession
      await ensureAllEdgesLoaded();

      touchGraph();
      conceptEdges.value = [
        ...graph.value.getEdges(uri),
        ...graph.value.getIncomingEdges(uri),
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

    const allHits: SearchHit[] = [];
    for (const adapter of datasets.value.values()) {
      if (adapter.manifest) {
        if (!adapter.index) {
          await adapter.loadIndex();
        }
        await adapter.ensureAllChunksLoaded();
        allHits.push(...adapter.search(query));
      }
    }

    // Deduplicate: keep the best hit per (registerId, conceptId)
    const best = new Map<string, SearchHit>();
    for (const hit of allHits) {
      const key = `${hit.registerId}:${hit.conceptId}`;
      const existing = best.get(key);
      if (!existing) {
        best.set(key, hit);
      } else {
        // Prefer designation match over id match, then prefer shorter language code (eng first)
        if (hit.matchField === 'designation' && existing.matchField === 'id') {
          best.set(key, hit);
        }
      }
    }
    return [...best.values()];
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
