import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import SearchView from '../views/SearchView.vue';
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

async function createTestRouter(initialPath = '/search') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/search', name: 'search', component: { template: '<div/>' } },
    ],
  });
  router.push(initialPath);
  await router.isReady();
  return router;
}

describe('SearchView', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
    const store = useVocabularyStore();
    store.manifests.set('test', makeManifest());
    store.datasets.set('test', { index: [], getConceptCount: () => 0, getConcepts: () => [], search: () => [] } as any);
  });

  function mountView() {
    return mount(SearchView, {
      global: { plugins: [pinia, router], stubs: { SearchBar: true } },
    });
  }

  it('renders breadcrumb navigation', () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('Search');
  });

  it('renders SearchBar component', () => {
    const wrapper = mountView();
    expect(wrapper.findComponent({ name: 'SearchBar' }).exists()).toBe(true);
  });

  it('renders breadcrumb with Home link', () => {
    const wrapper = mountView();
    const homeLink = wrapper.findAll('a').find(a => a.text() === 'Home');
    expect(homeLink).toBeDefined();
  });
});
