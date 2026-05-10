import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import StatsView from '../views/StatsView.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { createTestRouter, setupPinia, makeManifest, makeAdapterStub } from './test-helpers';

const testManifest = makeManifest({
  languages: ['eng', 'fra', 'deu'],
  conceptCount: 100,
  languageStats: {
    eng: { terms: 100, definitions: 95 },
    fra: { terms: 80, definitions: 70 },
    deu: { terms: 60, definitions: 50 },
  },
});

describe('StatsView', () => {
  let pinia: ReturnType<typeof setupPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = setupPinia();
    router = await createTestRouter('dataset', '/dataset/test/stats');
    const store = useVocabularyStore();
    store.manifests.set('test', testManifest);
    store.datasets.set('test', makeAdapterStub());
  });

  function mountStats() {
    return mount(StatsView, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test' },
    });
  }

  it('renders statistics heading', async () => {
    const wrapper = mountStats();
    await flushPromises();
    expect(wrapper.text()).toContain('Statistics');
  });

  it('shows total concept count', async () => {
    const wrapper = mountStats();
    await flushPromises();
    expect(wrapper.text()).toContain('100 concepts');
  });

  it('shows language count', async () => {
    const wrapper = mountStats();
    await flushPromises();
    expect(wrapper.text()).toContain('3 languages');
  });

  it('shows language stats table', async () => {
    const wrapper = mountStats();
    await flushPromises();
    expect(wrapper.text()).toContain('English');
    expect(wrapper.text()).toContain('French');
    expect(wrapper.text()).toContain('German');
  });

  it('shows term and definition counts', async () => {
    const wrapper = mountStats();
    await flushPromises();
    expect(wrapper.text()).toContain('100');
    expect(wrapper.text()).toContain('95');
    expect(wrapper.text()).toContain('80');
  });

  it('renders breadcrumb navigation', async () => {
    const wrapper = mountStats();
    await flushPromises();
    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('Test Dataset');
    expect(wrapper.text()).toContain('Statistics');
  });
});
