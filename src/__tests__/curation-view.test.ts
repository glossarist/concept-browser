import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import CurationView from '../views/CurationView.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { createTestRouter, setupPinia, makeManifest, makeAdapterStub } from './test-helpers';
import type { DatasetCuration } from '../adapters/curation-queues';

const curationData: DatasetCuration = {
  registerId: 'test',
  conceptCount: 120,
  languages: ['eng', 'fra', 'deu'],
  validation: {
    count: 1,
    items: [{ id: '9.9', designation: 'broken entry', reason: 'canonical parse failed: missing definition' }],
  },
  missingTranslations: {
    count: 2,
    items: [
      { id: '1.1', designation: 'legal metrology', missing: ['fra', 'deu'] },
      { id: '2.2', designation: 'measurement', missing: ['deu'] },
    ],
  },
  noSources: {
    count: 1,
    items: [{ id: '3.3', designation: 'unit' }],
  },
};

const testManifest = makeManifest({
  languages: ['eng', 'fra', 'deu'],
  conceptCount: 120,
});

describe('CurationView', () => {
  let pinia: ReturnType<typeof setupPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    pinia = setupPinia();
    router = await createTestRouter('dataset', '/dataset/test/curation');
    const store = useVocabularyStore();
    store.manifests.set('test', testManifest);
    store.datasets.set('test', makeAdapterStub());
    originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve(curationData),
    }) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mountCuration() {
    return mount(CurationView, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test' },
    });
  }

  it('renders the curation heading and register summary', async () => {
    const wrapper = mountCuration();
    await flushPromises();
    expect(wrapper.text()).toContain('Curation Queues');
    expect(wrapper.text()).toContain('Test Dataset');
    expect(wrapper.text()).toContain('120 concepts');
  });

  it('renders all three queues with counts', async () => {
    const wrapper = mountCuration();
    await flushPromises();
    expect(wrapper.find('[data-testid="queue-count-validation"]').text()).toBe('1');
    expect(wrapper.find('[data-testid="queue-count-missing"]').text()).toBe('2');
    expect(wrapper.find('[data-testid="queue-count-nosources"]').text()).toBe('1');
  });

  it('deep-links each queue item to its concept page', async () => {
    const wrapper = mountCuration();
    await flushPromises();
    const links = wrapper.findAll('a').map(a => a.attributes('href'));
    expect(links).toContain('/dataset/test/concept/9.9');
    expect(links).toContain('/dataset/test/concept/1.1');
    expect(links).toContain('/dataset/test/concept/3.3');
  });

  it('shows missing-language badges per item (code + full-name tooltip)', async () => {
    const wrapper = mountCuration();
    await flushPromises();
    const badges = wrapper.findAll('.badge-yellow').map(b => b.text());
    expect(badges).toContain('FRA');
    expect(badges).toContain('DEU');
    const tooltip = wrapper.findAll('.badge-yellow').map(b => b.attributes('title'));
    expect(tooltip.some(t2 => t2?.includes('French'))).toBe(true);
  });

  it('filters queue items by designation or id', async () => {
    const wrapper = mountCuration();
    await flushPromises();
    const input = wrapper.find('#curation-filter');
    await input.setValue('measurement');
    expect(wrapper.text()).toContain('measurement');
    expect(wrapper.text()).not.toContain('legal metrology');
  });

  it('shows the all-clear state when queues are empty', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({
        registerId: 'test',
        conceptCount: 120,
        languages: ['eng'],
        validation: { count: 0, items: [] },
        missingTranslations: { count: 0, items: [] },
        noSources: { count: 0, items: [] },
      }),
    }) as unknown as typeof fetch;
    const wrapper = mountCuration();
    await flushPromises();
    expect(wrapper.text()).toContain('No entries are failing validation');
    expect(wrapper.text()).toContain('Every entry has terms in every configured language');
    expect(wrapper.text()).toContain('Every entry declares at least one source');
  });

  it('shows the no-data hint on 404 (older generator build)', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: () => Promise.resolve(null),
    }) as unknown as typeof fetch;
    const wrapper = mountCuration();
    await flushPromises();
    expect(wrapper.text()).toContain('without curation data');
  });
});
