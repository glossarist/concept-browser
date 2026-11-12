import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import SearchResults from '../components/SearchResults.vue';
import { entryStatusColor, entryStatusDefinition, entryStatusLabel } from '../utils/concept-helpers';
import { setupPinia, makeSearchHit } from './test-helpers';

describe('SearchResults', () => {
  function mountResults(hits: ReturnType<typeof makeSearchHit>[]) {
    const pinia = setupPinia();
    return mount(SearchResults, {
      props: {
        loading: false,
        searchError: null,
        searched: true,
        searchQuery: 'term',
        results: hits,
        groupedResults: [{ registerId: 'test', title: 'Test Dataset', hits }],
        selectedIdx: -1,
      },
      global: { plugins: [pinia] },
    });
  }

  it('shows entry status labels, taxonomy colors, and definitions while preserving search-hit behavior', async () => {
    const valid = makeSearchHit({ conceptId: '1', designation: 'Current term', language: 'eng', matchField: 'id', status: 'valid' });
    const superseded = makeSearchHit({ conceptId: '2', designation: 'Old term', language: 'fra', status: 'superseded' });
    const wrapper = mountResults([valid, superseded]);
    const buttons = wrapper.findAll('button');
    const validBadge = buttons[0].findAll('.badge').find(badge => badge.text() === entryStatusLabel('valid'));
    const supersededBadge = buttons[1].findAll('.badge').find(badge => badge.text() === entryStatusLabel('superseded'));

    expect(validBadge).toBeDefined();
    expect(validBadge!.classes()).toContain('badge-green');
    expect(validBadge!.classes()).toEqual(expect.arrayContaining(entryStatusColor('valid').split(' ')));
    expect(validBadge!.attributes('title')).toBe(entryStatusDefinition('valid'));
    expect(supersededBadge).toBeDefined();
    expect(supersededBadge!.classes()).toContain('bg-red-50');
    expect(supersededBadge!.classes()).toContain('text-red-700');
    expect(supersededBadge!.classes()).toEqual(expect.arrayContaining(entryStatusColor('superseded').split(' ')));
    expect(supersededBadge!.attributes('title')).toBe(entryStatusDefinition('superseded'));

    expect(buttons[0].text()).toContain('Current term');
    expect(buttons[0].text()).toContain('ID');
    expect(buttons[0].text()).toContain('English');
    expect(buttons[1].text()).toContain('French');
    await buttons[0].trigger('click');
    expect(wrapper.emitted('goHit')?.[0]).toEqual([valid]);
  });

  it('does not render an entry status badge when a hit has no status', () => {
    const wrapper = mountResults([makeSearchHit({ designation: 'Unclassified term' })]);
    expect(wrapper.findAll('.badge')).toHaveLength(0);
  });
});
