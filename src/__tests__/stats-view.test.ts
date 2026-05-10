import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import StatsView from '../views/StatsView.vue';
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
    languages: ['eng', 'fra', 'deu'],
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
    languageStats: {
      eng: { terms: 100, definitions: 95 },
      fra: { terms: 80, definitions: 70 },
      deu: { terms: 60, definitions: 50 },
    },
  };
}

async function createTestRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/dataset/:registerId', name: 'dataset', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/stats', name: 'stats', component: { template: '<div/>' } },
    ],
  });
  router.push('/dataset/test/stats');
  await router.isReady();
  return router;
}

describe('StatsView', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
    const store = useVocabularyStore();
    store.manifests.set('test', makeManifest());
    store.datasets.set('test', { index: [], getConceptCount: () => 0, getConcepts: () => [] } as any);
  });

  function mountStats() {
    return mount(StatsView, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test' },
    });
  }

  it('renders statistics heading', async () => {
    const wrapper = mountStats();
    await flushPromises();
    expect(wrapper.text()).toContain('Statistics');
  });

  it('shows total concept count', async () => {
    const wrapper = mountStats();
    await flushPromises();
    expect(wrapper.text()).toContain('100 concepts');
  });

  it('shows language count', async () => {
    const wrapper = mountStats();
    await flushPromises();
    expect(wrapper.text()).toContain('3 languages');
  });

  it('shows language stats table', async () => {
    const wrapper = mountStats();
    await flushPromises();
    expect(wrapper.text()).toContain('English');
    expect(wrapper.text()).toContain('French');
    expect(wrapper.text()).toContain('German');
  });

  it('shows term and definition counts', async () => {
    const wrapper = mountStats();
    await flushPromises();
    expect(wrapper.text()).toContain('100');
    expect(wrapper.text()).toContain('95');
    expect(wrapper.text()).toContain('80');
  });

  it('renders breadcrumb navigation', async () => {
    const wrapper = mountStats();
    await flushPromises();
    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('Test Dataset');
    expect(wrapper.text()).toContain('Statistics');
  });
});
