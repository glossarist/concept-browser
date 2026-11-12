import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ConceptView from '../views/ConceptView.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { conceptFromJson } from '../adapters/model-bridge';
import { createTestRouter, setupPinia, makeManifest, makeAdapterStub } from './test-helpers';
import { ChunkLoadError } from '../errors';
import { Concept } from 'glossarist';

// Mock fetch for cross-ref-index.json requests from ensureEdgesForDataset
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('ConceptView', () => {
  let pinia: ReturnType<typeof setupPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = setupPinia();
    router = await createTestRouter('dataset', '/');
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: false, status: 404 } as Response);
    const store = useVocabularyStore();
    store.manifests.set('test', makeManifest());
    store.datasets.set('test', makeAdapterStub());
  });

  function mountConceptView(registerId = 'test', conceptId = '1') {
    return mount(ConceptView, {
      global: {
        plugins: [pinia, router],
        stubs: { ConceptDetail: true },
      },
      props: { registerId, conceptId },
    });
  }

  it('shows loading skeleton initially', () => {
    const wrapper = mountConceptView();
    expect(wrapper.find('.skeleton').exists()).toBe(true);
  });

  it('shows error when fetchConcept returns null', async () => {
    const wrapper = mountConceptView();
    await flushPromises();
    expect(wrapper.text()).toContain('Failed to load concept');
  });

  it('shows retry button on error', async () => {
    const wrapper = mountConceptView();
    await flushPromises();
    const retryBtn = wrapper.findAll('button').find(b => b.text() === 'Retry');
    expect(retryBtn).toBeDefined();
  });

  it('shows back to dataset link on error', async () => {
    const wrapper = mountConceptView();
    await flushPromises();
    const link = wrapper.findAll('a').find(a => a.text().includes('Back to dataset'));
    expect(link).toBeDefined();
  });

  it('renders ConceptDetail when concept loads', async () => {
    const concept = conceptFromJson({
      '@id': 'https://glossarist.org/test/concept/1',
      '@type': 'gl:Concept',
      'gl:identifier': '1',
      'gl:localizedConcept': {
        eng: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'eng',
          'gl:entryStatus': 'valid',
          'gl:designation': [
            { '@type': 'gl:Expression', 'gl:term': 'test', 'gl:normativeStatus': 'preferred' },
          ],
          'gl:definition': [{ '@type': 'gl:DetailedDefinition', 'gl:content': 'A test concept.' }],
        },
      },
    });
    const store = useVocabularyStore();
    store.datasets.set('test', makeAdapterStub({ fetchConcept: () => Promise.resolve(concept) }));

    const wrapper = mountConceptView();
    await flushPromises();
    expect(wrapper.findComponent({ name: 'ConceptDetail' }).exists()).toBe(true);
  });

  it('shows error when dataset not found', async () => {
    const store = useVocabularyStore();
    store.datasets.delete('test');
    store.manifests.delete('test');
    const wrapper = mountConceptView();
    await flushPromises();
    expect(wrapper.text()).toContain('Failed to load concept');
  });

  it('shows same-standard terms only in detail mode and clears them for an unrelated concept', async () => {
    const registerId = 'same-standard-view';
    const concept = Concept.fromJSON({
      id: '1',
      sources: [{ type: 'authoritative', origin: { ref: { source: 'ISO', id: '704:2022' } } }],
    });
    const store = useVocabularyStore();
    store.manifests.set(registerId, makeManifest({ id: registerId }));
    store.datasets.set(registerId, makeAdapterStub({
      fetchConcept: async () => concept,
      getIndexEntry: () => ({ designations: { eng: 'Related term' } }),
    }));
    mockFetch.mockImplementation(async (url: string) => url.endsWith('/standards.json')
      ? { ok: true, json: async () => ({
        'iso 704:2022': { label: 'ISO 704:2022', conceptIds: ['1', '2'] },
        'iso 999:2020': { label: 'ISO 999:2020', conceptIds: ['4'] },
      }) }
      : { ok: false, status: 404 });
    const wrapper = mount(ConceptView, {
      global: { plugins: [pinia, router], stubs: { ConceptDetail: true, RelationSphere: true } },
      props: { registerId, conceptId: '1' },
    });
    try {
      await flushPromises();
      expect(mockFetch).toHaveBeenCalledWith(`${import.meta.env.BASE_URL}data/${registerId}/standards.json`);
      expect(wrapper.find('aside').text()).toContain('ISO 704:2022');
      expect(wrapper.find('aside a').attributes('href')).toBe(`/dataset/${registerId}/concept/2`);
      expect(wrapper.find(`aside a[href="/dataset/${registerId}/concept/1"]`).exists()).toBe(false);

      await wrapper.get('button[title="Relation sphere view (s)"]').trigger('click');
      expect(wrapper.find('aside').exists()).toBe(false);
      expect(wrapper.findComponent({ name: 'RelationSphere' }).exists()).toBe(true);

      await wrapper.get('button[title="Detail view (d)"]').trigger('click');
      expect(wrapper.find('aside').exists()).toBe(true);
      expect(wrapper.findComponent({ name: 'ConceptDetail' }).exists()).toBe(true);

      store.currentConcept = Concept.fromJSON({
        id: '4',
        sources: [{ type: 'authoritative', origin: { ref: { source: 'ISO', id: '999:2020' } } }],
      });
      await flushPromises();
      expect(wrapper.find('aside').exists()).toBe(false);
      expect(wrapper.get('.detail-layout').classes()).not.toContain('has-standard-pane');

      store.currentConcept = Concept.fromJSON({ id: '3' });
      await flushPromises();
      expect(wrapper.find('aside').exists()).toBe(false);
      expect(wrapper.findComponent({ name: 'ConceptDetail' }).exists()).toBe(true);
    } finally {
      wrapper.unmount();
    }
  });

  it('keeps the concept visible and removes stale navigation when adjacent chunks fail', async () => {
    const concept = conceptFromJson({
      '@id': 'https://glossarist.org/test/concept/1',
      '@type': 'gl:Concept',
      'gl:identifier': '1',
      'gl:localizedConcept': {
        eng: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'eng',
          'gl:entryStatus': 'valid',
          'gl:designation': [{ '@type': 'gl:Expression', 'gl:term': 'test term', 'gl:normativeStatus': 'preferred' }],
        },
      },
    });
    const error = ChunkLoadError.make('test', 1, 503);
    const ensureChunks = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(error);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    useVocabularyStore().datasets.set('test', makeAdapterStub({
      fetchConcept: async () => concept,
      getConceptPosition: () => 1,
      getAdjacentConcepts: () => ({ prev: '0', next: '2' }),
      ensureChunksForRange: ensureChunks,
    }));
    const wrapper = mount(ConceptView, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test', conceptId: '1' },
    });
    try {
      await flushPromises();
      expect(wrapper.find('h1').text()).toBe('test term');
      expect(wrapper.find('button[title="Previous concept (←)"]').exists()).toBe(true);
      expect(wrapper.find('button[title="Next concept (→)"]').exists()).toBe(true);

      await wrapper.setProps({ conceptId: '2' });
      await flushPromises();

      expect(wrapper.find('h1').text()).toBe('test term');
      expect(wrapper.find('button[title="Previous concept (←)"]').exists()).toBe(false);
      expect(wrapper.find('button[title="Next concept (→)"]').exists()).toBe(false);
      expect(wrapper.text()).not.toContain('Failed to load concept');
      expect(log).toHaveBeenCalledWith('Failed to load adjacent concepts:', error);
    } finally {
      wrapper.unmount();
      log.mockRestore();
    }
  });
});
