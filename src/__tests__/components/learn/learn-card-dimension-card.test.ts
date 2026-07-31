import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import LearnCard from '../../../components/learn/LearnCard.vue';
import DimensionCard from '../../../components/learn/DimensionCard.vue';

describe('LearnCard', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders the title and ISO reference', () => {
    const w = mount(LearnCard, {
      props: { title: 'partitive relation', isoReference: 'ISO 704:2022 §5.5.4.3' },
    });
    expect(w.find('h3').text()).toBe('partitive relation');
    expect(w.find('.font-mono').text()).toBe('ISO 704:2022 §5.5.4.3');
  });

  it('renders the body slot', () => {
    const w = mount(LearnCard, {
      props: { title: 'x' },
      slots: { default: '<p>Body content</p>' },
    });
    expect(w.find('.learn-card-body').html()).toContain('Body content');
  });

  it('renders the example slot in its own section', () => {
    const w = mount(LearnCard, {
      props: { title: 'x' },
      slots: { example: 'VIM 1.9 measurement unit' },
    });
    expect(w.find('.learn-card-example').text()).toContain('VIM 1.9');
  });

  it('omits the "learn more" footer when learnMoreUrl is absent', () => {
    const w = mount(LearnCard, { props: { title: 'x' } });
    expect(w.find('.learn-card-footer').exists()).toBe(false);
  });

  it('renders the learn-more footer when learnMoreUrl is present', () => {
    const w = mount(LearnCard, {
      props: { title: 'x', learnMoreUrl: 'https://www.glossarist.org/model/x' },
    });
    const link = w.find('.learn-card-footer a');
    expect(link.attributes('href')).toBe('https://www.glossarist.org/model/x');
    expect(link.attributes('target')).toBe('_blank');
    expect(link.attributes('rel')).toBe('noopener');
  });

  it('binds the id prop for deep-link anchors', () => {
    const w = mount(LearnCard, {
      props: { id: '__partitive__', title: 'x' },
    });
    expect(w.find('article').attributes('id')).toBe('__partitive__');
  });
});

describe('DimensionCard', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders one row per value', () => {
    const w = mount(DimensionCard, {
      props: {
        name: 'Presence',
        summary: 'Compulsory or optional',
        values: [
          { value: 'required', label: 'required', meaning: 'must be present' },
          { value: 'optional', label: 'optional', meaning: 'may be absent' },
        ],
      },
    });
    expect(w.findAll('.dimension-value-row').length).toBe(2);
  });

  it('renders value labels and meanings', () => {
    const w = mount(DimensionCard, {
      props: {
        name: 'x',
        summary: 's',
        values: [{ value: 'required', label: 'required', meaning: 'must be present' }],
      },
    });
    const row = w.find('.dimension-value-row');
    expect(row.text()).toContain('required');
    expect(row.text()).toContain('must be present');
  });

  it('exposes a visual scoped slot per value', () => {
    const w = mount(DimensionCard, {
      props: {
        name: 'x',
        summary: 's',
        values: [{ value: 'required', label: 'required', meaning: 'm' }],
      },
      slots: {
        visual: '<svg data-test="custom-visual" />',
      },
    });
    expect(w.find('svg[data-test="custom-visual"]').exists()).toBe(true);
  });

  it('binds the id prop for deep-link anchors', () => {
    const w = mount(DimensionCard, {
      props: {
        id: 'partitive-presence',
        name: 'x',
        summary: 's',
        values: [{ value: 'required', label: 'required', meaning: 'm' }],
      },
    });
    expect(w.find('article').attributes('id')).toBe('partitive-presence');
  });
});
