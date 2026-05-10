import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import GraphView from '../views/GraphView.vue';
import { useVocabularyStore } from '../stores/vocabulary';

async function createTestRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/graph', name: 'graph', component: { template: '<div/>' } },
    ],
  });
  router.push('/graph');
  await router.isReady();
  return router;
}

describe('GraphView', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
  });

  function mountGraph() {
    return mount(GraphView, {
      global: {
        plugins: [pinia, router],
        stubs: { GraphPanel: true },
      },
    });
  }

  it('renders breadcrumb navigation', () => {
    const wrapper = mountGraph();
    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('Graph View');
  });

  it('shows loading spinner initially', () => {
    const wrapper = mountGraph();
    expect(wrapper.find('.animate-spin').exists()).toBe(true);
    expect(wrapper.text()).toContain('Loading graph data');
  });

  it('renders GraphPanel after loading', async () => {
    const wrapper = mountGraph();
    await flushPromises();
    expect(wrapper.findComponent({ name: 'GraphPanel' }).exists()).toBe(true);
  });

  it('shows edge count after loading', async () => {
    const wrapper = mountGraph();
    await flushPromises();
    expect(wrapper.text()).toContain('edges');
  });

  it('has full-height container', () => {
    const wrapper = mountGraph();
    const container = wrapper.find('.flex.flex-col');
    expect(container.exists()).toBe(true);
  });
});
