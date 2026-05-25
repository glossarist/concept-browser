import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import ConceptView from '../views/ConceptView.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { conceptFromJson } from '../adapters/model-bridge';
import { createTestRouter, setupPinia, makeManifest, makeAdapterStub } from './test-helpers';

describe('ConceptView', () => {
  let pinia: ReturnType<typeof setupPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = setupPinia();
    router = await createTestRouter('dataset', '/');
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
});
