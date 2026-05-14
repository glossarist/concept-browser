import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import LanguageDetail from '../components/LanguageDetail.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import type { LocalizedConcept } from '../adapters/types';
import { createTestRouter, setupPinia, makeManifest, makeLocalizedConcept, makeAdapterStub } from './test-helpers';

describe('LanguageDetail', () => {
  let pinia: ReturnType<typeof setupPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = setupPinia();
    router = await createTestRouter('dataset', '/');
    const store = useVocabularyStore();
    store.manifests.set('test', makeManifest({ languages: ['eng', 'fra'] }));
    store.datasets.set('test', makeAdapterStub());
  });

  function mountDetail(lcs: Record<string, LocalizedConcept>, activeLang = 'eng') {
    return mount(LanguageDetail, {
      global: { plugins: [pinia, router], directives: { math: () => {} } },
      props: { localizedConcepts: lcs, activeLang },
    });
  }

  it('renders language selector buttons', () => {
    const eng = makeLocalizedConcept();
    const fra = makeLocalizedConcept({ '@id': '.../fra', 'gl:languageCode': 'fra' });
    const wrapper = mountDetail({ eng, fra });
    expect(wrapper.text()).toContain('English');
    expect(wrapper.text()).toContain('French');
  });

  it('highlights active language button', () => {
    const eng = makeLocalizedConcept();
    const fra = makeLocalizedConcept({ '@id': '.../fra', 'gl:languageCode': 'fra' });
    const wrapper = mountDetail({ eng, fra }, 'eng');
    const buttons = wrapper.findAll('button').filter(b => b.text().includes('English'));
    expect(buttons[0].classes()).toContain('bg-ink-800');
  });

  it('emits update:activeLang on language click', async () => {
    const eng = makeLocalizedConcept();
    const fra = makeLocalizedConcept({ '@id': '.../fra', 'gl:languageCode': 'fra' });
    const wrapper = mountDetail({ eng, fra }, 'eng');
    const fraBtn = wrapper.findAll('button').find(b => b.text().includes('French'));
    expect(fraBtn).toBeDefined();
    await fraBtn!.trigger('click');
    expect(wrapper.emitted('update:activeLang')?.[0]).toEqual(['fra']);
  });

  it('shows entry status badge', () => {
    const eng = makeLocalizedConcept({ 'gl:entryStatus': 'valid' });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('valid');
  });

  it('shows designations', () => {
    const eng = makeLocalizedConcept({
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
    const eng = makeLocalizedConcept({
      'gl:definition': [{ '@type': 'gl:Definition', 'gl:content': 'A paved surface for vehicles.' }],
    });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('Definition');
    expect(wrapper.text()).toContain('paved surface');
  });

  it('shows notes', () => {
    const eng = makeLocalizedConcept({
      'gl:notes': [{ '@type': 'gl:Note', 'gl:content': 'This is a note.' }],
    });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('Notes');
    expect(wrapper.text()).toContain('This is a note');
  });

  it('shows examples', () => {
    const eng = makeLocalizedConcept({
      'gl:examples': [{ '@type': 'gl:Example', 'gl:content': 'A highway is a road.' }],
    });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('Examples');
    expect(wrapper.text()).toContain('A highway is a road');
  });

  it('shows sources', () => {
    const eng = makeLocalizedConcept({
      'gl:source': [{ '@type': 'gl:Source', 'gl:sourceType': 'authoritative', 'gl:origin': { '@type': 'gl:Origin', 'gl:ref': 'ISO 7010' } }],
    });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('Sources');
    expect(wrapper.text()).toContain('ISO 7010');
  });

  it('shows term-only state for language without definition', () => {
    const eng = makeLocalizedConcept({
      'gl:designation': [{ '@type': 'gl:Expression', 'gl:term': 'test', 'gl:normativeStatus': 'preferred' }],
    });
    delete (eng as any)['gl:definition'];
    delete (eng as any)['gl:notes'];
    delete (eng as any)['gl:examples'];
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('Term only in English');
  });

  it('shows no data message for missing language', () => {
    const eng = makeLocalizedConcept();
    const wrapper = mountDetail({ eng }, 'zho');
    expect(wrapper.text()).toContain('No data available');
  });

  it('shows designation type badges', () => {
    const eng = makeLocalizedConcept({
      'gl:designation': [
        { '@type': 'gl:Symbol', 'gl:term': 'H₂O', 'gl:normativeStatus': 'preferred' },
        { '@type': 'gl:Abbreviation', 'gl:term': 'abbr', 'gl:normativeStatus': 'admitted' },
      ],
    });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('Symbol');
    expect(wrapper.text()).toContain('Abbreviation');
  });

  it('shows grammar info when present', () => {
    const eng = makeLocalizedConcept({
      'gl:designation': [
        { '@type': 'gl:Expression', 'gl:term': 'route', 'gl:normativeStatus': 'preferred', 'gl:grammarInfo': [{ 'gl:gender': 'f', 'gl:number': 'singular' }] },
      ],
    });
    const wrapper = mountDetail({ eng });
    expect(wrapper.text()).toContain('f');
    expect(wrapper.text()).toContain('singular');
  });
});
