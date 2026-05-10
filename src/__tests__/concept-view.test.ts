import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import ConceptView from '../views/ConceptView.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import type { Manifest } from '../adapters/types';

function makeManifest(): Manifest {
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
  };
}

function makeAdapter(concept: any = null) {
  return {
    index: [],
    getConceptCount: () => 0,
    getConcepts: () => [],
    getAdjacentConcepts: () => ({ prev: null, next: null }),
    getConceptPosition: () => -1,
    ensureChunksForRange: () => Promise.resolve(),
    fetchConcept: () => Promise.resolve(concept),
    extractEdges: () => [],
    getIndexEntry: () => null,
  } as any;
}

async function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/dataset/:registerId', name: 'dataset', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: { template: '<div/>' } },
    ],
  });
}

describe('ConceptView', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
    router.push('/');
    await router.isReady();
    const store = useVocabularyStore();
    store.manifests.set('test', makeManifest());
    store.datasets.set('test', makeAdapter());
  });

  function mountConceptView(registerId = 'test', conceptId = '1') {
    return mount(ConceptView, {
      global: {
        plugins: [pinia, router],
        stubs: { ConceptDetail: true },
      },
      props: { registerId, conceptId },
    });
  }

  it('shows loading skeleton initially', () => {
    const wrapper = mountConceptView();
    expect(wrapper.find('.skeleton').exists()).toBe(true);
  });

  it('shows error when fetchConcept returns null', async () => {
    const wrapper = mountConceptView();
    await flushPromises();
    expect(wrapper.text()).toContain('Failed to load concept');
  });

  it('shows retry button on error', async () => {
    const wrapper = mountConceptView();
    await flushPromises();
    const retryBtn = wrapper.findAll('button').find(b => b.text() === 'Retry');
    expect(retryBtn).toBeDefined();
  });

  it('shows back to dataset link on error', async () => {
    const wrapper = mountConceptView();
    await flushPromises();
    const link = wrapper.findAll('a').find(a => a.text().includes('Back to dataset'));
    expect(link).toBeDefined();
  });

  it('renders ConceptDetail when concept loads', async () => {
    const concept = {
      '@id': 'https://glossarist.org/test/concept/1',
      '@type': 'gl:Concept',
    };
    const store = useVocabularyStore();
    store.datasets.set('test', makeAdapter(concept));

    const wrapper = mountConceptView();
    await flushPromises();
    expect(wrapper.findComponent({ name: 'ConceptDetail' }).exists()).toBe(true);
  });

  it('shows error when dataset not found', async () => {
    const store = useVocabularyStore();
    store.datasets.delete('test');
    store.manifests.delete('test');
    const wrapper = mountConceptView();
    await flushPromises();
    expect(wrapper.text()).toContain('Failed to load concept');
  });
});
