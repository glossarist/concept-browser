import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import BrowseView from '../views/BrowseView.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { createTestRouter, setupPinia, makeManifest, makeAdapterStub, makeConceptSummary } from './test-helpers';
import type { DatasetNavigation } from '../adapters/navigation-index';

const navigationData: DatasetNavigation = {
  registerId: 'test',
  conceptCount: 4,
  tree: {
    kind: 'hierarchy',
    relationCount: 3,
    roots: [
      {
        id: '1',
        label: 'quantities',
        children: [
          { id: '1.1', label: 'length', children: [{ id: '1.1.1', label: 'metre' }] },
          { id: '1.2', label: 'mass' },
        ],
      },
    ],
  },
  facets: {
    languages: { eng: ['1', '1.1', '1.1.1', '1.2'], fra: ['1', '1.1'] },
    status: { valid: ['1', '1.1'], superseded: ['1.1.1', '1.2'] },
    standards: { 'ISO 80000': { label: 'ISO 80000-1', ids: ['1', '1.1'] } },
  },
};

const concepts = [
  makeConceptSummary({ id: '1', eng: 'quantities', status: 'valid' }),
  makeConceptSummary({ id: '1.1', eng: 'length', status: 'valid' }),
  makeConceptSummary({ id: '1.1.1', eng: 'metre', status: 'superseded' }),
  makeConceptSummary({ id: '1.2', eng: 'mass', status: 'superseded' }),
];

const testManifest = makeManifest({ languages: ['eng', 'fra'], conceptCount: 4 });

function mockFetch(status = 200, data: unknown = navigationData) {
  globalThis.fetch = vi.fn().mockImplementation((url: string) => {
    if (String(url).includes('navigation.json')) {
      return Promise.resolve({
        ok: status === 200,
        status,
        json: () => Promise.resolve(data),
      } as Response);
    }
    return Promise.resolve({ ok: false, status: 404, json: () => Promise.resolve(null) } as Response);
  }) as unknown as typeof fetch;
}

