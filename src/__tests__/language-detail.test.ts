import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import LanguageDetail from '../components/LanguageDetail.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import type { Manifest, LocalizedConcept } from '../adapters/types';

function makeManifest(): Manifest {
  return {
    id: 'test',
    datasetUri: 'https://glossarist.org/test/concept',
    title: 'Test Dataset',
    description: 'A test dataset',
    owner: 'ISO',
    baseUrl: '/data/test',
    languages: ['eng', 'fra'],
    conceptCount: 10,
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
    color: '#3366ff',
  };
}

function makeLC(overrides: Partial<LocalizedConcept> = {}): LocalizedConcept {
  return {
    '@id': 'https://glossarist.org/test/concept/1/eng',
    '@type': 'gl:LocalizedConcept',
    'gl:languageCode': 'eng',
    'gl:entryStatus': 'valid',
    ...overrides,
  };
}

async function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: { template: '<div/>' } },
    ],
  });
}

describe('LanguageDetail', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
    router.push('/');
    await router.isReady();
    const store = useVocabularyStore();
    store.manifests.set('test', makeManifest());
    store.datasets.set('test', { index: [], getConceptCount: () => 0, getConcepts: () => [] } as any);
  });

  function mountDetail(lcs: Record<string, LocalizedConcept>, activeLang = 'eng') {
    return mount(LanguageDetail, {
      global: { plugins: [pinia, router], directives: { math: () => {} } },
      props: { localizedConcepts: lcs, activeLang },
    });
  }

  it('renders language selector buttons', () => {
    const eng = makeLC();
    const fra = makeLC({ '@id': '.../fra', 'gl:languageCode': 'fra' });
    const wrapper = mountDetail({ eng, fra });
    expect(wrapper.text()).toContain('English');
    expect(wrapper.text()).toContain('French');
  });

  it('highlights active language button', () => {
    const eng = makeLC();
    const fra = makeLC({ '@id': '.../fra', 'gl:languageCode': 'fra' });
    const wrapper = mountDetail({ eng, fra }, 'eng');
    const buttons = wrapper.findAll('button').filter(b => b.text().includes('English'));
    expect(buttons[0].classes()).toContain('bg-ink-800');
  });

  it('emits update:activeLang on language click', async () => {
    const eng = makeLC();
    const fra = makeLC({ '@id': '.../fra', 'gl:languageCode': 'fra' });
    const wrapper = mountDetail({ eng, fra }, 'eng');
    const fraBtn = wrapper.findAll('button').find(b => b.text().includes('French'));
    expect(fraBtn).toBeDefined();
    await fraBtn!.trigger('click');
    expect(wrapper.emitted('update:activeLang')?.[0]).toEqual(['fra']);
  });

  it('shows entry status badge', () => {
    const eng = makeLC({ 'gl:entryStatus': 'valid' });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('valid');
  });

  it('shows designations', () => {
    const eng = makeLC({
      'gl:designation': [
        { '@type': 'gl:Expression', 'gl:term': 'road', 'gl:normativeStatus': 'preferred' },
      ],
    });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('road');
    expect(wrapper.text()).toContain('Expression');
    expect(wrapper.text()).toContain('Preferred');
  });

  it('shows definition', () => {
    const eng = makeLC({
      'gl:definition': [{ '@type': 'gl:Definition', 'gl:content': 'A paved surface for vehicles.' }],
    });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('Definition');
    expect(wrapper.text()).toContain('paved surface');
  });

  it('shows notes', () => {
    const eng = makeLC({
      'gl:notes': [{ '@type': 'gl:Note', 'gl:content': 'This is a note.' }],
    });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('Notes');
    expect(wrapper.text()).toContain('This is a note');
  });

  it('shows examples', () => {
    const eng = makeLC({
      'gl:examples': [{ '@type': 'gl:Example', 'gl:content': 'A highway is a road.' }],
    });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('Examples');
    expect(wrapper.text()).toContain('A highway is a road');
  });

  it('shows sources', () => {
    const eng = makeLC({
      'gl:source': [{ '@type': 'gl:Source', 'gl:sourceType': 'authoritative', 'gl:origin': { '@type': 'gl:Origin', 'gl:ref': 'ISO 7010' } }],
    });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('Sources');
    expect(wrapper.text()).toContain('ISO 7010');
  });

  it('shows term-only state for language without definition', () => {
    const eng = makeLC({
      'gl:designation': [{ '@type': 'gl:Expression', 'gl:term': 'test', 'gl:normativeStatus': 'preferred' }],
    });
    delete (eng as any)['gl:definition'];
    delete (eng as any)['gl:notes'];
    delete (eng as any)['gl:examples'];
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('Term only in English');
  });

  it('shows no data message for missing language', () => {
    const eng = makeLC();
    const wrapper = mountDetail({ eng }, 'zho');
    expect(wrapper.text()).toContain('No data available');
  });

  it('shows designation type badges', () => {
    const eng = makeLC({
      'gl:designation': [
        { '@type': 'gl:Symbol', 'gl:term': 'H₂O', 'gl:normativeStatus': 'preferred' },
        { '@type': 'gl:Abbreviation', 'gl:term': 'abbr', 'gl:normativeStatus': 'admitted' },
      ],
    });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('Symbol');
    expect(wrapper.text()).toContain('Abbreviation');
  });

  it('shows gender and plurality when present', () => {
    const eng = makeLC({
      'gl:designation': [
        { '@type': 'gl:Expression', 'gl:term': 'route', 'gl:normativeStatus': 'preferred', 'gl:gender': 'f', 'gl:plurality': 'singular' },
      ],
    });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('f');
    expect(wrapper.text()).toContain('singular');
  });
});
