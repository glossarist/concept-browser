import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import NewsView from '../views/NewsView.vue';

async function createTestRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/news', name: 'news', component: { template: '<div/>' } },
    ],
  });
  router.push('/news');
  await router.isReady();
  return router;
}

describe('NewsView', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
  });

  function mountNews() {
    return mount(NewsView, {
      global: { plugins: [pinia, router] },
    });
  }

  it('renders breadcrumb navigation', () => {
    const wrapper = mountNews();
    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('News');
  });

  it('renders News heading', () => {
    const wrapper = mountNews();
    expect(wrapper.text()).toContain('News');
  });

  it('shows loading skeleton initially', () => {
    const wrapper = mountNews();
    expect(wrapper.find('.animate-pulse').exists()).toBe(true);
  });

  it('shows empty state when no posts', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve([]) });
    const wrapper = mountNews();
    await flushPromises();
    expect(wrapper.text()).toContain('No news posts yet');
  });

  it('shows error state when fetch fails', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network error'));
    const wrapper = mountNews();
    await flushPromises();
    expect(wrapper.text()).toContain('Failed to load news posts');
  });

  it('renders posts when available', async () => {
    const posts = [
      { slug: 'test-post', title: 'Test Post', date: '2025-01-15', categories: ['release'], file: '/news/test-post.adoc', excerpt: 'A test excerpt.' },
    ];
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(posts) });
    const wrapper = mountNews();
    await flushPromises();
    expect(wrapper.text()).toContain('Test Post');
    expect(wrapper.text()).toContain('release');
    expect(wrapper.text()).toContain('A test excerpt.');
  });

  it('formats dates correctly', async () => {
    const posts = [
      { slug: 'dated', title: 'Dated', date: '2025-03-15', categories: [], file: '/news/dated.adoc', excerpt: '' },
    ];
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, json: () => Promise.resolve(posts) });
    const wrapper = mountNews();
    await flushPromises();
    expect(wrapper.text()).toContain('March 15, 2025');
  });
});
