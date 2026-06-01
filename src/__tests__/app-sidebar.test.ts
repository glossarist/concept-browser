import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AppSidebar from '../components/AppSidebar.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useUiStore } from '../stores/ui';
import type { Manifest } from '../adapters/types';

function makeManifest(id = 'test'): Manifest {
  return {
    id,
    datasetUri: `https://glossarist.org/${id}/concept`,
    title: `Test ${id}`,
    description: 'A test dataset',
    owner: 'ISO',
    baseUrl: `/data/${id}`,
    languages: ['eng'],
    conceptCount: 50,
    conceptUrlTemplate: `/data/${id}/concepts/{id}.json`,
    indexUrl: `/data/${id}/index.json`,
    contextUrl: `/data/${id}/context.json`,
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

async function createTestRouter(initialPath = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/dataset/:registerId', name: 'dataset', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: { template: '<div/>' } },
      { path: '/search', name: 'search', component: { template: '<div/>' } },
      { path: '/graph', name: 'graph', component: { template: '<div/>' } },
    ],
  });
  router.push(initialPath);
  await router.isReady();
  return router;
}

describe('AppSidebar', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  function seedStore(datasets: string[] = ['test']) {
    const store = useVocabularyStore();
    for (const id of datasets) {
      store.manifests.set(id, makeManifest(id));
      store.datasets.set(id, { index: [], getConceptCount: () => 0, getConcepts: () => [] } as any);
    }
  }

  async function mountSidebar(initialPath = '/') {
    const router = await createTestRouter(initialPath);
    return mount(AppSidebar, {
      global: { plugins: [pinia, router], stubs: { NavIcon: true } },
    });
  }

  it('renders navigation section', async () => {
    seedStore();
    const wrapper = await mountSidebar();
    expect(wrapper.text()).toContain('Navigation');
  });

  it('renders dataset entries in sidebar', async () => {
    seedStore(['iso1', 'iso2']);
    const wrapper = await mountSidebar();
    expect(wrapper.text()).toContain('Test iso1');
    expect(wrapper.text()).toContain('Test iso2');
  });

  it('shows concept count for loaded datasets', async () => {
    seedStore();
    const wrapper = await mountSidebar();
    expect(wrapper.text()).toContain('50 concepts');
  });

  it('navigates to dataset on click', async () => {
    seedStore();
    const router = await createTestRouter('/');
    const wrapper = mount(AppSidebar, {
      global: { plugins: [pinia, router], stubs: { NavIcon: true } },
    });
    const dsBtn = wrapper.findAll('button').find(b => b.text().includes('Test test'));
    expect(dsBtn).toBeDefined();
    await dsBtn!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('dataset');
    expect(router.currentRoute.value.params.registerId).toBe('test');
  });

  it('closes sidebar on dataset click (mobile)', async () => {
    seedStore();
    const wrapper = await mountSidebar();
    const ui = useUiStore();
    ui.sidebarOpen = true;
    const dsBtn = wrapper.findAll('button').find(b => b.text().includes('Test test'));
    await dsBtn!.trigger('click');
    expect(ui.sidebarOpen).toBe(false);
  });

  it('shows mobile backdrop when sidebar open', async () => {
    seedStore();
    const wrapper = await mountSidebar();
    const ui = useUiStore();
    ui.sidebarOpen = true;
    await wrapper.vm.$nextTick();
    const backdrop = wrapper.find('.fixed.inset-0');
    expect(backdrop.exists()).toBe(true);
  });

  it('hides mobile backdrop when sidebar closed', async () => {
    seedStore();
    const wrapper = await mountSidebar();
    const ui = useUiStore();
    ui.sidebarOpen = false;
    await wrapper.vm.$nextTick();
    const backdrop = wrapper.find('.fixed.inset-0');
    expect(backdrop.exists()).toBe(false);
  });

  it('closes sidebar on backdrop click', async () => {
    seedStore();
    const wrapper = await mountSidebar();
    const ui = useUiStore();
    ui.sidebarOpen = true;
    await wrapper.vm.$nextTick();
    const backdrop = wrapper.find('.fixed.inset-0');
    await backdrop.trigger('click');
    expect(ui.sidebarOpen).toBe(false);
  });

  it('shows dataset-level nav when on dataset route', async () => {
    seedStore();
    const wrapper = await mountSidebar('/dataset/test');
    // The dataset nav section shows when currentManifest exists
    expect(wrapper.text()).toContain('Test test');
  });

});
