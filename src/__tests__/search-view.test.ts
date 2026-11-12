import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory, RouterView } from 'vue-router';
import SearchView from '../views/SearchView.vue';
import { DatasetAdapter } from '../adapters/DatasetAdapter';
import { useVocabularyStore } from '../stores/vocabulary';
import { useUiStore } from '../stores/ui';
import { createTestRouter, setupPinia, makeManifest, makeAdapterStub, makeSearchHit } from './test-helpers';

describe('SearchView', () => {
  let pinia: ReturnType<typeof setupPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = setupPinia();
    router = await createTestRouter('search', '/search');
    const store = useVocabularyStore();
    store.initialized = true;
    store.manifests.set('test', makeManifest());
    store.datasets.set('test', makeAdapterStub());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mountView() {
    return mount(SearchView, {
      global: { plugins: [pinia, router], stubs: { SearchBar: true } },
    });
  }

  async function mountRoutedSearch(path = '/search') {
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', name: 'home', component: { template: '<div>Home page</div>' } },
        { path: '/search', name: 'search', component: SearchView },
      ],
    });
    await router.push(path);
    await router.isReady();
    const wrapper = mount({ components: { RouterView }, template: '<RouterView />' }, {
      global: { plugins: [pinia, router] },
    });
    await flushPromises();
    return wrapper;
  }

  it('renders breadcrumb navigation', () => {
    const wrapper = mountView();
    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('Search');
  });

  it.each(['transient', 'persistent'] as const)('warns about a %s chunk failure and retries from the routed search', async (failure) => {
    const manifest = makeManifest({ conceptCount: 2001 });
    const adapter = new DatasetAdapter('test', '/data/test');
    adapter.manifest = manifest;
    const store = useVocabularyStore();
    store.manifests.set('test', manifest);
    store.datasets.set('test', adapter);

    const chunks = [
      Array.from({ length: 1000 }, (_, i) => ({
        id: i === 0 ? '276' : `first-${i}`,
        designations: { eng: i === 0 ? 'location' : `unrelated first ${i}` },
        status: i === 0 ? 'superseded' : 'valid',
      })),
      Array.from({ length: 1000 }, (_, i) => ({
        id: i === 0 ? '2345' : `second-${i}`,
        designations: { eng: i === 0 ? 'location' : `unrelated second ${i}` },
        status: 'valid',
      })),
      [{ id: '9999', designations: { eng: 'unrelated last entry' }, status: 'valid' }],
    ];
    let failedChunkRequests = 0;
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === '/data/test/index-meta.json') {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            registerId: 'test', schemaVersion: '1.0.0', conceptCount: 2001, chunkSize: 1000,
            chunks: chunks.map((concepts, i) => ({ file: `index-${i}.json`, count: concepts.length })),
          }),
        } as Response;
      }
      const chunkIndex = chunks.findIndex((_, i) => url === `/data/test/chunks/index-${i}.json`);
      if (chunkIndex < 0) throw new Error(`Unexpected fetch: ${url}`);
      if (chunkIndex === 1 && (++failedChunkRequests === 1 || failure === 'persistent')) {
        return { ok: false, status: 404 } as Response;
      }
      return { ok: true, status: 200, json: async () => ({ concepts: chunks[chunkIndex] }) } as Response;
    });
    vi.stubGlobal('fetch', fetchMock);

    const wrapper = await mountRoutedSearch('/search?q=location');
    try {
      expect((wrapper.find('input').element as HTMLInputElement).value).toBe('location');
      expect(wrapper.get('[role="alert"]').text()).toContain('Some results could not be loaded');
      expect(wrapper.get('.search-results').text()).toContain('276');
      expect(wrapper.get('.search-results').text()).toContain('superseded');
      expect(wrapper.get('.search-results').text()).not.toContain('2345');
      expect(wrapper.get('.search-results').text()).not.toContain('9999');

      const retry = wrapper.findAll('button').find(button => button.text() === 'Retry');
      expect(retry).toBeDefined();
      await retry!.trigger('click');
      await flushPromises();

      expect(failedChunkRequests).toBe(2);
      expect(router.currentRoute.value.fullPath).toBe('/search?q=location');
      expect(wrapper.get('.search-results').text()).toContain('276');
      expect(wrapper.get('.search-results').text()).not.toContain('9999');
      if (failure === 'transient') {
        expect(wrapper.get('.search-results').text()).toContain('2345');
        expect(wrapper.find('[role="alert"]').exists()).toBe(false);
      } else {
        expect(wrapper.get('.search-results').text()).not.toContain('2345');
        expect(wrapper.get('[role="alert"]').text()).toContain('Some results could not be loaded');
      }
      expect(fetchMock.mock.calls.filter(([url]) => url === '/data/test/chunks/index-0.json')).toHaveLength(1);
      expect(fetchMock.mock.calls.filter(([url]) => url === '/data/test/chunks/index-2.json')).toHaveLength(1);
    } finally {
      wrapper.unmount();
    }
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

  it('searches an initial query parameter and restores it when returning to search', async () => {
    const store = useVocabularyStore();
    const search = vi.fn(() => [makeSearchHit({ designation: 'Foo result' })]);
    store.datasets.set('test', makeAdapterStub({ search }));
    const wrapper = await mountRoutedSearch('/search?q=foo');
    const ui = useUiStore();
    await flushPromises();

    expect(search).toHaveBeenCalledWith('foo');
    expect(search).toHaveBeenCalledTimes(1);
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('foo');
    expect(wrapper.text()).toContain('Foo result');

    await router.push('/');
    await flushPromises();
    expect(wrapper.text()).toContain('Home page');
    expect(ui.searchQuery).toBe('');

    await router.push('/search');
    await flushPromises();
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');
    expect(ui.searchQuery).toBe('');
    expect(wrapper.text()).not.toContain('Foo result');
    expect(wrapper.find('.search-results').exists()).toBe(false);
    expect(search).toHaveBeenCalledTimes(1);

    await router.push('/');
    await flushPromises();
    await router.push('/search?q=bar');
    await flushPromises();
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('bar');
    expect(search).toHaveBeenLastCalledWith('bar');
    wrapper.unmount();
  });

  it('ignores a leftover store query when mounting without a query parameter', async () => {
    const ui = useUiStore();
    ui.searchQuery = 'stale';
    const search = vi.spyOn(useVocabularyStore(), 'searchAcrossDatasets');
    const wrapper = await mountRoutedSearch('/search');

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');
    expect(ui.searchQuery).toBe('');
    expect(search).not.toHaveBeenCalled();
    expect(wrapper.find('.search-results').exists()).toBe(false);
    wrapper.unmount();
  });

  it('clears the search when the query parameter is removed while mounted', async () => {
    const store = useVocabularyStore();
    const search = vi.fn(() => [makeSearchHit({ designation: 'Foo result' })]);
    store.datasets.set('test', makeAdapterStub({ search }));
    const wrapper = await mountRoutedSearch('/search?q=foo');
    const ui = useUiStore();
    await flushPromises();
    expect(wrapper.text()).toContain('Foo result');

    await router.replace('/search?q=bar');
    await flushPromises();
    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('bar');
    expect(search).toHaveBeenLastCalledWith('bar');

    await router.replace('/search');
    await flushPromises();

    expect((wrapper.find('input').element as HTMLInputElement).value).toBe('');
    expect(ui.searchQuery).toBe('');
    expect(wrapper.text()).not.toContain('Foo result');
    expect(wrapper.find('.search-results').exists()).toBe(false);
    wrapper.unmount();
  });

  it('does not let a pending search restore the URL after leaving search', async () => {
    const store = useVocabularyStore();
    let resolveSearch!: (hits: ReturnType<typeof makeSearchHit>[]) => void;
    const search = vi.spyOn(store, 'searchAcrossDatasets').mockImplementation(() => new Promise(resolve => {
      resolveSearch = resolve;
    }));
    const wrapper = await mountRoutedSearch('/search?q=foo');
    await flushPromises();
    expect(search).toHaveBeenCalledWith('foo');

    await router.push('/');
    resolveSearch([makeSearchHit({ designation: 'Late result' })]);
    await flushPromises();

    expect(router.currentRoute.value.fullPath).toBe('/');
    expect(wrapper.text()).toContain('Home page');
    expect(wrapper.text()).not.toContain('Late result');
    wrapper.unmount();
  });
});
