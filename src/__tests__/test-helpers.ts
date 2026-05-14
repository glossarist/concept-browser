import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import type { Manifest, ConceptSummary, LocalizedConcept, SearchHit } from '../adapters/types';

// ── Manifest Factory ──────────────────────────────────────────────────

const STUB_COMPONENT = { template: '<div/>' };

export function makeManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    id: 'test',
    datasetUri: 'https://glossarist.org/test/concept',
    title: 'Test Dataset',
    description: 'A test dataset',
    owner: 'ISO',
    baseUrl: '/data/test',
    languages: ['eng'],
    conceptCount: 10,
    conceptUrlTemplate: '/data/test/concepts/{id}.json',
    indexUrl: '/data/test/index.json',
    contextUrl: '/data/test/context.json',
    uriBase: 'https://glossarist.org',
    status: 'published',
    schemaVersion: '1.0',
    tags: [],
    lastUpdated: '2025-01-01',
    sourceRepo: 'https://example.com/repo',
    chunkSize: 1000,
    color: '#3366ff',
    ...overrides,
  };
}

// ── Adapter Stub ──────────────────────────────────────────────────────

export interface AdapterStubOptions {
  concepts?: ConceptSummary[];
  search?: () => SearchHit[];
  fetchConcept?: () => Promise<any>;
  getAdjacentConcepts?: () => { prev: string | null; next: string | null };
  getConceptPosition?: () => number;
  isRangeLoaded?: () => boolean;
  ensureChunksForRange?: () => Promise<void>;
  ensureAllChunksLoaded?: () => Promise<void>;
  extractEdges?: () => any[];
  extractDomainEdges?: () => any[];
  getIndexEntry?: () => any;
}

export function makeAdapterStub(options: AdapterStubOptions = {}): any {
  return {
    index: options.concepts ?? [],
    manifest: null,
    registerId: 'test',
    getConceptCount: () => (options.concepts ?? []).length,
    getConcepts: () => options.concepts ?? [],
    search: options.search ?? (() => []),
    fetchConcept: options.fetchConcept ?? (() => Promise.resolve(null)),
    getAdjacentConcepts: options.getAdjacentConcepts ?? (() => ({ prev: null, next: null })),
    getConceptPosition: options.getConceptPosition ?? (() => -1),
    isRangeLoaded: options.isRangeLoaded ?? (() => true),
    ensureChunksForRange: options.ensureChunksForRange ?? (() => Promise.resolve()),
    ensureAllChunksLoaded: options.ensureAllChunksLoaded ?? (() => Promise.resolve()),
    extractEdges: options.extractEdges ?? (() => []),
    extractDomainEdges: options.extractDomainEdges ?? (() => []),
    getIndexEntry: options.getIndexEntry ?? (() => null),
  };
}

// ── Concept Data Factories ────────────────────────────────────────────

export function makeLocalizedConcept(overrides: Partial<LocalizedConcept> = {}): LocalizedConcept {
  return {
    '@id': 'https://glossarist.org/test/concept/1/eng',
    '@type': 'gl:LocalizedConcept',
    'gl:languageCode': 'eng',
    'gl:entryStatus': 'valid',
    ...overrides,
  };
}

export function makeConceptSummary(overrides: Partial<ConceptSummary> = {}): ConceptSummary {
  return {
    id: '1',
    eng: 'test concept',
    status: 'valid',
    ...overrides,
  };
}

export function makeSearchHit(overrides: Partial<SearchHit> = {}): SearchHit {
  return {
    conceptId: '1',
    registerId: 'test',
    designation: 'test',
    language: 'eng',
    matchField: 'designation',
    ...overrides,
  };
}

// ── Router Factory ────────────────────────────────────────────────────

export type RouteSet = 'minimal' | 'search' | 'dataset' | 'full' | 'resolve' | 'news' | 'pages' | 'contributors' | 'graph';

const ROUTE_SETS: Record<RouteSet, any[]> = {
  minimal: [{ path: '/', name: 'home', component: STUB_COMPONENT }],
  search: [
    { path: '/', name: 'home', component: STUB_COMPONENT },
    { path: '/search', name: 'search', component: STUB_COMPONENT },
  ],
  dataset: [
    { path: '/', name: 'home', component: STUB_COMPONENT },
    { path: '/dataset/:registerId', name: 'dataset', component: STUB_COMPONENT },
    { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: STUB_COMPONENT },
    { path: '/dataset/:registerId/stats', name: 'stats', component: STUB_COMPONENT },
    { path: '/dataset/:registerId/about', name: 'about', component: STUB_COMPONENT },
  ],
  full: [
    { path: '/', name: 'home', component: STUB_COMPONENT },
    { path: '/dataset/:registerId', name: 'dataset', component: STUB_COMPONENT },
    { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: STUB_COMPONENT },
    { path: '/dataset/:registerId/stats', name: 'stats', component: STUB_COMPONENT },
    { path: '/dataset/:registerId/about', name: 'about', component: STUB_COMPONENT },
    { path: '/search', name: 'search', component: STUB_COMPONENT },
    { path: '/graph', name: 'graph', component: STUB_COMPONENT },
  ],
  resolve: [
    { path: '/', name: 'home', component: STUB_COMPONENT },
    { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: STUB_COMPONENT },
    { path: '/resolve/:uri(.*)', name: 'resolve', component: STUB_COMPONENT },
  ],
  news: [
    { path: '/', name: 'home', component: STUB_COMPONENT },
    { path: '/news', name: 'news', component: STUB_COMPONENT },
  ],
  pages: [
    { path: '/', name: 'home', component: STUB_COMPONENT },
    { path: '/pages/:slug', name: 'page', component: STUB_COMPONENT },
  ],
  contributors: [
    { path: '/', name: 'home', component: STUB_COMPONENT },
    { path: '/contributors', name: 'contributors', component: STUB_COMPONENT },
  ],
  graph: [
    { path: '/', name: 'home', component: STUB_COMPONENT },
    { path: '/graph', name: 'graph', component: STUB_COMPONENT },
  ],
};

export async function createTestRouter(
  routeSet: RouteSet = 'minimal',
  initialPath = '/',
) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: ROUTE_SETS[routeSet],
  });
  router.push(initialPath);
  await router.isReady();
  return router;
}

// ── Pinia Setup ───────────────────────────────────────────────────────

export function setupPinia() {
  const pinia = createPinia();
  setActivePinia(pinia);
  return pinia;
}
