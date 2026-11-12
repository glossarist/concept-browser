import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createRouter, createMemoryHistory, RouterView } from 'vue-router';
import SearchView from '../views/SearchView.vue';
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
