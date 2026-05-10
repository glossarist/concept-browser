import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import ConceptTimeline from '../components/ConceptTimeline.vue';
import type { LocalizedConcept } from '../adapters/types';

function makeLocalizedConcept(overrides: Partial<LocalizedConcept> = {}): LocalizedConcept {
  return {
    '@id': 'https://glossarist.org/test/concept/1/eng',
    '@type': 'gl:LocalizedConcept',
    'gl:languageCode': 'eng',
    'gl:entryStatus': 'valid',
    ...overrides,
  };
}

function mountTimeline(lcs: Record<string, LocalizedConcept>, activeLang = 'eng', languageOrder?: string[]) {
  return mount(ConceptTimeline, {
    props: {
      localizedConcepts: lcs,
      activeLang,
      languageOrder,
    },
  });
}

describe('ConceptTimeline', () => {
  it('shows empty state when no history data', () => {
    const lc = makeLocalizedConcept({ 'gl:entryStatus': undefined });
    const wrapper = mountTimeline({ eng: lc });
    expect(wrapper.text()).toContain('No history data available');
  });

  it('renders review date as timeline entry', () => {
    const lc = makeLocalizedConcept({
      'gl:reviewDate': '2023-05-15',
    });
    const wrapper = mountTimeline({ eng: lc });
    expect(wrapper.text()).toContain('Review initiated');
    expect(wrapper.text()).toContain('2023');
  });

  it('renders review decision event', () => {
    const lc = makeLocalizedConcept({
      'gl:reviewDecisionEvent': 'Accepted',
      'gl:reviewDate': '2023-05-15',
      'gl:reviewDecisionDate': '2023-06-01',
    });
    const wrapper = mountTimeline({ eng: lc });
    // The review event banner
    expect(wrapper.text()).toContain('Accepted');
  });

  it('renders gl:dates entries', () => {
    const lc = makeLocalizedConcept({
      'gl:dates': [
        { 'gl:dateType': 'accepted', 'gl:date': '2020-01-01' },
        { 'gl:dateType': 'amended', 'gl:date': '2022-06-15' },
      ],
    });
    const wrapper = mountTimeline({ eng: lc });
    expect(wrapper.text()).toContain('Concept accepted');
    expect(wrapper.text()).toContain('Definition amended');
    expect(wrapper.text()).toContain('2020');
    expect(wrapper.text()).toContain('2022');
  });

  it('sorts entries by date ascending', () => {
    const lc = makeLocalizedConcept({
      'gl:dates': [
        { 'gl:dateType': 'amended', 'gl:date': '2022-06-15' },
        { 'gl:dateType': 'accepted', 'gl:date': '2020-01-01' },
      ],
    });
    const wrapper = mountTimeline({ eng: lc });
    const texts = wrapper.text();
    // "accepted" entry should appear before "amended" in the rendered output
    const acceptedIdx = texts.indexOf('Concept accepted');
    const amendedIdx = texts.indexOf('Definition amended');
    expect(acceptedIdx).toBeLessThan(amendedIdx);
  });

  it('shows language selector when multiple languages have history', () => {
    const eng = makeLocalizedConcept({ 'gl:reviewDate': '2023-01-01' });
    const fra = makeLocalizedConcept({
      '@id': 'https://glossarist.org/test/concept/1/fra',
      'gl:languageCode': 'fra',
      'gl:reviewDate': '2023-02-01',
    });
    const wrapper = mountTimeline({ eng, fra }, 'eng', ['eng', 'fra']);
    expect(wrapper.text()).toContain('French');
  });

  it('does not show language selector for single-language history', () => {
    const eng = makeLocalizedConcept({ 'gl:reviewDate': '2023-01-01' });
    const wrapper = mountTimeline({ eng });
    // Should not have multiple language buttons
    const buttons = wrapper.findAll('button');
    const langButtons = buttons.filter(b => b.text().includes('French'));
    expect(langButtons.length).toBe(0);
  });

  it('emits update:activeLang on language button click', async () => {
    const eng = makeLocalizedConcept({ 'gl:reviewDate': '2023-01-01' });
    const fra = makeLocalizedConcept({
      '@id': 'https://glossarist.org/test/concept/1/fra',
      'gl:languageCode': 'fra',
      'gl:reviewDate': '2023-02-01',
    });
    const wrapper = mountTimeline({ eng, fra }, 'eng', ['eng', 'fra']);
    const fraBtn = wrapper.findAll('button').find(b => b.text().includes('French'));
    expect(fraBtn).toBeDefined();
    await fraBtn!.trigger('click');
    expect(wrapper.emitted('update:activeLang')?.[0]).toEqual(['fra']);
  });

  it('shows review metadata when present', () => {
    const lc = makeLocalizedConcept({
      'gl:reviewDate': '2023-01-01',
      'gl:reviewStatus': 'final',
      'gl:reviewDecision': 'accepted',
      'gl:entryStatus': 'valid',
      'gl:release': 3,
    });
    const wrapper = mountTimeline({ eng: lc });
    expect(wrapper.text()).toContain('Review Details');
    expect(wrapper.text()).toContain('final');
    expect(wrapper.text()).toContain('accepted');
    expect(wrapper.text()).toContain('valid');
    expect(wrapper.text()).toContain('3');
  });

  it('groups by year when more than 3 entries', () => {
    const lc = makeLocalizedConcept({
      'gl:dates': [
        { 'gl:dateType': 'accepted', 'gl:date': '2019-03-01' },
        { 'gl:dateType': 'amended', 'gl:date': '2020-06-15' },
        { 'gl:dateType': 'amended', 'gl:date': '2021-09-20' },
        { 'gl:dateType': 'published', 'gl:date': '2023-01-10' },
      ],
    });
    const wrapper = mountTimeline({ eng: lc });
    // Year markers should be rendered
    expect(wrapper.text()).toContain('2019');
    expect(wrapper.text()).toContain('2020');
    expect(wrapper.text()).toContain('2021');
    expect(wrapper.text()).toContain('2023');
  });

  it('uses simple layout for 3 or fewer entries', () => {
    const lc = makeLocalizedConcept({
      'gl:dates': [
        { 'gl:dateType': 'accepted', 'gl:date': '2020-01-01' },
        { 'gl:dateType': 'amended', 'gl:date': '2022-06-15' },
      ],
    });
    const wrapper = mountTimeline({ eng: lc });
    // Should have entries but no year grouping markers
    expect(wrapper.text()).toContain('Concept accepted');
    expect(wrapper.text()).toContain('Definition amended');
  });

  it('deduplicates review date if it matches a gl:date entry', () => {
    const lc = makeLocalizedConcept({
      'gl:dates': [
        { 'gl:dateType': 'review', 'gl:date': '2023-05-15' },
      ],
      'gl:reviewDate': '2023-05-15',
    });
    const wrapper = mountTimeline({ eng: lc });
    // Should only have one entry for that date, not two "review" entries
    const reviewCount = wrapper.text().split('Review initiated').length - 1;
    expect(reviewCount).toBeLessThanOrEqual(1);
  });
});
