import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import ConceptCard from '../components/ConceptCard.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import type { Manifest, ConceptSummary } from '../adapters/types';

function makeManifest(): Manifest {
  return {
    id: 'test',
    datasetUri: 'https://glossarist.org/test/concept',
    title: 'Test Dataset',
    description: 'A test dataset',
    owner: 'ISO',
    baseUrl: '/data/test',
    languages: ['eng', 'fra'],
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

function makeEntry(overrides: Partial<ConceptSummary> = {}): ConceptSummary {
  return { id: '3.1.1.1', eng: 'test term', status: 'valid', ...overrides };
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

describe('ConceptCard', () => {
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

  function mountCard(entry = makeEntry(), registerId = 'test') {
    return mount(ConceptCard, {
      global: { plugins: [pinia, router] },
      props: { entry, registerId },
    });
  }

  it('renders the English term as title', () => {
    const wrapper = mountCard();
    expect(wrapper.text()).toContain('test term');
  });

  it('renders the concept ID', () => {
    const wrapper = mountCard();
    expect(wrapper.text()).toContain('3.1.1.1');
  });

  it('falls back to ID when no English term', () => {
    const wrapper = mountCard(makeEntry({ eng: '' }));
    expect(wrapper.text()).toContain('3.1.1.1');
  });

  it('shows valid status badge', () => {
    const wrapper = mountCard();
    expect(wrapper.text()).toContain('valid');
  });

  it('shows superseded status with reduced opacity', () => {
    const wrapper = mountCard(makeEntry({ status: 'superseded' }));
    expect(wrapper.text()).toContain('superseded');
    expect(wrapper.find('button').classes()).toContain('opacity-70');
  });

  it('shows withdrawn status with reduced opacity', () => {
    const wrapper = mountCard(makeEntry({ status: 'withdrawn' }));
    expect(wrapper.text()).toContain('withdrawn');
    expect(wrapper.find('button').classes()).toContain('opacity-70');
  });

  it('navigates to concept page on click', async () => {
    const wrapper = mountCard();
    await wrapper.find('button').trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('concept');
    expect(router.currentRoute.value.params.registerId).toBe('test');
    expect(router.currentRoute.value.params.conceptId).toBe('3.1.1.1');
  });

  it('shows language count from manifest', () => {
    const wrapper = mountCard();
    expect(wrapper.text()).toContain('2 lang');
  });
});
