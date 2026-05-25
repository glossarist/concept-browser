import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import DatasetView from '../views/DatasetView.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import type { Manifest, ConceptSummary } from '../adapters/types';

function makeManifest(overrides: Partial<Manifest> = {}): Manifest {
  return {
    id: 'test',
    datasetUri: 'https://glossarist.org/test/concept',
    title: 'Test Dataset',
    description: 'A test dataset',
    owner: 'ISO',
    baseUrl: '/data/test',
    languages: ['eng', 'fra'],
    conceptCount: 100,
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

function makeConcepts(count: number): ConceptSummary[] {
  return Array.from({ length: count }, (_, i) => ({
    id: String(i + 1),
    designations: { eng: `term ${i + 1}` },
    eng: `term ${i + 1}`,
    status: i % 10 === 0 ? 'superseded' : 'valid',
  }));
}

function makeAdapter(concepts: ConceptSummary[] = []) {
  const dense = concepts.filter(Boolean);
  return {
    registerId: 'test',
    index: dense,
    manifest: null,
    getConceptCount: () => dense.length,
    getConcepts: () => dense,
    isRangeLoaded: () => true,
    ensureChunksForRange: async () => {},
    ensureAllChunksLoaded: async () => {},
    getAdjacentConcepts: () => ({ prev: null, next: null }),
  } as any;
}

async function createTestRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/dataset/:registerId', name: 'dataset', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/stats', name: 'stats', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/about', name: 'about', component: { template: '<div/>' } },
    ],
  });
  router.push('/dataset/test');
  await router.isReady();
  return router;
}

describe('DatasetView', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
  });

  function mountDataset(concepts: ConceptSummary[] = [], manifestOverrides: Partial<Manifest> = {}) {
    const store = useVocabularyStore();
    const manifest = makeManifest(manifestOverrides);
    store.manifests.set('test', manifest);
    store.datasets.set('test', makeAdapter(concepts));
    return mount(DatasetView, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test' },
    });
  }

  it('renders dataset title and description', async () => {
    const wrapper = mountDataset(makeConcepts(10));
    await flushPromises();
    expect(wrapper.text()).toContain('Test Dataset');
    expect(wrapper.text()).toContain('A test dataset');
  });

  it('shows concept count badge', async () => {
    const wrapper = mountDataset(makeConcepts(100));
    await flushPromises();
    expect(wrapper.text()).toContain('100 concepts');
  });

  it('shows language count badge', async () => {
    const wrapper = mountDataset(makeConcepts(10));
    await flushPromises();
    expect(wrapper.text()).toContain('2 languages');
  });

  it('shows owner badge', async () => {
    const wrapper = mountDataset(makeConcepts(10));
    await flushPromises();
    expect(wrapper.text()).toContain('ISO');
  });

  it('shows concept cards for loaded concepts', async () => {
    const wrapper = mountDataset(makeConcepts(3));
    await flushPromises();
    expect(wrapper.text()).toContain('term 1');
    expect(wrapper.text()).toContain('term 2');
    expect(wrapper.text()).toContain('term 3');
  });

  it('paginates at 50 concepts per page', async () => {
    const wrapper = mountDataset(makeConcepts(120));
    await flushPromises();
    // Should show 50 on first page
    expect(wrapper.text()).toContain('term 1');
    expect(wrapper.text()).not.toContain('term 51');
    // Should show pagination
    expect(wrapper.text()).toContain('Prev');
    expect(wrapper.text()).toContain('Next');
  });

  it('shows correct page count in pagination', async () => {
    const wrapper = mountDataset(makeConcepts(120));
    await flushPromises();
    // 120 / 50 = 3 pages (ceil)
    const pageButtons = wrapper.findAll('button').filter(b => /^\d+$/.test(b.text().trim()));
    const pageNumbers = pageButtons.map(b => parseInt(b.text().trim()));
    expect(pageNumbers).toContain(1);
    expect(pageNumbers).toContain(3);
  });

  it('filters concepts by term', async () => {
    const concepts: ConceptSummary[] = [
      { id: '1', designations: { eng: 'road network' }, eng: 'road network', status: 'valid' },
      { id: '2', designations: { eng: 'bridge design' }, eng: 'bridge design', status: 'valid' },
      { id: '3', designations: { eng: 'road user' }, eng: 'road user', status: 'valid' },
    ];
    const wrapper = mountDataset(concepts);
    await flushPromises();
    const input = wrapper.find('input[aria-label="Filter concepts"]');
    await input.setValue('road');
    await flushPromises();
    expect(wrapper.text()).toContain('road network');
    expect(wrapper.text()).toContain('road user');
    expect(wrapper.text()).not.toContain('bridge design');
  });

  it('filters concepts by ID', async () => {
    const concepts: ConceptSummary[] = [
      { id: '3.1.1.1', designations: { eng: 'term one' }, eng: 'term one', status: 'valid' },
      { id: '3.1.1.2', designations: { eng: 'term two' }, eng: 'term two', status: 'valid' },
    ];
    const wrapper = mountDataset(concepts);
    await flushPromises();
    const input = wrapper.find('input[aria-label="Filter concepts"]');
    await input.setValue('3.1.1.1');
    await flushPromises();
    expect(wrapper.text()).toContain('term one');
    expect(wrapper.text()).not.toContain('term two');
  });

  it('shows empty state when filter matches nothing', async () => {
    const wrapper = mountDataset(makeConcepts(5));
    await flushPromises();
    const input = wrapper.find('input[aria-label="Filter concepts"]');
    await input.setValue('zzzznonexistent');
    await flushPromises();
    expect(wrapper.text()).toContain('No concepts match your filter');
  });

  it('shows clear filter button on empty state', async () => {
    const wrapper = mountDataset(makeConcepts(5));
    await flushPromises();
    const input = wrapper.find('input[aria-label="Filter concepts"]');
    await input.setValue('zzzznonexistent');
    await flushPromises();
    expect(wrapper.text()).toContain('Clear filter');
  });

  it('shows links to stats and about pages', async () => {
    const wrapper = mountDataset(makeConcepts(5));
    await flushPromises();
    expect(wrapper.text()).toContain('Statistics');
    expect(wrapper.text()).toContain('About');
  });

  it('shows bulk downloads when manifest has bulkFormats', async () => {
    const wrapper = mountDataset(makeConcepts(5), {
      bulkFormats: [
        { file: 'all.ttl', format: 'turtle', size: 1024 },
        { file: 'all.jsonld', format: 'jsonld', size: 2048 },
      ],
    });
    await flushPromises();
    expect(wrapper.text()).toContain('Download');
    expect(wrapper.text()).toContain('1.0 KB');
  });

  it('shows 0 of N concepts in filter count', async () => {
    const wrapper = mountDataset(makeConcepts(10));
    await flushPromises();
    const input = wrapper.find('input[aria-label="Filter concepts"]');
    await input.setValue('term 5');
    await flushPromises();
    expect(wrapper.text()).toContain('of 10 concepts');
  });

  it('disables Prev on first page', async () => {
    const wrapper = mountDataset(makeConcepts(120));
    await flushPromises();
    const prevBtn = wrapper.findAll('button').find(b => b.text().includes('Prev'));
    expect(prevBtn).toBeDefined();
    expect(prevBtn!.attributes('disabled')).toBeDefined();
  });
});
