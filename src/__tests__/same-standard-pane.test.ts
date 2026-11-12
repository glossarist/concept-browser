import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { RouterLink } from 'vue-router';
import SameStandardPane from '../components/SameStandardPane.vue';
import type { SameStandardTerms } from '../composables/use-same-standard-terms';
import { createTestRouter, setupPinia } from './test-helpers';

const groups: SameStandardTerms[] = [
  {
    key: 'iso-123', label: 'ISO 123:2024', terms: [
      { conceptId: 'current', designation: 'Current term' },
      { conceptId: 'other', designation: 'Related term' },
      { conceptId: 'third', designation: 'Third term' },
    ],
  },
  { key: 'iec-456', label: 'IEC 456:2020', terms: [{ conceptId: 'fourth', designation: 'Fourth term' }] },
];

describe('SameStandardPane', () => {
  let pinia: ReturnType<typeof setupPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    localStorage.clear();
    pinia = setupPinia();
    router = await createTestRouter('dataset');
  });

  afterEach(() => vi.restoreAllMocks());

  function mountPane(paneGroups = groups) {
    return mount(SameStandardPane, {
      props: { groups: paneGroups, registerId: 'test-register', conceptId: 'current' },
      global: { plugins: [pinia, router] },
    });
  }

  it('groups terms with filtered counts and named links in the current register', async () => {
    const wrapper = mountPane();
    const sections = wrapper.findAll('section');
    expect(sections).toHaveLength(2);
    expect(sections[0].find('h3').text()).toContain('ISO 123:2024');
    expect(sections[0].find('h3').text()).toContain('(2)');
    expect(sections[1].find('h3').text()).toContain('IEC 456:2020');
    expect(sections[1].find('h3').text()).toContain('(1)');
    expect(wrapper.text()).not.toContain('Current term');
    const links = wrapper.findAllComponents(RouterLink);
    expect(links.map(link => link.props('to'))).toEqual([
      { name: 'concept', params: { registerId: 'test-register', conceptId: 'other' } },
      { name: 'concept', params: { registerId: 'test-register', conceptId: 'third' } },
      { name: 'concept', params: { registerId: 'test-register', conceptId: 'fourth' } },
    ]);
    expect(wrapper.findAll('a').map(link => link.attributes('href'))).toEqual([
      '/dataset/test-register/concept/other',
      '/dataset/test-register/concept/third',
      '/dataset/test-register/concept/fourth',
    ]);
    expect(links[0].text()).toBe('Related term');
    await links[0].trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.params).toEqual({ registerId: 'test-register', conceptId: 'other' });
  });

  it('renders nothing for missing groups or groups containing only the current concept', () => {
    expect(mountPane([]).find('aside').exists()).toBe(false);
    expect(mountPane([{ key: 'empty', label: 'Empty standard', terms: [] }]).find('aside').exists()).toBe(false);
    expect(mountPane([{ ...groups[0], terms: [groups[0].terms[0]] }]).find('aside').exists()).toBe(false);
  });

  it('uses a native accessible toggle and persists collapsed state across remounts', async () => {
    const wrapper = mountPane();
    const button = wrapper.get('button');
    expect(button.attributes('type')).toBe('button');
    expect(button.attributes('aria-expanded')).toBe('true');
    const target = wrapper.get(`#${button.attributes('aria-controls')}`);
    expect(target.isVisible()).toBe(true);
    await button.trigger('click');
    expect(button.attributes('aria-expanded')).toBe('false');
    expect(target.isVisible()).toBe(false);
    wrapper.unmount();

    const remounted = mountPane();
    expect(remounted.get('button').attributes('aria-expanded')).toBe('false');
    await remounted.get('button').trigger('click');
    expect(remounted.get(`#${remounted.get('button').attributes('aria-controls')}`).isVisible()).toBe(true);
    remounted.unmount();
    expect(mountPane().get('button').attributes('aria-expanded')).toBe('true');
  });

  it('gives each pane its own controlled region', () => {
    const wrapper = mount({
      components: { SameStandardPane },
      setup: () => ({ groups }),
      template: '<div><SameStandardPane :groups="groups" register-id="test" concept-id="current" /><SameStandardPane :groups="groups" register-id="test" concept-id="current" /></div>',
    }, { global: { plugins: [pinia, router] } });
    const [first, second] = wrapper.findAll('button').map(button => button.attributes('aria-controls'));
    expect(first).toBeTruthy();
    expect(second).not.toBe(first);
  });

  it('continues toggling when storage reads or writes fail', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Unavailable'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Unavailable'); });
    const wrapper = mountPane();
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('true');
    await wrapper.get('button').trigger('click');
    expect(wrapper.get('button').attributes('aria-expanded')).toBe('false');
  });
});
