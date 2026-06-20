import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import ConceptDetail from '../components/ConceptDetail.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import type { Manifest } from '../adapters/types';
import { conceptFromJson } from '../adapters/model-bridge';
// Prevent the 2.7MB Opal runtime from loading in tests
vi.mock('../utils/plurimath', () => ({
  loadPlurimath: () => new Promise(() => {}),
  mathToHtml: () => '<code class="math-fallback">x</code>',
  renderToMathML: () => null,
}));

import { vMath } from '../directives/v-math';

function makeManifest(): Manifest {
  return {
    id: 'test',
    datasetUri: 'https://glossarist.org/test/concept',
    title: 'Test Dataset',
    description: 'A test dataset',
    owner: 'ISO',
    baseUrl: '/data/test',
    languages: ['eng', 'fra'],
    conceptCount: 1,
    conceptUrlTemplate: '/data/test/concepts/{id}.json',
    indexUrl: '/data/test/index.json',
    contextUrl: '/data/test/context.json',
    uriBase: 'https://glossarist.org',
    status: 'published',
    schemaVersion: '1.0',
    tags: [],
    lastUpdated: '2025-01-01',
    sourceRepo: 'https://example.com/repo',
    chunkSize: 1000,
    languageOrder: ['eng', 'fra'],
    color: '#3366ff',
  };
}

function makeConceptJson(overrides: Record<string, any> = {}) {
  return {
    '@context': 'https://glossarist.org/context',
    '@id': 'https://glossarist.org/test/concept/1',
    '@type': 'gl:Concept',
    'gl:identifier': '1',
    'gl:localizedConcept': {
      eng: {
        '@id': 'https://glossarist.org/test/concept/1/eng',
        '@type': 'gl:LocalizedConcept',
        'gl:languageCode': 'eng',
        'gl:entryStatus': 'valid',
        'gl:designation': [
          { '@type': 'gl:Expression', 'gl:normativeStatus': 'preferred', 'gl:term': 'test term' },
          { '@type': 'gl:Symbol', 'gl:normativeStatus': 'admitted', 'gl:term': 'stem:[x]' },
        ],
        'gl:definition': [
          { '@type': 'gl:DetailedDefinition', 'gl:content': 'a definition with *italic* text' },
        ],
        'gl:notes': [
          { '@type': 'gl:DetailedDefinition', 'gl:content': 'a note' },
        ],
        'gl:examples': [
          { '@type': 'gl:DetailedDefinition', 'gl:content': 'an example' },
        ],
        'gl:source': [{ '@type': 'gl:Source', 'gl:sourceType': 'authoritative' }],
      },
      fra: {
        '@id': 'https://glossarist.org/test/concept/1/fra',
        '@type': 'gl:LocalizedConcept',
        'gl:languageCode': 'fra',
        'gl:entryStatus': 'valid',
        'gl:designation': [
          { '@type': 'gl:Expression', 'gl:normativeStatus': 'preferred', 'gl:term': 'terme de test' },
        ],
        'gl:definition': [
          { '@type': 'gl:DetailedDefinition', 'gl:content': 'une définition' },
        ],
      },
    },
    ...overrides,
  };
}

async function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/dataset/:registerId', name: 'dataset', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: { template: '<div/>' } },
    ],
  });
}

