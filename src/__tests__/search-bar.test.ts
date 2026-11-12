import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import SearchBar from '../components/SearchBar.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useUiStore } from '../stores/ui';
import { entryStatusColor, entryStatusLabel } from '../utils/concept-helpers';
import type { Manifest, SearchHit } from '../adapters/types';

const siteConfig = vi.hoisted(() => ({ value: null as null | { defaults: { language?: string; languageOrder?: string[] } } }));
vi.mock('../config/use-site-config', () => ({ useSiteConfig: () => ({ config: siteConfig }) }));

function makeManifest(): Manifest {
  return {
    id: 'test',
    datasetUri: 'https://glossarist.org/test/concept',
    title: 'Test Dataset',
    description: 'A test dataset',
    owner: 'ISO',
    baseUrl: '/data/test',
    languages: ['eng'],
    conceptCount: 10,
    conceptUrlTemplate: '/data/test/concepts/{id}.json',
    indexUrl: '/data/test/index.json',
    contextUrl: '/data/test/context.json',
    uriBase: 'https://glossarist.org',
    status: 'published',
    schemaVersion: '1.0',
    tags: [],
    lastUpdated: '2025-01-01',
    sourceRepo: 'https://example.com/repo',
    chunkSize: 1000,
    color: '#3366ff',
  };
}

function makeHit(overrides: Partial<SearchHit> = {}): SearchHit {
  return {
    conceptId: '3.1.1.1',
    registerId: 'test',
    designation: 'test term',
    language: 'eng',
    matchField: 'designation',
    ...overrides,
  };
}

async function createTestRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/search', name: 'search', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: { template: '<div/>' } },
    ],
  });
}

