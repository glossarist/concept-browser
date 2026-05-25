import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import ConceptTimeline from '../components/ConceptTimeline.vue';
import { conceptFromJson } from '../adapters/model-bridge';

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

function mountTimeline(conceptJson: Record<string, any>, activeLang = 'eng', languageOrder?: string[]) {
  const concept = conceptFromJson(conceptJson);
  return mount(ConceptTimeline, {
    props: {
      concept,
      activeLang,
      languageOrder,
    },
  });
}

describe('ConceptTimeline', () => {
  it('shows review metadata even without history entries', () => {
    const wrapper = mountTimeline(makeConceptJson());
    expect(wrapper.text()).toContain('Review Details');
    expect(wrapper.text()).toContain('valid');
  });

  it('renders review date as timeline entry', () => {
    const json = makeConceptJson({
      eng: { 'gl:reviewDate': '2023-05-15' },
    });
    const wrapper = mountTimeline(json);
    expect(wrapper.text()).toContain('Review initiated');
    expect(wrapper.text()).toContain('2023');
  });

  it('renders review decision event', () => {
    const json = makeConceptJson({
      eng: {
        'gl:reviewDecisionEvent': 'Accepted',
        'gl:reviewDate': '2023-05-15',
        'gl:reviewDecisionDate': '2023-06-01',
      },
    });
    const wrapper = mountTimeline(json);
    expect(wrapper.text()).toContain('Accepted');
  });

  it('renders gl:dates entries', () => {
    const json = makeConceptJson({
      eng: {
        'gl:dates': [
          { 'gl:dateType': 'accepted', 'gl:date': '2020-01-01' },
          { 'gl:dateType': 'amended', 'gl:date': '2022-06-15' },
        ],
      },
    });
    const wrapper = mountTimeline(json);
    expect(wrapper.text()).toContain('Concept accepted');
    expect(wrapper.text()).toContain('Definition amended');
    expect(wrapper.text()).toContain('2020');
    expect(wrapper.text()).toContain('2022');
  });

  it('sorts entries by date ascending', () => {
    const json = makeConceptJson({
      eng: {
        'gl:dates': [
          { 'gl:dateType': 'amended', 'gl:date': '2022-06-15' },
          { 'gl:dateType': 'accepted', 'gl:date': '2020-01-01' },
        ],
      },
    });
    const wrapper = mountTimeline(json);
    const texts = wrapper.text();
    const acceptedIdx = texts.indexOf('Concept accepted');
    const amendedIdx = texts.indexOf('Definition amended');
    expect(acceptedIdx).toBeLessThan(amendedIdx);
  });

  it('shows language selector when multiple languages have history', () => {
    const json = makeConceptJson({
      eng: { 'gl:reviewDate': '2023-01-01' },
      otherLangs: {
        fra: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'fra',
          'gl:reviewDate': '2023-02-01',
        },
      },
    });
    const wrapper = mountTimeline(json, 'eng', ['eng', 'fra']);
    expect(wrapper.text()).toContain('French');
  });

  it('does not show language selector for single-language history', () => {
    const json = makeConceptJson({
      eng: { 'gl:reviewDate': '2023-01-01' },
    });
    const wrapper = mountTimeline(json);
    const buttons = wrapper.findAll('button');
    const langButtons = buttons.filter(b => b.text().includes('French'));
    expect(langButtons.length).toBe(0);
  });

  it('emits update:activeLang on language button click', async () => {
    const json = makeConceptJson({
      eng: { 'gl:reviewDate': '2023-01-01' },
      otherLangs: {
        fra: {
          '@type': 'gl:LocalizedConcept',
          'gl:languageCode': 'fra',
          'gl:reviewDate': '2023-02-01',
        },
      },
    });
    const wrapper = mountTimeline(json, 'eng', ['eng', 'fra']);
    const fraBtn = wrapper.findAll('button').find(b => b.text().includes('French'));
    expect(fraBtn).toBeDefined();
    await fraBtn!.trigger('click');
    expect(wrapper.emitted('update:activeLang')?.[0]).toEqual(['fra']);
  });

  it('shows review metadata when present', () => {
    const json = makeConceptJson({
      eng: {
        'gl:reviewDate': '2023-01-01',
        'gl:reviewStatus': 'final',
        'gl:reviewDecision': 'accepted',
        'gl:entryStatus': 'valid',
        'gl:release': '3',
      },
    });
    const wrapper = mountTimeline(json);
    expect(wrapper.text()).toContain('Review Details');
    expect(wrapper.text()).toContain('final');
    expect(wrapper.text()).toContain('accepted');
    expect(wrapper.text()).toContain('valid');
    expect(wrapper.text()).toContain('3');
  });

  it('groups by year when more than 3 entries', () => {
    const json = makeConceptJson({
      eng: {
        'gl:dates': [
          { 'gl:dateType': 'accepted', 'gl:date': '2019-03-01' },
          { 'gl:dateType': 'amended', 'gl:date': '2020-06-15' },
          { 'gl:dateType': 'amended', 'gl:date': '2021-09-20' },
          { 'gl:dateType': 'published', 'gl:date': '2023-01-10' },
        ],
      },
    });
    const wrapper = mountTimeline(json);
    expect(wrapper.text()).toContain('2019');
    expect(wrapper.text()).toContain('2020');
    expect(wrapper.text()).toContain('2021');
    expect(wrapper.text()).toContain('2023');
  });

  it('uses simple layout for 3 or fewer entries', () => {
    const json = makeConceptJson({
      eng: {
        'gl:dates': [
          { 'gl:dateType': 'accepted', 'gl:date': '2020-01-01' },
          { 'gl:dateType': 'amended', 'gl:date': '2022-06-15' },
        ],
      },
    });
    const wrapper = mountTimeline(json);
    expect(wrapper.text()).toContain('Concept accepted');
    expect(wrapper.text()).toContain('Definition amended');
  });

  it('deduplicates review date if it matches a gl:date entry', () => {
    const json = makeConceptJson({
      eng: {
        'gl:dates': [
          { 'gl:dateType': 'review', 'gl:date': '2023-05-15' },
        ],
        'gl:reviewDate': '2023-05-15',
      },
    });
    const wrapper = mountTimeline(json);
    const reviewCount = wrapper.text().split('Review initiated').length - 1;
    expect(reviewCount).toBeLessThanOrEqual(1);
  });
});
