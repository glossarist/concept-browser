import { describe, it, expect, vi } from 'vitest';
import {
  splitNodeId,
  neighborhood,
  edgeTypeCounts,
  serializeSvg,
  exportFilename,
  rasterizePng,
  type RelationGraphWire,
} from '../utils/relation-graph';

function wireGraph(): RelationGraphWire {
  // Layout:  focus(1.1) → 1.2 → 2.1 (chain), focus → 1.3 (leaf),
  // plus a relation from another register.
  return {
    registerId: 'viml-2022',
    nodeCount: 6,
    edgeCount: 5,
    nodes: {
      'viml-2022/1.1': ['legal metrology', 'valid'],
      'viml-2022/1.2': ['measurement', 'valid'],
      'viml-2022/1.3': ['unit', 'valid'],
      'viml-2022/2.1': ['measuring instrument', 'valid'],
      'viml-2022/2.2': ['scale', 'valid'],
      'viml-2013/1.1': ['legal metrology (2013)', 'superseded'],
    },
    edges: [
      ['viml-2022/1.1', 'viml-2022/1.2', 'supersedes'],
      ['viml-2022/1.2', 'viml-2022/2.1', 'generic'],
      ['viml-2022/1.1', 'viml-2022/1.3', 'associative'],
      ['viml-2022/2.1', 'viml-2022/2.2', 'partitive'],
      ['viml-2022/1.1', 'viml-2013/1.1', 'supersedes'],
    ],
    types: { supersedes: 2, generic: 1, associative: 1, partitive: 1 },
  };
}

describe('splitNodeId', () => {
  it('splits register and concept id at the first slash', () => {
    expect(splitNodeId('viml-2022/1.1')).toEqual({ registerId: 'viml-2022', conceptId: '1.1' });
    expect(splitNodeId('iso/2.3.4')).toEqual({ registerId: 'iso', conceptId: '2.3.4' });
  });

  it('handles ids without a register prefix defensively', () => {
    expect(splitNodeId('bare-id')).toEqual({ registerId: '', conceptId: 'bare-id' });
  });
});

describe('neighborhood', () => {
  it('local mode (depth 1) returns the focus and direct relations only', () => {
    const sub = neighborhood(wireGraph(), 'viml-2022/1.1', 1);
    const ids = sub.nodes.map(n => n.id).sort();
    expect(ids).toEqual(['viml-2013/1.1', 'viml-2022/1.1', 'viml-2022/1.2', 'viml-2022/1.3']);
    expect(sub.nodes.every(n => n.depth === 0 || n.depth === 1)).toBe(true);
    expect(sub.nodes.find(n => n.id === 'viml-2022/1.1')?.designation).toBe('legal metrology');
    // Only edges with both endpoints in the subgraph survive.
    expect(sub.edges.every(e =>
      sub.nodes.some(n => n.id === e.source) && sub.nodes.some(n => n.id === e.target))).toBe(true);
    expect(sub.truncated).toBe(false);
  });

  it('global mode follows multi-hop chains (undirected)', () => {
    const sub = neighborhood(wireGraph(), 'viml-2022/1.1', 3);
    const ids = sub.nodes.map(n => n.id).sort();
    // 2.2 is reachable 1.1 → 1.2 → 2.1 → 2.2 (3 hops)
    expect(ids).toContain('viml-2022/2.2');
    expect(sub.nodes.find(n => n.id === 'viml-2022/2.2')?.depth).toBe(3);
    expect(sub.truncated).toBe(false);
  });

  it('labels cross-register neighbors with their own register data', () => {
    const sub = neighborhood(wireGraph(), 'viml-2022/1.1', 1);
    const cross = sub.nodes.find(n => n.registerId === 'viml-2013');
    expect(cross?.designation).toBe('legal metrology (2013)');
    expect(cross?.status).toBe('superseded');
  });

  it('truncates at maxNodes instead of flooding the render', () => {
    const nodes: Record<string, [string, string]> = {};
    const edges: [string, string, string][] = [];
    for (let i = 0; i < 50; i++) {
      nodes[`r/${i}`] = [`concept ${i}`, 'valid'];
      edges.push(['r/0', `r/${i}`, 'related']);
    }
    const sub = neighborhood({ registerId: 'r', nodeCount: 51, edgeCount: 50, nodes, edges }, 'r/0', 1, 10);
    expect(sub.nodes.length).toBe(10);
    expect(sub.truncated).toBe(true);
  });

  it('returns an empty neighborhood for an unknown focus id', () => {
    const sub = neighborhood(wireGraph(), 'viml-2022/does-not-exist', 2);
    expect(sub.nodes).toEqual([]);
    expect(sub.edges).toEqual([]);
  });
});

describe('edgeTypeCounts', () => {
  it('counts per type', () => {
    expect(edgeTypeCounts([{ type: 'a' }, { type: 'a' }, { type: 'b' }])).toEqual({ a: 2, b: 1 });
    expect(edgeTypeCounts([])).toEqual({});
  });
});

describe('serializeSvg', () => {
  it('clones the svg with xmlns and fixed pixel dimensions', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'w-full h-full');
    const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    circle.setAttribute('r', '5');
    svg.appendChild(circle);
    const out = serializeSvg(svg as unknown as SVGSVGElement, 640, 480);
    expect(out).toContain('<?xml version="1.0" standalone="no"?>');
    expect(out).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(out).toContain('width="640"');
    expect(out).toContain('height="480"');
    // CSS-class-driven sizing removed from the exported clone
    expect(out).not.toContain('w-full h-full');
    expect(out).toContain('<circle');
  });
});

describe('exportFilename', () => {
  it('slugifies register and concept id', () => {
    expect(exportFilename('viml-2022', '2.1', 'svg')).toBe('viml-2022-2.1-graph.svg');
    expect(exportFilename('isotc204-2022', '3.5.8.8', 'png')).toBe('isotc204-2022-3.5.8.8-graph.png');
  });

  it('replaces unsafe characters', () => {
    expect(exportFilename('r', 'a/b c', 'svg')).toBe('r-a-b-c-graph.svg');
  });
});

describe('rasterizePng', () => {
  it('rejects with a clear error when the SVG cannot be rasterized', async () => {
    // happy-dom never loads images; stub Image to fail deterministically.
    const realImage = globalThis.Image;
    class FailingImage {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      set src(_url: string) {
        setTimeout(() => this.onerror?.(), 0);
      }
    }
    vi.stubGlobal('Image', FailingImage);
    try {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>';
      await expect(rasterizePng(svg, 10, 10, '#ffffff', 2)).rejects.toThrow('could not rasterize SVG');
    } finally {
      vi.unstubAllGlobals();
      void realImage;
    }
  });
});
