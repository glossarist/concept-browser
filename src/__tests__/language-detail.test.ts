import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import LanguageDetail from '../components/LanguageDetail.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { conceptFromJson } from '../adapters/model-bridge';
import { createTestRouter, setupPinia, makeManifest, makeAdapterStub } from './test-helpers';

function makeConceptJson(overrides: Record<string, any> = {}) {
  return {
    '@id': 'https://glossarist.org/test/concept/1',
    '@type': 'gl:Concept',
    'gl:identifier': '1',
    'gl:localizedConcept': {
      eng: {
        '@type': 'gl:LocalizedConcept',
        'gl:languageCode': 'eng',
        'gl:entryStatus': 'valid',
        ...overrides.eng,
      },
      ...(overrides.otherLangs || {}),
    },
  };
}

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

  function mountDetail(conceptJson: Record<string, any>, activeLang = 'eng') {
    const concept = conceptFromJson(conceptJson);
    return mount(LanguageDetail, {
      global: { plugins: [pinia, router], directives: { math: () => {} } },
      props: { concept, activeLang },
    });
  }

  it('renders language selector buttons', () => {
    const json = makeConceptJson({
      eng: {},
      otherLangs: {
        fra: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'fra',
          'gl:entryStatus': 'valid',
        },
      },
    });
    const wrapper = mountDetail(json);
    expect(wrapper.text()).toContain('English');
    expect(wrapper.text()).toContain('French');
  });

  it('highlights active language button', () => {
    const json = makeConceptJson({
      eng: {},
      otherLangs: {
        fra: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'fra',
          'gl:entryStatus': 'valid',
        },
      },
    });
    const wrapper = mountDetail(json, 'eng');
    const buttons = wrapper.findAll('button').filter(b => b.text().includes('English'));
    expect(buttons[0].classes()).toContain('bg-ink-800');
  });

  it('emits update:activeLang on language click', async () => {
    const json = makeConceptJson({
      eng: {},
      otherLangs: {
        fra: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'fra',
          'gl:entryStatus': 'valid',
        },
      },
    });
    const wrapper = mountDetail(json, 'eng');
    const fraBtn = wrapper.findAll('button').find(b => b.text().includes('French'));
    expect(fraBtn).toBeDefined();
    await fraBtn!.trigger('click');
    expect(wrapper.emitted('update:activeLang')?.[0]).toEqual(['fra']);
  });

  it('shows entry status badge', () => {
    const json = makeConceptJson({
      eng: { 'gl:entryStatus': 'valid' },
    });
    const wrapper = mountDetail(json);
    expect(wrapper.text()).toContain('valid');
  });

  it('shows designations with ontology labels', () => {
    const json = makeConceptJson({
      eng: {
        'gl:designation': [
          { '@type': 'gl:Expression', 'gl:term': 'road', 'gl:normativeStatus': 'preferred' },
        ],
      },
    });
    const wrapper = mountDetail(json);
    expect(wrapper.text()).toContain('road');
    expect(wrapper.text()).toContain('expression');
    expect(wrapper.text()).toContain('preferred');
  });

  it('shows definition', () => {
    const json = makeConceptJson({
      eng: {
        'gl:definition': [{ '@type': 'gl:Definition', 'gl:content': 'A paved surface for vehicles.' }],
      },
    });
    const wrapper = mountDetail(json);
    expect(wrapper.text()).toContain('Definition');
    expect(wrapper.text()).toContain('paved surface');
  });

  it('shows notes', () => {
    const json = makeConceptJson({
      eng: {
        'gl:notes': [{ '@type': 'gl:Note', 'gl:content': 'This is a note.' }],
      },
    });
    const wrapper = mountDetail(json);
    expect(wrapper.text()).toContain('Notes');
    expect(wrapper.text()).toContain('This is a note');
  });

  it('shows examples', () => {
    const json = makeConceptJson({
      eng: {
        'gl:examples': [{ '@type': 'gl:Example', 'gl:content': 'A highway is a road.' }],
      },
    });
    const wrapper = mountDetail(json);
    expect(wrapper.text()).toContain('Examples');
    expect(wrapper.text()).toContain('A highway is a road');
  });

  it('shows sources', () => {
    const json = makeConceptJson({
      eng: {
        'gl:source': [{ '@type': 'gl:Source', 'gl:sourceType': 'authoritative', 'gl:origin': { '@type': 'gl:Origin', 'gl:ref': { '@type': 'gl:Ref', 'gl:source': 'ISO 7010' } } }],
      },
    });
    const wrapper = mountDetail(json);
    expect(wrapper.text()).toContain('Sources');
    expect(wrapper.text()).toContain('ISO 7010');
  });

  it('shows term-only state for language without definition', () => {
    const json = makeConceptJson({
      eng: {
        'gl:designation': [{ '@type': 'gl:Expression', 'gl:term': 'test', 'gl:normativeStatus': 'preferred' }],
      },
    });
    const wrapper = mountDetail(json);
    expect(wrapper.text()).toContain('Term only in English');
  });

  it('shows no data message for missing language', () => {
    const json = makeConceptJson({ eng: {} });
    const wrapper = mountDetail(json, 'zho');
    expect(wrapper.text()).toContain('No data available');
  });

  it('shows designation type badges with ontology labels', () => {
    const json = makeConceptJson({
      eng: {
        'gl:designation': [
          { '@type': 'gl:Symbol', 'gl:term': 'H₂O', 'gl:normativeStatus': 'preferred' },
          { '@type': 'gl:Abbreviation', 'gl:term': 'abbr', 'gl:normativeStatus': 'admitted' },
        ],
      },
    });
    const wrapper = mountDetail(json);
    expect(wrapper.text()).toContain('symbol');
    expect(wrapper.text()).toContain('abbreviation');
  });

  it('shows grammar info with ontology labels when present', () => {
    const json = makeConceptJson({
      eng: {
        'gl:designation': [
          { '@type': 'gl:Expression', 'gl:term': 'route', 'gl:normativeStatus': 'preferred', 'gl:grammarInfo': [{ 'gl:gender': 'f', 'gl:number': 'singular' }] },
        ],
      },
    });
    const wrapper = mountDetail(json);
    expect(wrapper.text()).toContain('feminine');
    expect(wrapper.text()).toContain('singular');
  });
});
