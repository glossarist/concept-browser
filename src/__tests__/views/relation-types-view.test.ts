import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import RelationTypesView from '../../views/RelationTypesView.vue';

/**
 * Smoke + structure tests for the Relation Types teaching page.
 *
 * Hyperedge section: 2 cards (partitive + general) with anchors.
 * Bilateral section: at least one category with type rows.
 */
async function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/relation-types', name: 'relation-types', component: RelationTypesView },
    ],
  });
  await router.push('/relation-types');
  await router.isReady();
  return router;
}

describe('RelationTypesView', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders the page header with translated title', async () => {
    const router = await makeRouter();
    const w = mount(RelationTypesView, { global: { plugins: [router] } });
    expect(w.find('h1').text()).toContain('Relation Types');
  });

  it('renders both hyperedge cards with the expected anchors', async () => {
    const router = await makeRouter();
    const w = mount(RelationTypesView, { global: { plugins: [router] } });
    const cards = w.findAll('.hyperedge-card');
    expect(cards.length).toBe(2);
    const ids = cards.map(c => c.attributes('id'));
    expect(ids).toContain('__partitive__');
    expect(ids).toContain('__generic__');
  });

  it('renders a HyperedgeDiagram child for each card', async () => {
    const router = await makeRouter();
    const w = mount(RelationTypesView, { global: { plugins: [router] } });
    /* The HyperedgeDiagram component renders an <svg class="hyperedge-diagram"> */
    expect(w.findAll('svg.hyperedge-diagram').length).toBe(2);
  });

  it('renders the bilateral section grouped by category', async () => {
    const router = await makeRouter();
    const w = mount(RelationTypesView, { global: { plugins: [router] } });
    const bilateralArticles = w.findAll('section[aria-label="Bilateral relations (one-to-one)"] article');
    /* The taxonomy has ≥5 categories (hierarchical, associative, lifecycle, …). */
    expect(bilateralArticles.length).toBeGreaterThanOrEqual(5);
  });

  it('every bilateral type row has an id anchor matching the type key', async () => {
    const router = await makeRouter();
    const w = mount(RelationTypesView, { global: { plugins: [router] } });
    const rows = w.findAll('.bilateral-row');
    expect(rows.length).toBeGreaterThan(10); /* taxonomy has ~40 types */
    for (const row of rows) {
      const id = row.attributes('id');
      expect(id).toBeTruthy();
      expect(id).toMatch(/^[a-z_]+$/);
    }
  });

  it('renders label + ISO standard + definition for each hyperedge card', async () => {
    const router = await makeRouter();
    const w = mount(RelationTypesView, { global: { plugins: [router] } });
    const cards = w.findAll('.hyperedge-card');
    for (const card of cards) {
      /* Label is the h3 heading; ISO reference is a mono span; definition is a paragraph. */
      expect(card.find('h3').text()).toBeTruthy();
      expect(card.find('span.font-mono').text()).toMatch(/ISO 704/);
      expect(card.find('p').text().length).toBeGreaterThan(20);
    }
  });
});
