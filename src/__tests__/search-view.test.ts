import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import SearchView from '../views/SearchView.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { createTestRouter, setupPinia, makeManifest, makeAdapterStub } from './test-helpers';

describe('SearchView', () => {
  let pinia: ReturnType<typeof setupPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = setupPinia();
    router = await createTestRouter('search', '/search');
    const store = useVocabularyStore();
    store.manifests.set('test', makeManifest());
    store.datasets.set('test', makeAdapterStub());
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
