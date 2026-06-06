import { describe, it, expect } from 'vitest';
import { GraphEngine } from '../graph/GraphEngine';
import type { GraphNode, GraphEdge } from '../adapters/types';

function makeNode(uri: string, conceptId: string, register = 'test', overrides?: Partial<GraphNode>): GraphNode {
  return {
    uri,
    register,
    conceptId,
    designations: { eng: conceptId },
    status: 'valid',
    loaded: true,
    ...overrides,
  };
}

function makeEdge(source: string, target: string, type = 'references', register = 'test'): GraphEdge {
  return { source, target, type, register };
}

describe('GraphEngine.clear()', () => {
  it('resets an empty engine', () => {
    const g = new GraphEngine();
    g.clear();
    expect(g.nodeCount).toBe(0);
    expect(g.edgeCount).toBe(0);
  });

  it('removes all nodes and edges', () => {
    const g = new GraphEngine();
    g.addNode(makeNode('uri:a', 'a'));
    g.addNode(makeNode('uri:b', 'b'));
    g.addEdge(makeEdge('uri:a', 'uri:b'));

    expect(g.nodeCount).toBe(2);
    expect(g.edgeCount).toBe(1);

    g.clear();

    expect(g.nodeCount).toBe(0);
    expect(g.edgeCount).toBe(0);
    expect(g.getNode('uri:a')).toBeUndefined();
    expect(g.getEdges()).toEqual([]);
  });

  it('allows reuse after clear', () => {
    const g = new GraphEngine();
    g.addNode(makeNode('uri:a', 'a'));
    g.clear();

    g.addNode(makeNode('uri:b', 'b'));
    expect(g.nodeCount).toBe(1);
    expect(g.getNode('uri:b')?.conceptId).toBe('b');
  });

  it('clears adjacency indexes', () => {
    const g = new GraphEngine();
    g.addNode(makeNode('uri:a', 'a'));
    g.addNode(makeNode('uri:b', 'b'));
    g.addEdge(makeEdge('uri:a', 'uri:b'));

    expect(g.getNeighbors('uri:a').outgoing).toEqual(['uri:b']);
    g.clear();
    expect(g.getNeighbors('uri:a').outgoing).toEqual([]);
  });

  it('allows re-adding previously deduplicated edges', () => {
    const g = new GraphEngine();
    g.addEdge(makeEdge('uri:a', 'uri:b', 'references'));
    g.addEdge(makeEdge('uri:a', 'uri:b', 'references')); // deduped
    expect(g.edgeCount).toBe(1);

    g.clear();

    g.addEdge(makeEdge('uri:a', 'uri:b', 'references'));
    g.addEdge(makeEdge('uri:a', 'uri:b', 'references')); // deduped again
    expect(g.edgeCount).toBe(1);
  });
});

describe('GraphEngine.getSubgraph BFS performance', () => {
  it('traverses linear chain correctly', () => {
    const g = new GraphEngine();
    for (let i = 0; i < 5; i++) {
      g.addNode(makeNode(`uri:${i}`, `${i}`));
      if (i > 0) g.addEdge(makeEdge(`uri:${i - 1}`, `uri:${i}`));
    }

    const sub = g.getSubgraph('uri:0', 2);
    expect(sub.nodes.length).toBe(3); // 0, 1, 2
  });

  it('traverses fan-out graph correctly', () => {
    const g = new GraphEngine();
    g.addNode(makeNode('uri:root', 'root'));
    for (let i = 1; i <= 10; i++) {
      g.addNode(makeNode(`uri:${i}`, `${i}`));
      g.addEdge(makeEdge('uri:root', `uri:${i}`));
    }

    const sub = g.getSubgraph('uri:root', 1);
    expect(sub.nodes.length).toBe(11); // root + 10 children
  });
});
