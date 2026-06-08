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

    it('upgrades stub node when loaded node is added', () => {
      const g = new GraphEngine();
      g.addEdge(makeEdge('uri:a', 'uri:b'));
      expect(g.getNode('uri:a')?.loaded).toBe(false);
      g.addNode(makeNode('uri:a', 'a', 'test', { loaded: true, status: 'valid' }));
      expect(g.getNode('uri:a')?.loaded).toBe(true);
      expect(g.getNode('uri:a')?.conceptId).toBe('a');
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

    it('deduplicates identical edges', () => {
      const g = new GraphEngine();
      g.addEdge(makeEdge('uri:a', 'uri:b', 'references'));
      g.addEdge(makeEdge('uri:a', 'uri:b', 'references'));
      expect(g.edgeCount).toBe(1);
    });

    it('deduplicates edges with matching source+target+type regardless of register field', () => {
      const g = new GraphEngine();
      g.addEdge({ source: 'https://example.org/g18/concept/1', target: 'https://example.org/vim-1993/concept/3.6', type: 'see', register: 'vim-1993' });
      g.addEdge({ source: 'https://example.org/g18/concept/1', target: 'https://example.org/vim-1993/concept/3.6', type: 'see', register: 'g18' });
      expect(g.edgeCount).toBe(1);
    });

    it('does not deduplicate when target URIs differ', () => {
      const g = new GraphEngine();
      g.addEdge({ source: 'https://example.org/g18/concept/1', target: 'https://example.org/vim-1993/concept/3.6', type: 'see', register: 'vim-1993' });
      // URN not resolved → different target URI
      g.addEdge({ source: 'https://example.org/g18/concept/1', target: 'https://example.org/urn:oiml:pub:v:2:1993/concept/3.6', type: 'see', register: 'g18' });
      expect(g.edgeCount).toBe(2);
    });

    it('keeps separate edges for different languages', () => {
      const g = new GraphEngine();
      g.addEdge({ source: 'uri:a', target: 'uri:b', type: 'references', register: 'test', lang: 'eng' });
      g.addEdge({ source: 'uri:a', target: 'uri:b', type: 'references', register: 'test', lang: 'fra' });
      expect(g.edgeCount).toBe(2);
    });

    it('deduplicates edges with same source+target+type+lang', () => {
      const g = new GraphEngine();
      g.addEdge({ source: 'uri:a', target: 'uri:b', type: 'references', register: 'test', lang: 'eng' });
      g.addEdge({ source: 'uri:a', target: 'uri:b', type: 'references', register: 'test', lang: 'eng' });
      expect(g.edgeCount).toBe(1);
    });

    it('creates domain stub with correct fields', () => {
      const g = new GraphEngine();
      g.addEdge({
        source: 'https://glossarist.org/isotc211/concept/3',
        target: 'https://glossarist.org/isotc211/domain/iso-19105',
        type: 'domain',
        label: 'ISO 19105',
        register: 'isotc211',
        lang: 'eng',
      });
      const domainNode = g.getNode('https://glossarist.org/isotc211/domain/iso-19105');
      expect(domainNode?.register).toBe('isotc211');
      expect(domainNode?.nodeType).toBe('domain');
      expect(domainNode?.status).toBe('domain');
      expect(domainNode?.loaded).toBe(false);
    });

    it('extracts register from URI for stub nodes', () => {
      const g = new GraphEngine();
      g.addEdge({
        source: 'https://glossarist.org/isotc204/concept/3.1.1.1',
        target: 'https://glossarist.org/iev/concept/102-01-10',
        type: 'references',
        register: 'isotc204',
      });
      const target = g.getNode('https://glossarist.org/iev/concept/102-01-10');
      expect(target?.register).toBe('iev');
      expect(target?.conceptId).toBe('102-01-10');
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

    it('does not traverse past domain nodes in getSubgraph', () => {
      const g = new GraphEngine();
      g.addNode(makeNode('https://glossarist.org/test/concept/a', 'a'));
      g.addNode(makeNode('https://glossarist.org/test/concept/b', 'b'));
      g.addNode(makeNode('https://glossarist.org/test/concept/c', 'c'));
      g.addNode(makeNode('https://glossarist.org/test/concept/d', 'd'));

      g.addEdge({
        source: 'https://glossarist.org/test/concept/a',
        target: 'https://glossarist.org/test/domain/iso-12345',
        type: 'domain', register: 'test', label: 'ISO 12345', lang: 'eng',
      });
      g.addEdge({
        source: 'https://glossarist.org/test/concept/b',
        target: 'https://glossarist.org/test/domain/iso-12345',
        type: 'domain', register: 'test', label: 'ISO 12345', lang: 'eng',
      });
      g.addEdge({
        source: 'https://glossarist.org/test/concept/c',
        target: 'https://glossarist.org/test/domain/iso-12345',
        type: 'domain', register: 'test', label: 'ISO 12345', lang: 'eng',
      });

      const sub = g.getSubgraph('https://glossarist.org/test/concept/a', 3);
      const nodeUris = sub.nodes.map(n => n.uri);
      expect(nodeUris).toContain('https://glossarist.org/test/concept/a');
      expect(nodeUris).toContain('https://glossarist.org/test/domain/iso-12345');
      expect(nodeUris).not.toContain('https://glossarist.org/test/concept/b');
      expect(nodeUris).not.toContain('https://glossarist.org/test/concept/c');
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
