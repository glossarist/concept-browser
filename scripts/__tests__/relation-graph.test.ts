import { describe, it, expect } from 'vitest';
import {
  buildRelationGraph,
  flattenPartitiveEdges,
  loadRelationLabels,
  summarizeProjectedOut,
  type RelationGraphLabels,
  type RelationGraph,
} from '../build-edges';

const U = (reg: string, id: string) => `https://vocab.example.org/${reg}/concept/${id}`;

const labels: RelationGraphLabels = new Map([
  ['viml-2022/2.1', ['legal metrology', 'valid']],
  ['viml-2022/2.2', ['measuring instrument', 'valid']],
  ['viml-2013/2.1', ['legal metrology (2013)', 'superseded']],
]);

function nodeIds(graph: RelationGraph): string[] {
  return Object.keys(graph.nodes).sort();
}

describe('buildRelationGraph', () => {
  it('keeps concept-to-concept edges and labels their nodes', () => {
    const graph = buildRelationGraph(
      'viml-2022',
      [{ source: U('viml-2022', '2.1'), target: U('viml-2022', '2.2'), type: 'supersedes', register: 'viml-2022' }],
      labels,
    );
    expect(graph.edges).toEqual([['viml-2022/2.1', 'viml-2022/2.2', 'supersedes']]);
    expect(nodeIds(graph)).toEqual(['viml-2022/2.1', 'viml-2022/2.2']);
    expect(graph.nodes['viml-2022/2.1']).toEqual(['legal metrology', 'valid']);
    expect(graph.types).toEqual({ supersedes: 1 });
    expect(graph.nodeCount).toBe(2);
    expect(graph.edgeCount).toBe(1);
    expect(graph.registerId).toBe('viml-2022');
  });

  it('drops edges whose target is not a concept URI (citation, domain, section)', () => {
    const graph = buildRelationGraph(
      'viml-2022',
      [
        { source: U('viml-2022', '2.1'), target: 'cite:VIML-2022-clause-4', type: 'citation', register: 'viml-2022' },
        { source: U('viml-2022', '2.1'), target: 'https://vocab.example.org/viml-2022/domain/section-2', type: 'domain', register: 'viml-2022' },
        { source: U('viml-2022', '2.1'), target: 'https://vocab.example.org/viml-2022/section-3', type: 'section', register: 'viml-2022' },
      ],
      labels,
    );
    expect(graph.edges).toEqual([]);
    expect(graph.nodeCount).toBe(0);
  });

  it('keeps cross-register edges and resolves labels for both registers', () => {
    const graph = buildRelationGraph(
      'viml-2022',
      [{ source: U('viml-2022', '2.1'), target: U('viml-2013', '2.1'), type: 'supersedes', register: 'viml-2022' }],
      labels,
    );
    expect(graph.edges).toEqual([['viml-2022/2.1', 'viml-2013/2.1', 'supersedes']]);
    expect(graph.nodes['viml-2013/2.1']).toEqual(['legal metrology (2013)', 'superseded']);
  });

  it('gives unlabeled nodes empty designation and status instead of failing', () => {
    const graph = buildRelationGraph(
      'viml-2022',
      [{ source: U('viml-2022', '9.9'), target: U('viml-2013', '1.1'), type: 'references', register: 'viml-2022' }],
      labels,
    );
    expect(graph.nodes['viml-2022/9.9']).toEqual(['', '']);
    expect(graph.nodes['viml-2013/1.1']).toEqual(['', '']);
  });

  it('deduplicates edges that differ only by language', () => {
    const graph = buildRelationGraph(
      'viml-2022',
      [
        { source: U('viml-2022', '2.1'), target: U('viml-2022', '2.2'), type: 'references', lang: 'eng', register: 'viml-2022' },
        { source: U('viml-2022', '2.1'), target: U('viml-2022', '2.2'), type: 'references', lang: 'fra', register: 'viml-2022' },
      ],
      labels,
    );
    expect(graph.edges).toHaveLength(1);
  });

  it('drops self-loops', () => {
    const graph = buildRelationGraph(
      'viml-2022',
      [{ source: U('viml-2022', '2.1'), target: U('viml-2022', '2.1'), type: 'related', register: 'viml-2022' }],
      labels,
    );
    expect(graph.edges).toEqual([]);
    expect(graph.nodeCount).toBe(0);
  });

  it('merges pre-flattened extra edges into the same dedupe', () => {
    const graph = buildRelationGraph(
      'viml-2022',
      [{ source: U('viml-2022', '2.1'), target: U('viml-2022', '2.2'), type: 'related', register: 'viml-2022' }],
      labels,
      [['viml-2022/2.1', 'viml-2022/2.3', 'partitive'], ['viml-2022/2.1', 'viml-2022/2.3', 'partitive']],
    );
    expect(graph.edges).toEqual([
      ['viml-2022/2.1', 'viml-2022/2.2', 'related'],
      ['viml-2022/2.1', 'viml-2022/2.3', 'partitive'],
    ]);
    expect(graph.types).toEqual({ related: 1, partitive: 1 });
  });
});

