import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import HomeView from '../views/HomeView.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import type { Manifest } from '../adapters/types';

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

async function createTestRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/dataset/:registerId', name: 'dataset', component: { template: '<div/>' } },
      { path: '/search', name: 'search', component: { template: '<div/>' } },
      { path: '/graph', name: 'graph', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: { template: '<div/>' } },
    ],
  });
  router.push('/');
  await router.isReady();
  return router;
}

describe('HomeView interactions', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
  });

  function mountHome() {
    return mount(HomeView, {
      global: { plugins: [pinia, router] },
    });
  }

  it('renders the welcome hero section', () => {
    const wrapper = mountHome();
    expect(wrapper.find('h1').text()).toContain('Glossarist');
  });

  it('renders Search, Graph View, and Surprise Me buttons', () => {
    const wrapper = mountHome();
    const buttons = wrapper.findAll('button');
    const texts = buttons.map(b => b.text());
    expect(texts.some(t => t.includes('Search'))).toBe(true);
    expect(texts.some(t => t.includes('Graph View'))).toBe(true);
    expect(texts.some(t => t.includes('Surprise Me'))).toBe(true);
  });

  it('navigates to search on Search button click', async () => {
    const wrapper = mountHome();
    const searchBtn = wrapper.findAll('button').find(b => b.text().includes('Search'));
    await searchBtn!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('search');
  });

  it('navigates to graph on Graph View button click', async () => {
    const wrapper = mountHome();
    const graphBtn = wrapper.findAll('button').find(b => b.text().includes('Graph View'));
    await graphBtn!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('graph');
  });

  it('shows stats counters', () => {
    const store = useVocabularyStore();
    store.manifests.set('test', makeManifest());
    store.datasets.set('test', { index: [], getConceptCount: () => 0 } as any);

    const wrapper = mountHome();
    expect(wrapper.text()).toContain('Datasets');
    expect(wrapper.text()).toContain('Concepts');
    expect(wrapper.text()).toContain('Languages');
  });

  it('shows a CTA card for a single dataset', () => {
    const store = useVocabularyStore();
    store.manifests.set('test', makeManifest());
    store.datasets.set('test', { index: [], getConceptCount: () => 0 } as any);

    const wrapper = mountHome();
    expect(wrapper.text()).toContain('Test Dataset');
    expect(wrapper.text()).toContain('Browse concepts');
  });

  it('navigates to dataset on CTA click', async () => {
    const store = useVocabularyStore();
    store.manifests.set('test', makeManifest());
    store.datasets.set('test', { index: [], getConceptCount: () => 0 } as any);

    const wrapper = mountHome();
    const cta = wrapper.findAll('button').find(b => b.text().includes('Browse concepts'));
    await cta!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('dataset');
    expect(router.currentRoute.value.params.registerId).toBe('test');
  });

  it('shows dataset cards for multiple datasets', () => {
    const store = useVocabularyStore();
    store.manifests.set('ds1', makeManifest({ id: 'ds1', title: 'Dataset One' }));
    store.manifests.set('ds2', makeManifest({ id: 'ds2', title: 'Dataset Two' }));
    store.datasets.set('ds1', { index: [], getConceptCount: () => 0 } as any);
    store.datasets.set('ds2', { index: [], getConceptCount: () => 0 } as any);

    const wrapper = mountHome();
    expect(wrapper.text()).toContain('Dataset One');
    expect(wrapper.text()).toContain('Dataset Two');
    expect(wrapper.text()).toContain('Available Datasets');
  });

  it('navigates to dataset on card click', async () => {
    const store = useVocabularyStore();
    store.manifests.set('ds1', makeManifest({ id: 'ds1', title: 'Dataset One' }));
    store.manifests.set('ds2', makeManifest({ id: 'ds2', title: 'Dataset Two' }));
    store.datasets.set('ds1', { index: [], getConceptCount: () => 0 } as any);
    store.datasets.set('ds2', { index: [], getConceptCount: () => 0 } as any);

    const wrapper = mountHome();
    const card = wrapper.findAll('button').find(b => b.text().includes('Dataset One'));
    await card!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('dataset');
    expect(router.currentRoute.value.params.registerId).toBe('ds1');
  });
});
