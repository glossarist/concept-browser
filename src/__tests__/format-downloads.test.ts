import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
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

async function mountWithRouter(props: Partial<{ registerId: string; conceptId: string; formats: string[] }> = {}) {
  const router = await createTestRouter();
  return mount(FormatDownloads, {
    global: { plugins: [createPinia(), router] },
    props: { registerId: 'test', conceptId: '1', formats: [], ...props },
  });
}

describe('FormatDownloads', () => {
  beforeEach(() => {
    (import.meta.env as any).BASE_URL = '/';
  });

  it('renders download links for known per-concept formats', async () => {
    const wrapper = await mountWithRouter({ conceptId: '3.1.1.1', formats: ['ttl', 'jsonld'] });
    expect(wrapper.text()).toContain('Downloads');
    expect(wrapper.text()).toContain('Turtle');
    expect(wrapper.text()).toContain('JSON-LD');
  });

  it('generates URLs rooted at import.meta.env.BASE_URL', async () => {
    const wrapper = await mountWithRouter({ conceptId: '3.1.1.1', formats: ['ttl'] });
    expect(wrapper.find('a').attributes('href')).toBe('/data/test/concepts/3.1.1.1.ttl');
  });

  it('prefixes URLs with BASE_URL on subpath deployments', async () => {
    (import.meta.env as any).BASE_URL = '/iso-10303-2-vocab/';
    const wrapper = await mountWithRouter({ conceptId: '3.1.1.1', formats: ['ttl'] });
    expect(wrapper.find('a').attributes('href')).toBe('/iso-10303-2-vocab/data/test/concepts/3.1.1.1.ttl');
  });

  it('strips trailing slashes from BASE_URL before joining', async () => {
    (import.meta.env as any).BASE_URL = '/foo///';
    const wrapper = await mountWithRouter({ conceptId: '3.1.1.1', formats: ['ttl'] });
    expect(wrapper.find('a').attributes('href')).toBe('/foo/data/test/concepts/3.1.1.1.ttl');
  });

  it('filters unknown formats', async () => {
    const wrapper = await mountWithRouter({ conceptId: '1', formats: ['ttl', 'unknown'] });
    expect(wrapper.findAll('a').length).toBe(1);
  });

  it('filters aggregate-only formats (e.g. TBX) out of per-concept downloads', async () => {
    const wrapper = await mountWithRouter({ conceptId: '1', formats: ['ttl', 'tbx', 'jsonl'] });
    const linkLabels = wrapper.findAll('a').map(a => a.text());
    expect(linkLabels.some(l => l.includes('Turtle'))).toBe(true);
    expect(linkLabels.some(l => l.includes('TBX'))).toBe(false);
    expect(linkLabels.some(l => l.includes('JSON-Lines'))).toBe(false);
  });

  it('renders nothing when all formats are unknown', async () => {
    const wrapper = await mountWithRouter({ formats: ['unknown'] });
    expect(wrapper.find('a').exists()).toBe(false);
  });

  it('renders nothing when formats array is empty', async () => {
    const wrapper = await mountWithRouter({ formats: [] });
    expect(wrapper.find('a').exists()).toBe(false);
  });

  it('sets download attribute to bare filename (no path)', async () => {
    const wrapper = await mountWithRouter({ conceptId: '3.1.1.1', formats: ['jsonld'] });
    expect(wrapper.find('a').attributes('download')).toBe('3.1.1.1.jsonld');
  });
});
