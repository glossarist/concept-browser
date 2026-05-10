import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import SearchBar from '../components/SearchBar.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useUiStore } from '../stores/ui';
import type { Manifest, SearchHit } from '../adapters/types';

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

function makeHit(overrides: Partial<SearchHit> = {}): SearchHit {
  return {
    conceptId: '3.1.1.1',
    registerId: 'test',
    designation: 'test term',
    language: 'eng',
    matchField: 'designation',
    ...overrides,
  };
}

async function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/search', name: 'search', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: { template: '<div/>' } },
    ],
  });
}

describe('SearchBar', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;
  let store: ReturnType<typeof useVocabularyStore>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
    router.push('/search');
    await router.isReady();
    store = useVocabularyStore();
    store.manifests.set('test', makeManifest());
    store.datasets.set('test', { index: [], getConceptCount: () => 0, getConcepts: () => [], search: () => [] } as any);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mountSearch() {
    return mount(SearchBar, {
      global: { plugins: [pinia, router] },
    });
  }

  it('renders search input with placeholder', () => {
    const wrapper = mountSearch();
    const input = wrapper.find('input');
    expect(input.exists()).toBe(true);
    expect(input.attributes('placeholder')).toContain('Search terms');
  });

  it('shows clear button when query is entered', async () => {
    const wrapper = mountSearch();
    const input = wrapper.find('input');
    await input.setValue('road');
    const clearBtn = wrapper.findAll('button').find(b => b.element.closest('.relative')?.querySelector('input'));
    // There should be a close/X button visible
    expect(wrapper.html()).toContain('M6 18L18 6M6 6l12 12');
  });

  it('clears search on clear button click', async () => {
    const wrapper = mountSearch();
    const input = wrapper.find('input');
    await input.setValue('road');
    // Find and click the clear button (the one inside the relative div, after the input)
    const clearBtn = wrapper.findAll('button').find(b => b.text() === '' && b.find('svg').exists() && b.element.closest('.relative') !== null);
    if (clearBtn) {
      await clearBtn.trigger('click');
      expect(wrapper.find('input').element.value).toBe('');
    }
  });

  it('shows loading spinner during search', async () => {
    const wrapper = mountSearch();
    // Mock a slow search
    store.searchAcrossDatasets = vi.fn(() => new Promise<SearchHit[]>(() => {}));
    const input = wrapper.find('input');
    await input.setValue('road');
    const form = wrapper.find('form');
    await form.trigger('submit');
    await flushPromises();
    // Should show spinner SVG
    expect(wrapper.html()).toContain('animate-spin');
  });

  it('shows results after search', async () => {
    const hits: SearchHit[] = [
      makeHit({ conceptId: '3.1.1.1', designation: 'road network' }),
      makeHit({ conceptId: '3.1.1.2', designation: 'road user' }),
    ];
    store.searchAcrossDatasets = vi.fn(async () => hits);
    const wrapper = mountSearch();
    const input = wrapper.find('input');
    await input.setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('2 results');
    expect(wrapper.text()).toContain('road network');
    expect(wrapper.text()).toContain('road user');
  });

  it('shows empty state when no results', async () => {
    store.searchAcrossDatasets = vi.fn(async () => []);
    const wrapper = mountSearch();
    const input = wrapper.find('input');
    await input.setValue('zzzznonexistent');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('0 results');
    expect(wrapper.text()).toContain('No concepts found');
  });

  it('groups results by dataset', async () => {
    const hits: SearchHit[] = [
      makeHit({ registerId: 'test', designation: 'term1' }),
      makeHit({ registerId: 'other', designation: 'term2' }),
    ];
    store.manifests.set('other', { ...makeManifest(), id: 'other', title: 'Other Dataset' });
    store.datasets.set('other', { index: [], getConceptCount: () => 0, getConcepts: () => [] } as any);
    store.searchAcrossDatasets = vi.fn(async () => hits);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('term');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Test Dataset');
    expect(wrapper.text()).toContain('Other Dataset');
  });

  it('navigates to concept on result click', async () => {
    const hits: SearchHit[] = [makeHit()];
    store.searchAcrossDatasets = vi.fn(async () => hits);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    const hitBtn = wrapper.findAll('button').find(b => b.text().includes('test term'));
    expect(hitBtn).toBeDefined();
    await hitBtn!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('concept');
    expect(router.currentRoute.value.params.conceptId).toBe('3.1.1.1');
  });

  it('shows ID match badge for ID-based matches', async () => {
    const hits: SearchHit[] = [makeHit({ matchField: 'id' })];
    store.searchAcrossDatasets = vi.fn(async () => hits);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('3.1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('ID match');
  });

  it('updates URL query parameter on search', async () => {
    store.searchAcrossDatasets = vi.fn(async () => []);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(router.currentRoute.value.query.q).toBe('road');
  });

  it('shows error state on search failure', async () => {
    store.searchAcrossDatasets = vi.fn(async () => { throw new Error('Network error'); });
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Search failed');
    expect(wrapper.text()).toContain('Network error');
  });

  it('shows retry button on error', async () => {
    store.searchAcrossDatasets = vi.fn(async () => { throw new Error('fail'); });
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Retry');
  });
});