describe('SearchBar', () => {
  let pinia: ReturnType<typeof createPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;
  let store: ReturnType<typeof useVocabularyStore>;

  beforeEach(async () => {
    localStorage.removeItem('searchSort');
    siteConfig.value = null;
    pinia = createPinia();
    setActivePinia(pinia);
    router = await createTestRouter();
    router.push('/search');
    await router.isReady();
    store = useVocabularyStore();
    store.manifests.set('test', makeManifest());
    store.datasets.set('test', { index: [], getConceptCount: () => 0, getConcepts: () => [], search: () => [] } as any);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function mountSearch() {
    return mount(SearchBar, {
      global: { plugins: [pinia, router] },
    });
  }

  it('renders search input with placeholder', () => {
    const wrapper = mountSearch();
    const input = wrapper.find('input');
    expect(input.exists()).toBe(true);
    expect(input.attributes('placeholder')).toContain('Search terms');
  });

  it('shows clear button when query is entered', async () => {
    const wrapper = mountSearch();
    const input = wrapper.find('input');
    await input.setValue('road');
    const clearBtn = wrapper.findAll('button').find(b => b.element.closest('.relative')?.querySelector('input'));
    // There should be a close/X button visible
    expect(wrapper.html()).toContain('M6 18L18 6M6 6l12 12');
  });

  it('clears search on clear button click', async () => {
    const wrapper = mountSearch();
    const input = wrapper.find('input');
    await input.setValue('road');
    // Find and click the clear button (the one inside the relative div, after the input)
    const clearBtn = wrapper.findAll('button').find(b => b.text() === '' && b.find('svg').exists() && b.element.closest('.relative') !== null);
    if (clearBtn) {
      await clearBtn.trigger('click');
      expect(wrapper.find('input').element.value).toBe('');
    }
  });

  it('clears shared search state and does not restore it after remount', async () => {
    const hits: SearchHit[] = [makeHit({ designation: 'road network' })];
    store.searchAcrossDatasets = vi.fn(async () => hits);
    const ui = useUiStore();
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    expect(ui.searchQuery).toBe('road');
    expect(wrapper.text()).toContain('road network');
    expect(router.currentRoute.value.query.q).toBe('road');

    const clearBtn = wrapper.findAll('button').find(b => b.find('svg').exists() && b.element.closest('.relative') !== null);
    expect(clearBtn).toBeDefined();
    await clearBtn!.trigger('click');
    await flushPromises();

    expect(wrapper.find('input').element.value).toBe('');
    expect(ui.searchQuery).toBe('');
    expect(wrapper.text()).not.toContain('road network');
    expect(router.currentRoute.value.query.q).toBeUndefined();

    wrapper.unmount();
    const callsBeforeRemount = vi.mocked(store.searchAcrossDatasets).mock.calls.length;
    const remounted = mountSearch();
    await flushPromises();
    expect(remounted.find('input').element.value).toBe('');
    expect(vi.mocked(store.searchAcrossDatasets)).toHaveBeenCalledTimes(callsBeforeRemount);
    remounted.unmount();
  });

  it('cancels a pending search debounce when cleared', async () => {
    store.searchAcrossDatasets = vi.fn(async () => []);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    expect(vi.getTimerCount()).toBe(1);

    const clearBtn = wrapper.findAll('button').find(b => b.find('svg').exists() && b.element.closest('.relative') !== null);
    expect(clearBtn).toBeDefined();
    await clearBtn!.trigger('click');
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(300);
    expect(store.searchAcrossDatasets).not.toHaveBeenCalled();
    wrapper.unmount();
  });

  it.each(['resolve', 'reject'] as const)('ignores an in-flight search that %s after clearing', async (outcome) => {
    let resolveSearch!: (hits: SearchHit[]) => void;
    let rejectSearch!: (error: Error) => void;
    store.searchAcrossDatasets = vi.fn(() => new Promise<SearchHit[]>((resolve, reject) => {
      resolveSearch = resolve;
      rejectSearch = reject;
    }));
    const ui = useUiStore();
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    expect(store.searchAcrossDatasets).toHaveBeenCalledWith('road');
    expect(wrapper.html()).toContain('animate-spin');

    await wrapper.get('button[type="button"]').trigger('click');
    await flushPromises();

    if (outcome === 'resolve') {
      resolveSearch([makeHit({ designation: 'road network' })]);
    } else {
      rejectSearch(new Error('Late search failure'));
    }
    await flushPromises();

    expect(wrapper.find('input').element.value).toBe('');
    expect(ui.searchQuery).toBe('');
    expect(wrapper.find('.search-results').exists()).toBe(false);
    expect(wrapper.text()).not.toContain('road network');
    expect(wrapper.text()).not.toContain('Late search failure');
    expect(router.currentRoute.value.query.q).toBeUndefined();
    expect(wrapper.html()).not.toContain('animate-spin');
    wrapper.unmount();
  });

  it('shows loading spinner during search', async () => {
    const wrapper = mountSearch();
    // Mock a slow search
    store.searchAcrossDatasets = vi.fn(() => new Promise<SearchHit[]>(() => {}));
    const input = wrapper.find('input');
    await input.setValue('road');
    const form = wrapper.find('form');
    await form.trigger('submit');
    await flushPromises();
    // Should show spinner SVG
    expect(wrapper.html()).toContain('animate-spin');
  });

  it('shows results after search', async () => {
    const hits: SearchHit[] = [
      makeHit({ conceptId: '3.1.1.1', designation: 'road network' }),
      makeHit({ conceptId: '3.1.1.2', designation: 'road user' }),
    ];
    store.searchAcrossDatasets = vi.fn(async () => hits);
    const wrapper = mountSearch();
    const input = wrapper.find('input');
    await input.setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('2 results');
    expect(wrapper.text()).toContain('road network');
    expect(wrapper.text()).toContain('road user');
  });

  it('lists English before higher-ranked French hits and navigates in rendered order', async () => {
    store.searchAcrossDatasets = vi.fn(async () => [
      makeHit({ conceptId: 'french', designation: 'route', language: 'fra' }),
      makeHit({ conceptId: 'english', designation: 'road', language: 'eng' }),
    ]);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.findAll('.card-hover').map(hit => hit.text())).toEqual([
      expect.stringContaining('road'), expect.stringContaining('route'),
    ]);
    await wrapper.find('input').trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.find('.search-hit-selected').text()).toContain('road');

    await wrapper.get('select').setValue('relevance');
    expect(useUiStore().searchSort).toBe('relevance');
    expect(localStorage.getItem('searchSort')).toBe('relevance');
    expect(wrapper.find('.search-hit-selected').exists()).toBe(false);
    expect(wrapper.findAll('.card-hover').map(hit => hit.text())).toEqual([
      expect.stringContaining('route'), expect.stringContaining('road'),
    ]);
    expect(store.searchAcrossDatasets).toHaveBeenCalledTimes(1);
    wrapper.unmount();
  });

  it('includes an English hit beyond raw position 100 on the first page', async () => {
    store.searchAcrossDatasets = vi.fn(async () => [
      ...Array.from({ length: 101 }, (_, i) => makeHit({ conceptId: `fra-${i}`, language: 'fra', designation: `route ${i}` })),
      makeHit({ conceptId: 'english', designation: 'road' }),
    ]);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.findAll('.card-hover')[0].text()).toContain('road');
    expect(wrapper.text()).toContain('1–20 of 102');
    await wrapper.findAll('button').find(button => button.text() === 'Next')!.trigger('click');
    expect(wrapper.text()).toContain('21–40 of 102');
    await wrapper.get('select').setValue('relevance');
    expect(wrapper.text()).toContain('1–20 of 102');
    expect(wrapper.findAll('.card-hover')[0].text()).toContain('route 0');
    wrapper.unmount();
  });

  it('keeps the English designation when the same concept first matches in French', async () => {
    store.initialized = true;
    const english = makeHit({ designation: 'road' });
    store.datasets.set('test', {
      manifest: makeManifest(), index: [], ensureAllChunksLoaded: async () => {},
      search: () => [makeHit({ language: 'fra', designation: 'route' }), english],
    } as any);
    expect(await store.searchAcrossDatasets('road')).toEqual([english]);
  });

  it.each([
    { language: 'fra' },
    { language: 'eng', languageOrder: ['fra', 'eng'] },
  ])('uses configured priorities for listing and concept deduplication: %j', async (defaults) => {
    siteConfig.value = { defaults };
    store.initialized = true;
    store.datasets.set('test', {
      manifest: makeManifest(), index: [], ensureAllChunksLoaded: async () => {},
      search: () => [
        makeHit({ conceptId: 'shared', language: 'eng', designation: 'English duplicate' }),
        makeHit({ conceptId: 'english', language: 'eng', designation: 'road' }),
        makeHit({ conceptId: 'shared', language: 'fra', designation: 'route' }),
      ],
    } as any);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.findAll('.card-hover').map(hit => hit.text())).toEqual([
      expect.stringContaining('route'), expect.stringContaining('road'),
    ]);
    expect(wrapper.text()).not.toContain('English duplicate');
    wrapper.unmount();
  });

  it('paginates all 23 hits in pages of 20 and disables boundary navigation', async () => {
    const hits = Array.from({ length: 23 }, (_, index) => makeHit({
      conceptId: `term-${index + 1}`,
      designation: `term ${index + 1}`,
    }));
    store.searchAcrossDatasets = vi.fn(async () => hits);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('term');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    const pageButtons = () => wrapper.findAll('button').filter(button => ['Prev', 'Next'].includes(button.text()));
    const hitButtons = () => wrapper.findAll('.search-results button').filter(button => !['Prev', 'Next'].includes(button.text()));
    expect(wrapper.text()).toContain('1–20 of 23');
    expect(hitButtons()).toHaveLength(20);
    expect(hitButtons().map(button => button.text())).toEqual(expect.arrayContaining(
      hits.slice(0, 20).map(hit => expect.stringContaining(hit.designation)),
    ));
    expect(pageButtons().map(button => button.text())).toEqual(['Prev', 'Next']);
    expect(pageButtons()[0].element.disabled).toBe(true);
    expect(pageButtons()[1].element.disabled).toBe(false);

    await pageButtons()[1].trigger('click');
    await vi.advanceTimersByTimeAsync(300);
    await flushPromises();
    expect(wrapper.text()).toContain('21–23 of 23');
    expect(hitButtons()).toHaveLength(3);
    expect(hitButtons().map(button => button.text())).toEqual(expect.arrayContaining([
      expect.stringContaining('term 21'),
      expect.stringContaining('term 22'),
      expect.stringContaining('term 23'),
    ]));
    expect(pageButtons()[0].element.disabled).toBe(false);
    expect(pageButtons()[1].element.disabled).toBe(true);

    await pageButtons()[0].trigger('click');
    expect(wrapper.text()).toContain('1–20 of 23');
    expect(hitButtons()).toHaveLength(20);
    await pageButtons()[1].trigger('click');
    expect(hitButtons().map(button => button.text()).join(' ')).toContain('term 23');
    wrapper.unmount();
  });

  it('resets pagination when a new search is submitted', async () => {
    const firstHits = Array.from({ length: 23 }, (_, index) => makeHit({ conceptId: `first-${index + 1}`, designation: `first ${index + 1}` }));
    const secondHits = [makeHit({ conceptId: 'second-1', designation: 'second result' })];
    store.searchAcrossDatasets = vi.fn(async (query: string) => query === 'first' ? firstHits : secondHits);
    const wrapper = mountSearch();
    const input = wrapper.find('input');
    await input.setValue('first');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    await wrapper.findAll('button').find(button => button.text() === 'Next')!.trigger('click');
    expect(wrapper.text()).toContain('21–23 of 23');

    await input.setValue('second');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('second result');
    expect(wrapper.text()).not.toContain('21–23 of 23');
    expect(wrapper.text()).toContain('1–1 of 1');
    const paginationButtons = wrapper.findAll('button').filter(button => ['Prev', 'Next'].includes(button.text()));
    expect(paginationButtons).toHaveLength(2);
    expect(paginationButtons.every(button => button.element.disabled)).toBe(true);
    wrapper.unmount();
  });

  it('resets keyboard selection on page change and selects only current page hits', async () => {
    const hits = Array.from({ length: 23 }, (_, index) => makeHit({
      conceptId: `keyboard-${index + 1}`,
      designation: `keyboard ${index + 1}`,
    }));
    store.searchAcrossDatasets = vi.fn(async () => hits);
    const wrapper = mountSearch();
    const input = wrapper.find('input');
    await input.setValue('keyboard');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    for (let index = 0; index < 20; index++) await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.find('.search-hit-selected').text()).toContain('keyboard 20');
    await wrapper.findAll('button').find(button => button.text() === 'Next')!.trigger('click');
    expect(wrapper.find('.search-hit-selected').exists()).toBe(false);
    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.find('.search-hit-selected').text()).toContain('keyboard 21');
    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.find('.search-hit-selected').text()).toContain('keyboard 22');
    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.find('.search-hit-selected').text()).toContain('keyboard 23');
    await input.trigger('keydown', { key: 'ArrowDown' });
    expect(wrapper.find('.search-hit-selected').text()).toContain('keyboard 23');
    await input.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    expect(router.currentRoute.value.params.conceptId).toBe('keyboard-23');
    wrapper.unmount();
  });

  it('keeps hits beyond the fifth page reachable', async () => {
    const hits = Array.from({ length: 103 }, (_, index) => makeHit({
      conceptId: `many-${index + 1}`,
      designation: `many ${index + 1}`,
    }));
    store.searchAcrossDatasets = vi.fn(async () => hits);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('many');
    await wrapper.find('form').trigger('submit');
    await flushPromises();

    for (let page = 1; page < 6; page++) {
      const next = wrapper.findAll('button').find(button => button.text() === 'Next');
      expect(next).toBeDefined();
      expect(next!.element.disabled).toBe(false);
      await next!.trigger('click');
    }
    expect(wrapper.text()).toContain('101–103 of 103');
    const pageHits = wrapper.findAll('.search-results button').filter(button => !['Prev', 'Next'].includes(button.text()));
    expect(pageHits.map(button => button.text())).toEqual(expect.arrayContaining([
      expect.stringContaining('many 101'),
      expect.stringContaining('many 102'),
      expect.stringContaining('many 103'),
    ]));
    expect(wrapper.findAll('button').find(button => button.text() === 'Next')!.element.disabled).toBe(true);
    wrapper.unmount();
  });

  it('shows empty state when no results', async () => {
    store.searchAcrossDatasets = vi.fn(async () => []);
    const wrapper = mountSearch();
    const input = wrapper.find('input');
    await input.setValue('zzzznonexistent');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('0 results');
    expect(wrapper.text()).toContain('No concepts found');
  });

  it('groups results by dataset', async () => {
    const hits: SearchHit[] = [
      makeHit({ registerId: 'test', designation: 'term1' }),
      makeHit({ registerId: 'other', designation: 'term2' }),
    ];
    store.manifests.set('other', { ...makeManifest(), id: 'other', title: 'Other Dataset' });
    store.datasets.set('other', { index: [], getConceptCount: () => 0, getConcepts: () => [] } as any);
    store.searchAcrossDatasets = vi.fn(async () => hits);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('term');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Test Dataset');
    expect(wrapper.text()).toContain('Other Dataset');
  });

  it('navigates to concept on result click', async () => {
    const hits: SearchHit[] = [makeHit()];
    store.searchAcrossDatasets = vi.fn(async () => hits);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    const hitBtn = wrapper.findAll('button').find(b => b.text().includes('test term'));
    expect(hitBtn).toBeDefined();
    await hitBtn!.trigger('click');
    await flushPromises();
    expect(router.currentRoute.value.name).toBe('concept');
    expect(router.currentRoute.value.params.conceptId).toBe('3.1.1.1');
  });

  it('shows ID match badge for ID-based matches', async () => {
    const hits: SearchHit[] = [makeHit({ matchField: 'id' })];
    store.searchAcrossDatasets = vi.fn(async () => hits);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('3.1');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('ID match');
  });

  it('shows the coloured entry status badge for a superseded hit', async () => {
    store.searchAcrossDatasets = vi.fn(async () => [makeHit({ status: 'superseded' })]);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    const badge = wrapper.findAll('.badge').find(b => b.text() === entryStatusLabel('superseded'));
    expect(badge).toBeDefined();
    expect(badge!.classes()).toEqual(expect.arrayContaining(entryStatusColor('superseded').split(' ')));
  });

  it('updates URL query parameter on search', async () => {
    store.searchAcrossDatasets = vi.fn(async () => []);
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(router.currentRoute.value.query.q).toBe('road');
  });

  it('shows error state on search failure', async () => {
    store.searchAcrossDatasets = vi.fn(async () => { throw new Error('Network error'); });
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Search failed');
    expect(wrapper.text()).toContain('Network error');
  });

  it('shows retry button on error', async () => {
    store.searchAcrossDatasets = vi.fn(async () => { throw new Error('fail'); });
    const wrapper = mountSearch();
    await wrapper.find('input').setValue('road');
    await wrapper.find('form').trigger('submit');
    await flushPromises();
    expect(wrapper.text()).toContain('Retry');
  });
});
