import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import LearnStatusesView from '../../../views/learn/LearnStatusesView.vue';

async function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/learn/statuses', name: 'learn-statuses', component: LearnStatusesView },
      { path: '/learn/designations', name: 'learn-designations', component: { template: '<div/>' } },
    ],
  });
  await router.push('/learn/statuses');
  await router.isReady();
  return router;
}

describe('LearnStatusesView', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders the page header', async () => {
    const router = await makeRouter();
    const w = mount(LearnStatusesView, { global: { plugins: [router] } });
    expect(w.find('h1').text()).toContain('Statuses');
  });

  it('renders three top-level sections (entry, normative, source)', async () => {
    const router = await makeRouter();
    const w = mount(LearnStatusesView, { global: { plugins: [router] } });
    const sections = w.findAll('section[aria-label]');
    expect(sections.length).toBe(3);
  });

  it('entry section renders all four entry statuses with anchors', async () => {
    const router = await makeRouter();
    const w = mount(LearnStatusesView, { global: { plugins: [router] } });
    const entrySection = w.find('section[aria-label="Entry status"]');
    const ids = entrySection.findAll('.learn-card[id]').map(c => c.attributes('id'));
    expect(ids).toEqual(expect.arrayContaining(['entry-valid', 'entry-withdrawn', 'entry-draft', 'entry-superseded']));
  });

  it('normative section cross-links to /learn/designations', async () => {
    const router = await makeRouter();
    const w = mount(LearnStatusesView, { global: { plugins: [router] } });
    const normative = w.find('section[aria-label="Normative status"]');
    const link = normative.find('a');
    expect(link.attributes('href')).toBe('/learn/designations');
  });

  it('source section renders the four source statuses with anchors', async () => {
    const router = await makeRouter();
    const w = mount(LearnStatusesView, { global: { plugins: [router] } });
    const sourceSection = w.find('section[aria-label="Source status"]');
    const ids = sourceSection.findAll('.learn-card[id]').map(c => c.attributes('id'));
    expect(ids).toEqual(expect.arrayContaining(['source-identical', 'source-modified', 'source-restyled', 'source-lineage']));
  });
});
