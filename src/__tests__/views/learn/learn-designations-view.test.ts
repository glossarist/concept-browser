import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import LearnDesignationsView from '../../../views/learn/LearnDesignationsView.vue';

async function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/learn/designations', name: 'learn-designations', component: LearnDesignationsView },
    ],
  });
  await router.push('/learn/designations');
  await router.isReady();
  return router;
}

describe('LearnDesignationsView', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders the page header', async () => {
    const router = await makeRouter();
    const w = mount(LearnDesignationsView, { global: { plugins: [router] } });
    expect(w.find('h1').text()).toContain('Designations');
  });

  it('renders three top-level sections (normative, kinds, types)', async () => {
    const router = await makeRouter();
    const w = mount(LearnDesignationsView, { global: { plugins: [router] } });
    const sections = w.findAll('section[aria-label]');
    expect(sections.length).toBe(3);
  });

  it('normative section has all three ratings (preferred/admitted/deprecated)', async () => {
    const router = await makeRouter();
    const w = mount(LearnDesignationsView, { global: { plugins: [router] } });
    const normative = w.find('section[aria-label="Normative status"]');
    const cardTitles = normative.findAll('h3').map(h => h.text());
    expect(cardTitles).toEqual(expect.arrayContaining([
      'preferred term', 'admitted term', 'deprecated term',
    ]));
  });

  it('each normative card notes "there can be more than one"', async () => {
    /* The user's specific concern: explain that there can be multiple. */
    const router = await makeRouter();
    const w = mount(LearnDesignationsView, { global: { plugins: [router] } });
    const normative = w.find('section[aria-label="Normative status"]');
    const notes = normative.findAll('.italic').map(i => i.text().toLowerCase());
    expect(notes.filter(t => t.includes('more than one')).length).toBe(3);
  });

  it('kinds section renders all four kinds (full form, abbreviated, borrowed, variant)', async () => {
    const router = await makeRouter();
    const w = mount(LearnDesignationsView, { global: { plugins: [router] } });
    const kinds = w.find('section[aria-label="Kinds and forms of term"]');
    const titles = kinds.findAll('h3').map(h => h.text());
    expect(titles).toEqual(expect.arrayContaining([
      'full form', 'abbreviated form', 'borrowed term', 'variant',
    ]));
  });

  it('types section renders term, acronym, initialism, symbol', async () => {
    const router = await makeRouter();
    const w = mount(LearnDesignationsView, { global: { plugins: [router] } });
    const types = w.find('section[aria-label="Designation types"]');
    const titles = types.findAll('h3').map(h => h.text());
    expect(titles).toEqual(expect.arrayContaining([
      'term (expression)', 'acronym', 'initialism', 'symbol',
    ]));
  });

  it('every example slot mentions a concrete ISO example', async () => {
    const router = await makeRouter();
    const w = mount(LearnDesignationsView, { global: { plugins: [router] } });
    const examples = w.findAll('.learn-card-example').map(e => e.text());
    expect(examples.some(t => t.includes('compact disc'))).toBe(true);
    expect(examples.some(t => t.includes('WWW'))).toBe(true);
    expect(examples.some(t => t.includes('laser'))).toBe(true);
    expect(examples.some(t => t.includes('OIML'))).toBe(true);
  });
});
