import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import RelationGraph from '../components/RelationGraph.vue';
import type { RelationGraphWire } from '../utils/relation-graph';

const wire: RelationGraphWire = {
  registerId: 'viml-2022',
  nodeCount: 4,
  edgeCount: 4,
  nodes: {
    'viml-2022/1.1': ['legal metrology', 'valid'],
    'viml-2022/1.2': ['measurement', 'valid'],
    'viml-2022/1.3': ['unit', 'valid'],
    'viml-2013/1.1': ['legal metrology (2013)', 'superseded'],
  },
  edges: [
    ['viml-2022/1.1', 'viml-2022/1.2', 'supersedes'],
    ['viml-2022/1.1', 'viml-2022/1.3', 'associative'],
    ['viml-2022/1.2', 'viml-2022/1.3', 'generic'],
    ['viml-2022/1.1', 'viml-2013/1.1', 'supersedes'],
  ],
  types: { supersedes: 2, associative: 1, generic: 1 },
};

function mockFetchWith(payload: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status === 200,
    status,
    json: () => Promise.resolve(payload),
  });
}

describe('RelationGraph', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    setActivePinia(createPinia());
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function mountGraph() {
    return mount(RelationGraph, {
      props: { registerId: 'viml-2022', conceptId: '1.1' },
    });
  }

  it('fetches relation-graph.json for the register and renders counts', async () => {
    globalThis.fetch = mockFetchWith(wire) as unknown as typeof fetch;
    const wrapper = mountGraph();
    await flushPromises();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringContaining('data/viml-2022/relation-graph.json'),
    );
    const counts = wrapper.find('[aria-live="polite"]');
    expect(counts.text()).toContain('4 nodes');
    expect(counts.text()).toContain('4 edges');
  });

  it('renders the relation-type legend with counts', async () => {
    globalThis.fetch = mockFetchWith(wire) as unknown as typeof fetch;
    const wrapper = mountGraph();
    await flushPromises();
    const legend = wrapper.text();
    expect(legend).toContain('supersedes');
    expect(legend).toContain('2');
  });

  it('renders d3 nodes into the svg', async () => {
    globalThis.fetch = mockFetchWith(wire) as unknown as typeof fetch;
    const wrapper = mountGraph();
    await flushPromises();
    expect(wrapper.find('svg .rg-node').exists()).toBe(true);
    expect(wrapper.findAll('svg .rg-node').length).toBe(4);
    expect(wrapper.find('svg line').exists()).toBe(true);
  });

  it('emits navigate when a node is clicked', async () => {
    globalThis.fetch = mockFetchWith(wire) as unknown as typeof fetch;
    const wrapper = mountGraph();
    await flushPromises();
    await wrapper.find('svg .rg-node').trigger('click');
    expect(wrapper.emitted('navigate')).toBeTruthy();
    const payload = wrapper.emitted('navigate')![0][0] as { registerId: string; conceptId: string };
    expect(payload.registerId).toBe('viml-2022');
  });

  it('shows the empty state when the register has no relation data (404)', async () => {
    globalThis.fetch = mockFetchWith(null, 404) as unknown as typeof fetch;
    const wrapper = mountGraph();
    await flushPromises();
    expect(wrapper.text()).toContain('No relation graph data');
    expect(wrapper.find('svg .rg-node').exists()).toBe(false);
  });

  it('shows a load error state on fetch failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch;
    const wrapper = mountGraph();
    await flushPromises();
    expect(wrapper.text()).toContain('Failed to load relation data');
  });
});