describe('flattenPartitiveEdges', () => {
  it('flattens comprehensive → member pairs as partitive edges', () => {
    const edges = flattenPartitiveEdges([
      {
        source: U('viml-2022', '2.1'),
        comprehensive: U('viml-2022', '2.1'),
        partitives: [
          { uri: U('viml-2022', '2.2'), presence: 'required', count: 'exactly_one', isDelimiting: false },
          { uri: U('viml-2022', '2.3'), presence: 'optional', count: 'exactly_one', isDelimiting: false },
        ],
        completeness: 'complete',
      },
    ]);
    expect(edges).toEqual([
      ['viml-2022/2.1', 'viml-2022/2.2', 'partitive'],
      ['viml-2022/2.1', 'viml-2022/2.3', 'partitive'],
    ]);
  });

  it('supports string members (legacy shape) and skips unparsable URIs', () => {
    const edges = flattenPartitiveEdges([
      {
        comprehensive: U('viml-2022', '2.1'),
        partitives: ['https://example.org/not-a-concept', U('viml-2022', '2.2')],
      },
    ]);
    expect(edges).toEqual([['viml-2022/2.1', 'viml-2022/2.2', 'partitive']]);
  });

  it('skips relations with unparsable comprehensive and drops self-loops', () => {
    const edges = flattenPartitiveEdges([
      { comprehensive: 'cite:x', partitives: [{ uri: U('viml-2022', '2.2') }] },
      { comprehensive: U('viml-2022', '2.1'), partitives: [{ uri: U('viml-2022', '2.1') }] },
    ]);
    expect(edges).toEqual([]);
  });
});

describe('summarizeProjectedOut', () => {
  it('counts edges whose endpoints are not concept URIs, by type', () => {
    const summary = summarizeProjectedOut([
      { source: U('vim-1984', '1.01'), target: 'https://vocab.example.org/vim-1984/domain/section-1', type: 'section' },
      { source: U('vim-1984', '1.02'), target: 'https://vocab.example.org/vim-1984/domain/section-1', type: 'section' },
      { source: U('vim-1984', '1.03'), target: 'https://vocab.example.org/vim-1984/domain/b-10', type: 'domain' },
      { source: U('vim-1984', '1.04'), target: 'cite:VIML-1984-clause-4', type: 'citation' },
    ]);
    expect(summary).toEqual({ section: 2, domain: 1, citation: 1 });
  });

  it('excludes concept-to-concept edges — they are kept by the projection', () => {
    const summary = summarizeProjectedOut([
      { source: U('vim-1984-cor-1987', '1.01'), target: U('vim-1984', '1.01'), type: 'supersedes' },
      { source: U('vim-1984-cor-1987', '1.02'), target: U('vim-1984', '1.02'), type: 'equivalent' },
    ]);
    expect(summary).toEqual({});
  });

  it('counts an edge dropped for an unparsable source endpoint too', () => {
    const summary = summarizeProjectedOut([
      { source: 'not-a-uri', target: U('viml-2022', '2.1'), type: 'related_concept' },
    ]);
    expect(summary).toEqual({ related_concept: 1 });
  });

  it('returns an empty summary for an empty edge set', () => {
    expect(summarizeProjectedOut([])).toEqual({});
  });

  it('buckets unknown types so the log never crashes on a missing type', () => {
    const summary = summarizeProjectedOut([
      { source: U('r', '1'), target: 'cite:x' },
    ]);
    expect(summary).toEqual({ unknown: 1 });
  });
});

describe('loadRelationLabels', () => {
  it('collects designation (eng preferred) and status from graph-nodes.json', () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-labels-'));
    fs.mkdirSync(path.join(dir, 'viml-2022'), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'viml-2022', 'graph-nodes.json'),
      JSON.stringify({
        uriPrefix: 'https://vocab.example.org/viml-2022/concept/',
        registerId: 'viml-2022',
        nodes: [
          ['2.1', { fra: 'métrologie légale', eng: 'legal metrology' }, 'valid'],
          ['2.2', { fra: 'instrument' }, 'valid'],
          [null, {}, ''],
        ],
      }),
    );
    const labels = loadRelationLabels(['viml-2022'], dir);
    expect(labels.get('viml-2022/2.1')).toEqual(['legal metrology', 'valid']);
    expect(labels.get('viml-2022/2.2')).toEqual(['instrument', 'valid']);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('skips registers without graph-nodes.json instead of failing', () => {
    const fs = require('node:fs');
    const os = require('node:os');
    const path = require('node:path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rel-labels-'));
    const labels = loadRelationLabels(['missing-register'], dir);
    expect(labels.size).toBe(0);
    fs.rmSync(dir, { recursive: true, force: true });
  });
});
