import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import LearnRelationshipsView from '../../../views/learn/LearnRelationshipsView.vue';

async function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/learn/relationships', name: 'learn-relationships', component: LearnRelationshipsView },
    ],
  });
  await router.push('/learn/relationships');
  await router.isReady();
  return router;
}

describe('LearnRelationshipsView', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders the page header with translated title', async () => {
    const router = await makeRouter();
    const w = mount(LearnRelationshipsView, { global: { plugins: [router] } });
    expect(w.find('h1').text()).toContain('Relationships');
  });

  it('renders three top-level sections (bilateral, partitive, general)', async () => {
    const router = await makeRouter();
    const w = mount(LearnRelationshipsView, { global: { plugins: [router] } });
    const sections = w.findAll('section[aria-label]');
    expect(sections.length).toBe(3);
  });

  it('renders the hyperedge cards with the expected anchors', async () => {
    const router = await makeRouter();
    const w = mount(LearnRelationshipsView, { global: { plugins: [router] } });
    const ids = w.findAll('.learn-card[id]').map(c => c.attributes('id'));
    expect(ids).toContain('__partitive__');
    expect(ids).toContain('__generic__');
  });

  it('renders three DimensionCards for the partitive dimensions', async () => {
    const router = await makeRouter();
    const w = mount(LearnRelationshipsView, { global: { plugins: [router] } });
    const dimIds = w.findAll('.dimension-card[id]').map(c => c.attributes('id'));
    expect(dimIds).toEqual(expect.arrayContaining(['partitive-presence', 'partitive-count', 'partitive-delimiting']));
  });

  it('renders the bilateral section grouped by category', async () => {
    const router = await makeRouter();
    const w = mount(LearnRelationshipsView, { global: { plugins: [router] } });
    const bilateralArticles = w.find('section[aria-label="Bilateral relations (one-to-one)"]').findAll('article');
    expect(bilateralArticles.length).toBeGreaterThanOrEqual(5);
  });

  it('every bilateral type row has an id anchor matching the type key', async () => {
    const router = await makeRouter();
    const w = mount(LearnRelationshipsView, { global: { plugins: [router] } });
    const rows = w.findAll('.bilateral-row');
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      const id = row.attributes('id');
      expect(id).toBeTruthy();
      expect(id).toMatch(/^[a-z_]+$/);
    }
  });

  it('renders a live diagram for each hyperedge card', async () => {
    const router = await makeRouter();
    const w = mount(LearnRelationshipsView, { global: { plugins: [router] } });
    expect(w.findAll('svg.hyperedge-diagram').length).toBe(2);
  });

  it('renders ISO references on each hyperedge card', async () => {
    const router = await makeRouter();
    const w = mount(LearnRelationshipsView, { global: { plugins: [router] } });
    const isoRefs = w.findAll('.learn-card span.font-mono').map(s => s.text());
    expect(isoRefs.some(t => t.includes('ISO 704:2022 §5.5.4.3'))).toBe(true);
    expect(isoRefs.some(t => t.includes('ISO 704:2022 §5.5.4.2'))).toBe(true);
  });
});
