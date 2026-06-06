import { describe, it, expect } from 'vitest';
import { GraphEngine } from '../graph/GraphEngine';
import type { GraphNode, GraphEdge } from '../adapters/types';

function makeNode(uri: string, conceptId: string, register = 'test'): GraphNode {
  return { uri, register, conceptId, designations: { eng: conceptId }, status: 'valid', loaded: true };
}

function makeEdge(source: string, target: string, type = 'references', register = 'test'): GraphEdge {
  return { source, target, type, register };
}

describe('GraphEngine encapsulation', () => {
  it('getEdges() returns a copy, not internal reference', () => {
    const engine = new GraphEngine();
    engine.addNode(makeNode('uri:a', 'a'));
    engine.addNode(makeNode('uri:b', 'b'));
    engine.addEdge(makeEdge('uri:a', 'uri:b'));

    const edges = engine.getEdges();
    expect(edges).toHaveLength(1);
    expect(edges).not.toBe((engine as any).edges);
  });

  it('mutating getEdges() result does not affect engine', () => {
    const engine = new GraphEngine();
    engine.addNode(makeNode('uri:a', 'a'));
    engine.addNode(makeNode('uri:b', 'b'));
    engine.addEdge(makeEdge('uri:a', 'uri:b'));

    const edges = engine.getEdges();
    edges.push(makeEdge('uri:a', 'uri:c'));

    expect(engine.edgeCount).toBe(1);
  });

  it('getEdges(uri) returns flat array from adjacency', () => {
    const engine = new GraphEngine();
    engine.addNode(makeNode('uri:a', 'a'));
    engine.addNode(makeNode('uri:b', 'b'));
    engine.addNode(makeNode('uri:c', 'c'));
    engine.addEdge(makeEdge('uri:a', 'uri:b', 'references'));
    engine.addEdge(makeEdge('uri:a', 'uri:c', 'supersedes'));

    const edges = engine.getEdges('uri:a');
    expect(edges).toHaveLength(2);
    expect(edges.map(e => e.target)).toEqual(expect.arrayContaining(['uri:b', 'uri:c']));
  });

  it('getIncomingEdges() returns flat array from reverse adjacency', () => {
    const engine = new GraphEngine();
    engine.addNode(makeNode('uri:a', 'a'));
    engine.addNode(makeNode('uri:b', 'b'));
    engine.addNode(makeNode('uri:c', 'c'));
    engine.addEdge(makeEdge('uri:a', 'uri:c'));
    engine.addEdge(makeEdge('uri:b', 'uri:c'));

    const incoming = engine.getIncomingEdges('uri:c');
    expect(incoming).toHaveLength(2);
    expect(incoming.map(e => e.source)).toEqual(expect.arrayContaining(['uri:a', 'uri:b']));
  });
});

describe('v-math directive optimization', () => {
  it('querySelector used for early exit check', () => {
    // Verify the directive code uses querySelector (not querySelectorAll) for the existence check
    const fs = require('fs');
    const path = require('path');
    const code = fs.readFileSync(path.join(__dirname, '../directives/v-math.ts'), 'utf-8');

    // The early exit should use querySelector (returns first match or null)
    // not querySelectorAll (creates NodeList)
    expect(code).toContain("querySelector('.math-pending')");
    // querySelectorAll should only be called after the early exit confirms math exists
    expect(code).toContain('querySelectorAll');
  });
});
