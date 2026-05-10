import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AppFooter from '../components/AppFooter.vue';

async function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
    ],
  });
}

describe('AppFooter', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
    router.push('/');
    await router.isReady();
  });

  function mountFooter() {
    return mount(AppFooter, {
      global: { plugins: [pinia, router] },
    });
  }

  it('renders powered by text', () => {
    const wrapper = mountFooter();
    expect(wrapper.text()).toContain('Built with the');
    expect(wrapper.text()).toContain('Glossarist Concept Browser');
  });

  it('omits copyright when no config loaded', () => {
    const wrapper = mountFooter();
    expect(wrapper.text()).not.toContain('©');
  });

  it('links to GitHub repository', () => {
    const wrapper = mountFooter();
    const link = wrapper.findAll('a').find(a => a.text().includes('Glossarist Concept Browser'));
    expect(link).toBeDefined();
    expect(link!.attributes('href')).toContain('github.com');
  });
});
