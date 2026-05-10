import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import ContributorsView from '../views/ContributorsView.vue';
import { useSiteConfig } from '../config/use-site-config';

// Mock useSiteConfig so we can inject contributor data
vi.mock('../config/use-site-config', () => {
  let _config: any = {};
  return {
    useSiteConfig: () => ({ config: { value: _config } }),
    __setConfig: (c: any) => { _config = c; },
  };
});

async function createTestRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/contributors', name: 'contributors', component: { template: '<div/>' } },
    ],
  });
  router.push('/contributors');
  await router.isReady();
  return router;
}

describe('ContributorsView', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
  });

  function mountContributors() {
    return mount(ContributorsView, {
      global: { plugins: [pinia, router] },
    });
  }

  it('renders breadcrumb navigation', () => {
    const wrapper = mountContributors();
    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('Contributors');
  });

  it('renders Contributors heading', () => {
    const wrapper = mountContributors();
    expect(wrapper.text()).toContain('Contributors');
  });

  it('shows empty state when no contributors', () => {
    const wrapper = mountContributors();
    expect(wrapper.text()).toContain('No contributor information available');
  });

  it('shows contributors table when data present', async () => {
    const { __setConfig } = await import('../config/use-site-config') as any;
    __setConfig({
      contributors: [
        { name: 'Jane Doe', role: 'Editor', organization: 'ISO', email: 'jane@example.com', url: 'https://example.com' },
        { name: 'John Smith', role: 'Author', organization: 'IEC' },
      ],
    });
    const wrapper = mountContributors();
    expect(wrapper.text()).toContain('Jane Doe');
    expect(wrapper.text()).toContain('John Smith');
    expect(wrapper.text()).toContain('Editor');
    expect(wrapper.text()).toContain('ISO');
    expect(wrapper.text()).toContain('jane@example.com');
    expect(wrapper.text()).toContain('Author');
    expect(wrapper.text()).toContain('IEC');
  });

  it('links contributor name when URL present', async () => {
    const { __setConfig } = await import('../config/use-site-config') as any;
    __setConfig({
      contributors: [
        { name: 'Jane Doe', url: 'https://example.com' },
      ],
    });
    const wrapper = mountContributors();
    const link = wrapper.findAll('a').find(a => a.text() === 'Jane Doe');
    expect(link).toBeDefined();
    expect(link!.attributes('href')).toBe('https://example.com');
  });

  it('shows dash for missing role/org', async () => {
    const { __setConfig } = await import('../config/use-site-config') as any;
    __setConfig({
      contributors: [{ name: 'Anonymous' }],
    });
    const wrapper = mountContributors();
    const cells = wrapper.findAll('td');
    const dashCount = cells.filter(c => c.text() === '—');
    expect(dashCount.length).toBeGreaterThanOrEqual(2);
  });
});