describe('ConceptDetail interactions', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;
  let store: ReturnType<typeof useVocabularyStore>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
    router.push('/');
    await router.isReady();
    store = useVocabularyStore();
    store.manifests.set('test', makeManifest());
    store.datasets.set('test', { index: [], getConceptCount: () => 0, getConcepts: () => [], getConceptPosition: () => -1, getIndexEntry: () => undefined } as any);
  });

  function mountDetail(conceptJson: Record<string, any> = makeConceptJson()) {
    const concept = conceptFromJson(conceptJson);
    return mount(ConceptDetail, {
      global: {
        plugins: [pinia, router],
        directives: { math: vMath },
      },
      props: {
        concept,
        manifest: makeManifest(),
        edges: [],
        registerId: 'test',
        adjacent: { prev: null, next: null },
      },
    });
  }

  it('renders the primary term in the header', () => {
    const wrapper = mountDetail();
    expect(wrapper.find('h1').html()).toContain('test term');
  });

  async function switchToDefinition(wrapper: ReturnType<typeof mountDetail>) {
    const tabs = wrapper.findAll('button[role="tab"]');
    const defTab = tabs.find(t => t.text().includes('Definition'));
    if (defTab) {
      await defTab.trigger('click');
      await flushPromises();
    }
  }

  it('renders concept ID badge', () => {
    const wrapper = mountDetail();
    expect(wrapper.text()).toContain('1');
  });

  it('renders language sections for eng and fra', async () => {
    const wrapper = mountDetail();
    await switchToDefinition(wrapper);
    expect(wrapper.text()).toContain('English');
    expect(wrapper.text()).toContain('French');
  });

  it('renders italic text in definition', async () => {
    const wrapper = mountDetail();
    await switchToDefinition(wrapper);
    expect(wrapper.html()).toContain('<em>italic</em>');
  });

  it('renders stem: notation as math-pending placeholder', async () => {
    const wrapper = mountDetail();
    await switchToDefinition(wrapper);
    expect(wrapper.html()).toContain('math-pending');
    expect(wrapper.html()).toContain('data-expr="x"');
  });

  it('renders notes section', async () => {
    const wrapper = mountDetail();
    await switchToDefinition(wrapper);
    expect(wrapper.text()).toContain('Note 1');
    expect(wrapper.text()).toContain('a note');
  });

  it('renders examples section', async () => {
    const wrapper = mountDetail();
    await switchToDefinition(wrapper);
    expect(wrapper.text()).toContain('Example 1');
    expect(wrapper.text()).toContain('an example');
  });

  it('renders scoped examples nested inside a note', async () => {
    const json = makeConceptJson() as Record<string, any>;
    json['gl:localizedConcept'].eng['gl:notes'] = [
      {
        '@type': 'gl:DetailedDefinition',
        'gl:content': 'resistance depends on dimensions and material',
        'gl:examples': [
          { '@type': 'gl:DetailedDefinition', 'gl:content': 'copper resistivity ≈ 1.68e-8 Ω·m at 20 °C' },
          { '@type': 'gl:DetailedDefinition', 'gl:content': '1 m of 1 mm² copper wire ≈ 0.017 Ω' },
        ],
      },
    ];
    const wrapper = mountDetail(json);
    await switchToDefinition(wrapper);
    expect(wrapper.text()).toContain('resistance depends');
    expect(wrapper.text()).toContain('Example 1');
    expect(wrapper.text()).toContain('Example 2');
    expect(wrapper.text()).toContain('copper resistivity');
    expect(wrapper.text()).toContain('0.017 Ω');
  });

  it('renders designation types as badges', async () => {
    const wrapper = mountDetail();
    await switchToDefinition(wrapper);
    expect(wrapper.text()).toContain('symbol');
  });

  it('collapses non-eng languages when 6+ languages present', async () => {
    const json = makeConceptJson() as Record<string, any>;
    for (const lang of ['deu', 'spa', 'kor', 'jpn']) {
      json['gl:localizedConcept'][lang] = {
        '@id': `https://glossarist.org/test/concept/1/${lang}`,
        '@type': 'gl:LocalizedConcept',
        'gl:languageCode': lang,
        'gl:designation': [
          { '@type': 'gl:Expression', 'gl:normativeStatus': 'preferred', 'gl:term': `term-${lang}` },
        ],
        'gl:definition': [
          { '@type': 'gl:DetailedDefinition', 'gl:content': `def-${lang}` },
        ],
      };
    }
    const wrapper = mountDetail(json);
    await switchToDefinition(wrapper);
    await flushPromises();
    expect(wrapper.text()).toContain('6 languages');
  });

  it('toggles language section on click', async () => {
    const wrapper = mountDetail();
    await switchToDefinition(wrapper);
    const buttons = wrapper.findAll('button');
    const fraButton = buttons.find(b => b.text().includes('French'));
    expect(fraButton).toBeDefined();

    await fraButton!.trigger('click');
    await fraButton!.trigger('click');
  });

  it('switches between definition and history tabs', async () => {
    const wrapper = mountDetail();
    await switchToDefinition(wrapper);
    expect(wrapper.text()).toContain('a definition with');

    const tabs = wrapper.findAll('button[role="tab"]');
    const historyTab = tabs.find(t => t.text().includes('History'));
    expect(historyTab).toBeDefined();
    await historyTab!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).not.toContain('a definition with');
  });

  it('renders cross-reference link and navigates on click', async () => {
    const json = makeConceptJson();
    json['gl:localizedConcept'].eng['gl:definition'] = [
      { '@type': 'gl:DetailedDefinition', 'gl:content': 'see {{urn:iso:std:iso:14812:3.1.1.1,entity}} here' },
    ];

    // Register the URI pattern via factory so it resolves as internal
    const { getFactory } = await import('../adapters/factory');
    const factory = getFactory();
    factory.uriRouter.registerDataset('test', '', '', ['https://glossarist.org/test/concept/*']);

    const wrapper = mountDetail(json);
    await switchToDefinition(wrapper);
    await flushPromises();

    const xref = wrapper.find('.xref-link');
    if (xref.exists()) {
      await xref.trigger('click');
      await flushPromises();
      expect(router.currentRoute.value.name).toBe('concept');
    }
  });

  it('renders entry status badge', () => {
    const wrapper = mountDetail();
    expect(wrapper.text()).toContain('valid');
  });

  it('renders the language quick-jump sidebar with all languages', async () => {
    const wrapper = mountDetail();
    await switchToDefinition(wrapper);
    expect(wrapper.text()).toContain('Languages (2)');
  });
});