describe('BrowseView', () => {
  let pinia: ReturnType<typeof setupPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;
  let originalFetch: typeof globalThis.fetch;

  beforeEach(async () => {
    pinia = setupPinia();
    router = await createTestRouter('dataset', '/dataset/test/browse');
    const store = useVocabularyStore();
    store.manifests.set('test', testManifest);
    store.datasets.set('test', makeAdapterStub({ concepts }));
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mountBrowse() {
    return mount(BrowseView, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test' },
    });
  }

  it('renders the browse heading, concept count, and tree kind', async () => {
    mockFetch();
    const wrapper = mountBrowse();
    await flushPromises();
    expect(wrapper.text()).toContain('Browse');
    expect(wrapper.find('[data-testid="browse-concept-count"]').text()).toContain('4');
    expect(wrapper.text()).toContain('Concept hierarchy');
  });

  it('renders tree roots collapsed and expands on toggle', async () => {
    mockFetch();
    const wrapper = mountBrowse();
    await flushPromises();
    expect(wrapper.find('[data-testid="tree-node-1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tree-node-1.1"]').exists()).toBe(false);
    await wrapper.find('[data-testid="tree-toggle-1"]').trigger('click');
    expect(wrapper.find('[data-testid="tree-node-1.1"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="tree-node-1.1.1"]').exists()).toBe(false);
    await wrapper.find('[data-testid="tree-toggle-1.1"]').trigger('click');
    expect(wrapper.find('[data-testid="tree-node-1.1.1"]').exists()).toBe(true);
  });

  it('expands and selects via keyboard (ArrowRight, Enter)', async () => {
    mockFetch();
    const wrapper = mountBrowse();
    await flushPromises();
    const treeEl = wrapper.find('[role="tree"]');
    await treeEl.trigger('keydown', { key: 'ArrowRight' });
    expect(wrapper.find('[data-testid="tree-node-1.1"]').exists()).toBe(true);
    await treeEl.trigger('keydown', { key: 'Enter' });
    await flushPromises();
    // Root selected: the whole hierarchy (all four concepts) is listed.
    expect(wrapper.findAll('[data-testid="browse-list"] li')).toHaveLength(4);
  });

  it('filters the concept list to the selected node subtree with deep links', async () => {
    mockFetch();
    const wrapper = mountBrowse();
    await flushPromises();
    await wrapper.find('[data-testid="tree-toggle-1"]').trigger('click');
    await wrapper.find('[data-testid="tree-node-1.1"]').trigger('click');
    await flushPromises();
    const links = wrapper.findAll('[data-testid="browse-list"] a').map(a => a.attributes('href'));
    expect(links).toEqual([
      '/dataset/test/concept/1.1',
      '/dataset/test/concept/1.1.1',
    ]);
  });

  it('toggles the language facet and filters the list (OR within a facet)', async () => {
    mockFetch();
    const wrapper = mountBrowse();
    await flushPromises();
    await wrapper.find('[data-testid="facet-lang-fra"]').setValue();
    await flushPromises();
    const links = wrapper.findAll('[data-testid="browse-list"] a').map(a => a.attributes('href'));
    expect(links).toEqual(['/dataset/test/concept/1', '/dataset/test/concept/1.1']);
    await wrapper.find('[data-testid="facet-lang-eng"]').setValue();
    await flushPromises();
    expect(wrapper.findAll('[data-testid="browse-list"] li')).toHaveLength(4);
  });

  it('toggles the status facet', async () => {
    mockFetch();
    const wrapper = mountBrowse();
    await flushPromises();
    await wrapper.find('[data-testid="facet-status-superseded"]').setValue();
    await flushPromises();
    const links = wrapper.findAll('[data-testid="browse-list"] a').map(a => a.attributes('href'));
    expect(links).toEqual(['/dataset/test/concept/1.1.1', '/dataset/test/concept/1.2']);
  });

  it('toggles the source-standard facet with build-time labels', async () => {
    mockFetch();
    const wrapper = mountBrowse();
    await flushPromises();
    expect(wrapper.text()).toContain('ISO 80000-1');
    await wrapper.find('[data-testid="facet-standard-ISO 80000"]').setValue();
    await flushPromises();
    const links = wrapper.findAll('[data-testid="browse-list"] a').map(a => a.attributes('href'));
    expect(links).toEqual(['/dataset/test/concept/1', '/dataset/test/concept/1.1']);
  });

  it('intersects facets and shows the empty state when nothing matches', async () => {
    mockFetch();
    const wrapper = mountBrowse();
    await flushPromises();
    await wrapper.find('[data-testid="facet-lang-fra"]').setValue();
    await wrapper.find('[data-testid="facet-status-superseded"]').setValue();
    await flushPromises();
    expect(wrapper.find('[data-testid="browse-empty"]').exists()).toBe(true);
    // Clear filters restores everything.
    const clear = wrapper.findAll('button').find(b => b.text().includes('Clear filters'));
    await clear!.trigger('click');
    await flushPromises();
    expect(wrapper.findAll('[data-testid="browse-list"] li')).toHaveLength(4);
  });

  it('filters the list by designation text', async () => {
    mockFetch();
    const wrapper = mountBrowse();
    await flushPromises();
    await wrapper.find('#browse-filter').setValue('metre');
    await flushPromises();
    const links = wrapper.findAll('[data-testid="browse-list"] a').map(a => a.attributes('href'));
    expect(links).toEqual(['/dataset/test/concept/1.1.1']);
  });

  it('shows the fallback note on a sections-kind tree and filters via groups', async () => {
    mockFetch(200, {
      registerId: 'test',
      conceptCount: 4,
      tree: {
        kind: 'sections',
        roots: [{ id: 's1', label: 'General', count: 2, children: [{ id: 's1.1', label: 'Basic', count: 1 }] }],
      },
      facets: { languages: { eng: ['1', '1.2'] }, status: {}, standards: {} },
    } as DatasetNavigation);
    const store = useVocabularyStore();
    store.datasets.set('test', makeAdapterStub({
      concepts: [
        makeConceptSummary({ id: '1', eng: 'a', status: 'valid', groups: ['s1.1'] }),
        makeConceptSummary({ id: '1.2', eng: 'b', status: 'valid', groups: ['s2'] }),
      ],
    }));
    const wrapper = mountBrowse();
    await flushPromises();
    expect(wrapper.find('[data-testid="browse-tree-note"]').exists()).toBe(true);
    expect(wrapper.text()).toContain('Section tree');
    await wrapper.find('[data-testid="tree-node-s1"]').trigger('click');
    await flushPromises();
    const links = wrapper.findAll('[data-testid="browse-list"] a').map(a => a.attributes('href'));
    expect(links).toEqual(['/dataset/test/concept/1']);
  });

  it('shows the no-data hint on 404 (older generator build)', async () => {
    mockFetch(404);
    const wrapper = mountBrowse();
    await flushPromises();
    expect(wrapper.text()).toContain('without navigation data');
  });
});
