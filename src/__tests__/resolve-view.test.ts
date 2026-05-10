import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';

const mockResolve = vi.fn(() => ({ type: 'unresolved' }));
const mockGetAdapters = vi.fn(() => []);

vi.mock('../adapters/factory', () => ({
  getFactory: () => ({
    getAdapters: mockGetAdapters,
    resolve: mockResolve,
  }),
}));

const storeMock = {
  discoverDatasets: vi.fn(),
  loadDataset: vi.fn(),
  datasets: new Map(),
  initialized: false,
};

vi.mock('../stores/vocabulary', () => ({
  useVocabularyStore: () => storeMock,
}));

import ResolveView from '../views/ResolveView.vue';

async function createTestRouter(uri = 'https://glossarist.org/test/concept/1') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: { template: '<div/>' } },
      { path: '/resolve/:uri(.*)', name: 'resolve', component: { template: '<div/>' } },
    ],
  });
  router.push(`/resolve/${encodeURIComponent(uri)}`);
  await router.isReady();
  return router;
}

describe('ResolveView', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
    mockResolve.mockReturnValue({ type: 'unresolved' });
    mockGetAdapters.mockReturnValue([]);
  });

  function mountResolve() {
    return mount(ResolveView, {
      global: { plugins: [pinia, router] },
    });
  }

  it('shows resolving message while loading', () => {
    const wrapper = mountResolve();
    expect(wrapper.text()).toContain('Resolving...');
  });

  it('shows error when concept not found', async () => {
    const wrapper = mountResolve();
    await flushPromises();
    expect(wrapper.text()).toContain('Concept not found');
  });

  it('displays the URI being resolved', async () => {
    const wrapper = mountResolve();
    await flushPromises();
    expect(wrapper.text()).toContain('glossarist.org/test/concept/1');
  });

  it('shows return to home link on error', async () => {
    const wrapper = mountResolve();
    await flushPromises();
    const link = wrapper.findAll('a').find(a => a.text().includes('Return to home'));
    expect(link).toBeDefined();
  });

  it('calls factory resolve with the URI', async () => {
    mountResolve();
    await flushPromises();
    expect(mockResolve).toHaveBeenCalledWith('https://glossarist.org/test/concept/1');
  });
});
