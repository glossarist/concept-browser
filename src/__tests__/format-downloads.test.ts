import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import FormatDownloads from '../components/FormatDownloads.vue';

async function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
    ],
  });
}

describe('FormatDownloads', () => {
  it('renders download links for known formats', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = await createTestRouter();
    const wrapper = mount(FormatDownloads, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test', conceptId: '3.1.1.1', formats: ['ttl', 'jsonld'] },
    });
    expect(wrapper.text()).toContain('Downloads');
    expect(wrapper.text()).toContain('Turtle RDF');
    expect(wrapper.text()).toContain('JSON-LD');
  });

  it('generates correct URLs', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = await createTestRouter();
    const wrapper = mount(FormatDownloads, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test', conceptId: '3.1.1.1', formats: ['ttl'] },
    });
    const link = wrapper.find('a');
    expect(link.attributes('href')).toBe('/data/test/concepts/3.1.1.1.ttl');
  });

  it('filters unknown formats', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = await createTestRouter();
    const wrapper = mount(FormatDownloads, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test', conceptId: '1', formats: ['ttl', 'unknown'] },
    });
    const links = wrapper.findAll('a');
    expect(links.length).toBe(1);
  });

  it('renders nothing when all formats are unknown', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = await createTestRouter();
    const wrapper = mount(FormatDownloads, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test', conceptId: '1', formats: ['unknown'] },
    });
    expect(wrapper.find('a').exists()).toBe(false);
  });

  it('renders nothing when formats array is empty', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = await createTestRouter();
    const wrapper = mount(FormatDownloads, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test', conceptId: '1', formats: [] },
    });
    expect(wrapper.find('a').exists()).toBe(false);
  });

  it('sets download attribute on links', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = await createTestRouter();
    const wrapper = mount(FormatDownloads, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test', conceptId: '3.1.1.1', formats: ['jsonld'] },
    });
    const link = wrapper.find('a');
    expect(link.attributes('download')).toBe('3.1.1.1.jsonld');
  });

  it('shows TBX-XML format', async () => {
    const pinia = createPinia();
    setActivePinia(pinia);
    const router = await createTestRouter();
    const wrapper = mount(FormatDownloads, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test', conceptId: '1', formats: ['tbx'] },
    });
    expect(wrapper.text()).toContain('TBX-XML');
  });
});
