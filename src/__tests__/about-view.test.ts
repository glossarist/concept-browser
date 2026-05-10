import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AboutView from '../views/AboutView.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import type { Manifest } from '../adapters/types';

function makeManifest(): Manifest {
  return {
    id: 'test',
    datasetUri: 'https://glossarist.org/test/concept',
    title: 'Test Dataset',
    description: 'A test dataset for terminology',
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
    tags: ['terminology', 'iso'],
    lastUpdated: '2025-01-01',
    sourceRepo: 'https://github.com/glossarist/test-dataset',
    chunkSize: 1000,
    color: '#3366ff',
  };
}

async function createTestRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/dataset/:registerId', name: 'dataset', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/about', name: 'about', component: { template: '<div/>' } },
    ],
  });
  router.push('/dataset/test/about');
  await router.isReady();
  return router;
}

describe('AboutView', () => {
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

  function mountAbout() {
    return mount(AboutView, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test' },
    });
  }

  it('renders About heading', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('About');
  });

  it('shows description', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('A test dataset for terminology');
  });

  it('shows owner', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('ISO');
  });

  it('shows concept count', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('100');
  });

  it('shows language count', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('English');
    expect(wrapper.text()).toContain('French');
  });

  it('shows last updated date', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('2025-01-01');
  });

  it('shows source repo link', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('glossarist/test-dataset');
  });

  it('shows tags', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('terminology');
    expect(wrapper.text()).toContain('iso');
  });

  it('renders breadcrumb navigation', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('Test Dataset');
    expect(wrapper.text()).toContain('About');
  });

  it('shows schema version', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('1.0');
  });
});
