import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import AppSidebar from '../components/AppSidebar.vue';
import { useVocabularyStore } from '../stores/vocabulary';

function makeManifest(id = 'test') {
  return { id, datasetUri: `https://glossarist.org/${id}/concept`, title: `Test ${id}`, description: 'A test dataset',
    owner: 'ISO', baseUrl: `/data/${id}`, languages: ['eng'], conceptCount: 50,
    conceptUrlTemplate: `/data/${id}/concepts/{id}.json`, indexUrl: `/data/${id}/index.json`,
    contextUrl: `/data/${id}/context.json`, uriBase: 'https://glossarist.org', status: 'published',
    schemaVersion: '1.0', tags: [], lastUpdated: '2025-01-01', sourceRepo: 'https://example.com/repo',
    chunkSize: 1000, color: '#3366ff' } as any;
}

function createTestRouter(initialPath = '/') {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/dataset/:registerId', name: 'dataset', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/stats', name: 'stats', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/about', name: 'about', component: { template: '<div/>' } },
      { path: '/search', name: 'search', component: { template: '<div/>' } },
      { path: '/about', name: 'about-global', component: { template: '<div/>' } },
    ],
  });
}

function seedStore(datasets: string[] = ['test']) {
  const store = useVocabularyStore();
  for (const id of datasets) {
    store.manifests.set(id, makeManifest(id));
    store.datasets.set(id, { index: [], getConceptCount: () => 0, getConcepts: () => [] } as any);
  }
}

/**
 * Returns all <a> elements with the custom 'active' class.
 * This is the class added by the isActive() function in AppSidebar,
 * distinct from Vue Router's built-in router-link-active.
 */
function getActiveHrefs(wrapper: ReturnType<typeof mount>): string[] {
  return wrapper.findAll('a.active').map(l => l.attributes('href') || '');
}

describe('AppSidebar — nav highlighting (isActive)', () => {
  let pinia: ReturnType<typeof createPinia>;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  async function mountSidebar(initialPath = '/') {
    const router = createTestRouter(initialPath);
    router.push(initialPath);
    await router.isReady();
    return mount(AppSidebar, {
      global: { plugins: [pinia, router], stubs: { NavIcon: true } },
    });
  }

  // ── The bug: dataset About should NOT activate global About ─────────

  it('on /dataset/test/about: ONLY dataset about link is active', async () => {
    seedStore();
    const wrapper = await mountSidebar('/dataset/test/about');
    const activeHrefs = getActiveHrefs(wrapper);
    // Dataset about link IS active
    expect(activeHrefs).toContain('/dataset/test/about');
    // Global /about link is NOT active (this was the bug)
    expect(activeHrefs).not.toContain('/about');
    // Only one active link total
    expect(activeHrefs).toEqual(['/dataset/test/about']);
  });

  it('on /dataset/test/about: no link to /about (global) has active class', async () => {
    seedStore();
    const wrapper = await mountSidebar('/dataset/test/about');
    const allLinks = wrapper.findAll('a');
    const globalAboutLinks = allLinks.filter(l => l.attributes('href') === '/about');
    // If global about link exists, it must NOT have custom active class
    for (const link of globalAboutLinks) {
      expect(link.classes()).not.toContain('active');
    }
  });

  // ── Global About page still works ───────────────────────────────────


  it('on /about: dataset about links are NOT active', async () => {
    seedStore();
    const wrapper = await mountSidebar('/about');
    const allLinks = wrapper.findAll('a');
    const datasetAboutActive = allLinks.filter(
      l => (l.attributes('href') || '').includes('/dataset/') &&
           (l.attributes('href') || '').includes('/about') &&
           l.classes().includes('active')
    );
    expect(datasetAboutActive).toEqual([]);
  });

  // ── Dataset root: dataset Concepts active, global Home not ──────────

  it('on /dataset/test: dataset sub-nav is active', async () => {
    seedStore();
    const wrapper = await mountSidebar('/dataset/test');
    // Something should be active (the dataset concepts sub-page)
    const activeHrefs = getActiveHrefs(wrapper);
    expect(activeHrefs.length).toBeGreaterThanOrEqual(1);
  });

  it('on /dataset/test: global nav links are NOT active', async () => {
    seedStore();
    const wrapper = await mountSidebar('/dataset/test');
    const allLinks = wrapper.findAll('a');
    // Global Search link must NOT be active
    const searchActive = allLinks.filter(
      l => l.attributes('href') === '/search' && l.classes().includes('active')
    );
    expect(searchActive).toEqual([]);
  });

  // ── Concept page: dataset Concepts still active ─────────────────────

  it('on /dataset/test/concept/1.2: dataset sub-nav is active', async () => {
    seedStore();
    const wrapper = await mountSidebar('/dataset/test/concept/1.2');
    const activeHrefs = getActiveHrefs(wrapper);
    expect(activeHrefs.length).toBeGreaterThanOrEqual(1);
  });

  // ── Cross-dataset isolation ─────────────────────────────────────────

  it('on /dataset/ds-a/about: ds-b about is NOT active', async () => {
    seedStore(['ds-a', 'ds-b']);
    const wrapper = await mountSidebar('/dataset/ds-a/about');
    const activeHrefs = getActiveHrefs(wrapper);
    expect(activeHrefs).toContain('/dataset/ds-a/about');
    expect(activeHrefs).not.toContain('/dataset/ds-b/about');
  });

  // ── Root route ──────────────────────────────────────────────────────

  it('on /: Home link is active', async () => {
    seedStore();
    const wrapper = await mountSidebar('/');
    const activeHrefs = getActiveHrefs(wrapper);
    expect(activeHrefs).toContain('/');
  });

  it('on /: search and about are NOT active', async () => {
    seedStore();
    const wrapper = await mountSidebar('/');
    const activeHrefs = getActiveHrefs(wrapper);
    expect(activeHrefs).not.toContain('/search');
    expect(activeHrefs).not.toContain('/about');
  });

  // ── Dataset stats page ──────────────────────────────────────────────

  it('on /dataset/test/stats: stats sub-page is active', async () => {
    seedStore();
    const wrapper = await mountSidebar('/dataset/test/stats');
    const activeHrefs = getActiveHrefs(wrapper);
    expect(activeHrefs).toContain('/dataset/test/stats');
  });

  it('on /dataset/test/stats: about sub-page is NOT active', async () => {
    seedStore();
    const wrapper = await mountSidebar('/dataset/test/stats');
    const activeHrefs = getActiveHrefs(wrapper);
    expect(activeHrefs).not.toContain('/dataset/test/about');
  });
});
