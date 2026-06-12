import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import { resetFactory, getFactory } from '../adapters/factory';
import ResolveView from '../views/ResolveView.vue';

const TEST_URI = 'https://glossarist.org/test/concept/1';

async function createTestRouter(uri = TEST_URI) {
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
    resetFactory();
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
    // Pre-seed the factory with a stub adapter so discoverDatasets is skipped
    const factory = getFactory();
    const adapter = { registerId: 'test', manifest: null };
    (factory as any).adapters.set('test', adapter);
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

  it('resolves the URI via the factory resolver', async () => {
    const factory = getFactory();
    factory.uriRouter.registerDataset('test', '', '', ['https://glossarist.org/test/*']);
    const resolution = factory.resolve(TEST_URI);
    expect(resolution.type).toBe('internal');
    expect(resolution).toHaveProperty('registerId', 'test');
    expect(resolution).toHaveProperty('conceptId', '1');
  });
});
