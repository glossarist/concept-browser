import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import PageView from '../views/PageView.vue';

async function createTestRouter(path = '/pages/test-page') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/pages/:slug', name: 'page', component: { template: '<div/>' } },
    ],
  });
  router.push(path);
  await router.isReady();
  return router;
}

describe('PageView', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
  });

  function mountPage() {
    return mount(PageView, {
      global: { plugins: [pinia, router] },
    });
  }

  it('shows loading skeleton initially', () => {
    const wrapper = mountPage();
    expect(wrapper.find('.animate-pulse').exists()).toBe(true);
  });

  it('renders breadcrumb navigation', () => {
    const wrapper = mountPage();
    expect(wrapper.text()).toContain('Home');
  });

  it('shows page not found when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('Page Not Found');
    expect(wrapper.text()).toContain('test-page');
  });

  it('shows go home link on not found', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: false });
    const wrapper = mountPage();
    await flushPromises();
    const homeLink = wrapper.findAll('a').find(a => a.text() === 'Go Home');
    expect(homeLink).toBeDefined();
  });

  it('renders page content when loaded', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ title: 'About Us', html: '<p>Hello world</p>' }),
    });
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('About Us');
    expect(wrapper.text()).toContain('Hello world');
  });

  it('renders page title in breadcrumb', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ title: 'About Us', html: '<p>Content</p>' }),
    });
    const wrapper = mountPage();
    await flushPromises();
    const breadcrumb = wrapper.find('nav[aria-label="Breadcrumb"]');
    expect(breadcrumb.text()).toContain('About Us');
  });
});
