import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AppHeader from '../components/AppHeader.vue';
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

async function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/search', name: 'search', component: { template: '<div/>' } },
    ],
  });
}

describe('AppHeader', () => {
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
    store.datasets.set('test', { index: [], getConceptCount: () => 0, getConcepts: () => [] } as any);
  });

  function mountHeader() {
    return mount(AppHeader, {
      global: { plugins: [pinia, router] },
    });
  }

  it('renders logo/title text', () => {
    const wrapper = mountHeader();
    expect(wrapper.text()).toContain('Glossarist');
  });

  it('renders search input', () => {
    const wrapper = mountHeader();
    const input = wrapper.find('input[aria-label="Search concepts"]');
    expect(input.exists()).toBe(true);
  });

  it('renders mobile hamburger button', () => {
    const wrapper = mountHeader();
    const hamburger = wrapper.find('button[aria-label="Open navigation menu"]');
    expect(hamburger.exists()).toBe(true);
  });

  it('navigates home on logo click', async () => {
    const wrapper = mountHeader();
    const logoBtn = wrapper.findAll('button').find(b => b.text().includes('Glossarist'));
    expect(logoBtn).toBeDefined();
    await logoBtn!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('home');
  });

  it('navigates to search on form submit with query', async () => {
    const wrapper = mountHeader();
    const input = wrapper.find('input[aria-label="Search concepts"]');
    await input.setValue('road');
    const form = wrapper.find('form');
    await form.trigger('submit');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('search');
    expect(router.currentRoute.value.query.q).toBe('road');
  });

  it('does not navigate on empty search', async () => {
    const wrapper = mountHeader();
    const form = wrapper.find('form');
    await form.trigger('submit');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('home');
  });

  it('renders theme toggle button', () => {
    const wrapper = mountHeader();
    const themeBtn = wrapper.findAll('button').find(b =>
      b.attributes('aria-label')?.includes('Switch to')
    );
    expect(themeBtn).toBeDefined();
  });

  it('toggles theme on button click', async () => {
    const wrapper = mountHeader();
    const themeBtn = wrapper.findAll('button').find(b =>
      b.attributes('aria-label')?.includes('Switch to')
    );
    await themeBtn!.trigger('click');
    expect(wrapper.html()).toContain('M12 3v1m0 16v1m9-9h-1');
  });

  it('shows dataset count', () => {
    const wrapper = mountHeader();
    expect(wrapper.text()).toContain('1 datasets');
  });
});
