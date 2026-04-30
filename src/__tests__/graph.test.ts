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

describe('GraphEngine', () => {
  it('starts empty', () => {
    const g = new GraphEngine();
    expect(g.nodeCount).toBe(0);
    expect(g.edgeCount).toBe(0);
    expect(g.getAllNodes()).toEqual([]);
    expect(g.getEdges()).toEqual([]);
  });

  describe('addNode', () => {
    it('adds a node that can be retrieved', () => {
      const g = new GraphEngine();
      const node = makeNode('uri:a', 'a');
      g.addNode(node);
      expect(g.nodeCount).toBe(1);
      expect(g.getNode('uri:a')).toEqual(node);
    });

    it('does not duplicate nodes with the same URI', () => {
      const g = new GraphEngine();
      g.addNode(makeNode('uri:a', 'a'));
      g.addNode(makeNode('uri:a', 'a-updated'));
      expect(g.nodeCount).toBe(1);
      // Original node is kept (not overwritten)
      expect(g.getNode('uri:a')?.conceptId).toBe('a');
    });
  });

  describe('addEdge', () => {
    it('creates stub nodes for unknown source/target', () => {
      const g = new GraphEngine();
      g.addEdge(makeEdge('uri:a', 'uri:b'));
      expect(g.nodeCount).toBe(2);
      expect(g.getNode('uri:a')?.loaded).toBe(false);
      expect(g.getNode('uri:a')?.status).toBe('stub');
      expect(g.getNode('uri:b')?.status).toBe('stub');
      expect(g.edgeCount).toBe(1);
    });

    it('does not overwrite existing nodes with stubs', () => {
      const g = new GraphEngine();
      g.addNode(makeNode('uri:a', 'a', 'test', { loaded: true, status: 'valid' }));
      g.addEdge(makeEdge('uri:a', 'uri:b'));
      expect(g.getNode('uri:a')?.loaded).toBe(true);
      expect(g.getNode('uri:a')?.status).toBe('valid');
    });

    it('supports multiple edges between same pair', () => {
      const g = new GraphEngine();
      g.addEdge(makeEdge('uri:a', 'uri:b', 'references'));
      g.addEdge(makeEdge('uri:a', 'uri:b', 'related'));
      expect(g.edgeCount).toBe(2);
      const edges = g.getEdges('uri:a');
      expect(edges.length).toBe(2);
      expect(edges.map(e => e.type).sort()).toEqual(['references', 'related']);
    });
  });

  describe('getNeighbors', () => {
    it('returns outgoing and incoming neighbors', () => {
      const g = new GraphEngine();
      g.addNode(makeNode('uri:a', 'a'));
      g.addNode(makeNode('uri:b', 'b'));
      g.addNode(makeNode('uri:c', 'c'));
      g.addEdge(makeEdge('uri:a', 'uri:b'));
      g.addEdge(makeEdge('uri:c', 'uri:a'));

      const neighbors = g.getNeighbors('uri:a');
      expect(neighbors.outgoing).toEqual(['uri:b']);
      expect(neighbors.incoming).toEqual(['uri:c']);
    });

    it('returns empty arrays for unknown nodes', () => {
      const g = new GraphEngine();
      const n = g.getNeighbors('uri:unknown');
      expect(n.outgoing).toEqual([]);
      expect(n.incoming).toEqual([]);
    });
  });

  describe('getIncomingEdges', () => {
    it('returns edges pointing to a node', () => {
      const g = new GraphEngine();
      g.addEdge(makeEdge('uri:a', 'uri:c'));
      g.addEdge(makeEdge('uri:b', 'uri:c'));
      g.addEdge(makeEdge('uri:c', 'uri:d'));

      const incoming = g.getIncomingEdges('uri:c');
      expect(incoming.length).toBe(2);
      expect(incoming.map(e => e.source).sort()).toEqual(['uri:a', 'uri:b']);
    });
  });

  describe('getSubgraph', () => {
    it('returns a BFS subgraph of given depth', () => {
      const g = new GraphEngine();
      g.addNode(makeNode('uri:a', 'a'));
      g.addNode(makeNode('uri:b', 'b'));
      g.addNode(makeNode('uri:c', 'c'));
      g.addNode(makeNode('uri:d', 'd'));
      g.addEdge(makeEdge('uri:a', 'uri:b'));
      g.addEdge(makeEdge('uri:b', 'uri:c'));
      g.addEdge(makeEdge('uri:c', 'uri:d'));

      const sub = g.getSubgraph('uri:a', 1);
      expect(sub.nodes.length).toBe(2); // a, b
      // Edges touching collected nodes: a->b is outgoing, plus any incoming to a or b
      // b->c is an outgoing edge of b, collected because b is a collected node
      expect(sub.edges.length).toBeGreaterThanOrEqual(1);
      expect(sub.edges.some(e => e.source === 'uri:a' && e.target === 'uri:b')).toBe(true);

      const sub2 = g.getSubgraph('uri:a', 2);
      expect(sub2.nodes.length).toBe(3); // a, b, c
    });

    it('does not loop infinitely on cycles', () => {
      const g = new GraphEngine();
      g.addNode(makeNode('uri:a', 'a'));
      g.addNode(makeNode('uri:b', 'b'));
      g.addEdge(makeEdge('uri:a', 'uri:b'));
      g.addEdge(makeEdge('uri:b', 'uri:a'));

      const sub = g.getSubgraph('uri:a', 5);
      expect(sub.nodes.length).toBe(2);
    });
  });

  describe('getAllNodes', () => {
    it('returns all nodes', () => {
      const g = new GraphEngine();
      g.addNode(makeNode('uri:a', 'a'));
      g.addNode(makeNode('uri:b', 'b'));
      const all = g.getAllNodes();
      expect(all.length).toBe(2);
      expect(all.map(n => n.conceptId).sort()).toEqual(['a', 'b']);
    });
  });
});
