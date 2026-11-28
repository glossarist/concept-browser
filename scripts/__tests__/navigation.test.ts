import { describe, it, expect } from 'vitest';
import {
  collectNavigationEntry,
  collectNavigationRelation,
  buildNavigationIndex,
  HIERARCHY_RELATION_TYPES,
  type NavigationEntry,
} from '../lib/navigation';

const PREFIX_MAP = { 'CIE S 017': 'cie-2011', VIM: 'vim-2022' };

function entry(overrides: Partial<NavigationEntry> & { id: string }): NavigationEntry {
  return {
    label: `term ${overrides.id}`,
    status: 'valid',
    groups: [],
    languages: ['eng'],
    related: [],
    ...overrides,
  };
}

// ── collectNavigationRelation ────────────────────────────────────────────────

describe('collectNavigationRelation', () => {
  it('resolves a same-register URI target to a concept id', () => {
    const rel = collectNavigationRelation(
      { type: 'broader', target: 'https://vocab.example.com/vim-2022/concept/5.1' },
      'vim-2022',
      PREFIX_MAP,
    );
    expect(rel).toEqual({ type: 'broader', targetId: '5.1' });
  });

  it('drops a cross-register URI target', () => {
    const rel = collectNavigationRelation(
      { type: 'broader', target: 'https://vocab.example.com/vim-1968/concept/5.1' },
      'vim-2022',
      PREFIX_MAP,
    );
    expect(rel).toBeNull();
  });

  it('keeps a ref target whose source maps to this register', () => {
    const rel = collectNavigationRelation(
      { type: 'broader', ref: { source: 'VIM', id: '5.1' } },
      'vim-2022',
      PREFIX_MAP,
    );
    expect(rel).toEqual({ type: 'broader', targetId: '5.1' });
  });

  it('drops a ref target whose source maps to another register', () => {
    const rel = collectNavigationRelation(
      { type: 'broader', ref: { source: 'CIE S 017', id: '17-1' } },
      'vim-2022',
      PREFIX_MAP,
    );
    expect(rel).toBeNull();
  });

  it('keeps an unmapped ref id for later validation against the concept set', () => {
    const rel = collectNavigationRelation(
      { type: 'broader', ref: { source: 'ISO', id: '699' } },
      'isotc211-glossary',
      PREFIX_MAP,
    );
    expect(rel).toEqual({ type: 'broader', targetId: '699' });
  });

  it('drops non-hierarchy relation types', () => {
    expect(HIERARCHY_RELATION_TYPES.has('broader')).toBe(true);
    expect(HIERARCHY_RELATION_TYPES.has('narrower')).toBe(true);
    expect(HIERARCHY_RELATION_TYPES.has('references')).toBe(false);
    expect(HIERARCHY_RELATION_TYPES.has('supersedes')).toBe(false);
  });
});

// ── collectNavigationEntry ───────────────────────────────────────────────────

describe('collectNavigationEntry', () => {
  it('derives the label from the primary designations (eng first, HTML stripped)', () => {
    const nav = collectNavigationEntry(
      { eng: { terms: [{ designation: '<b>unit</b>' }] } },
      {
        termid: '1.1',
        designations: { eng: '<b>unit</b>', fra: 'unité' } as Record<string, string>,
        groups: ['1'],
        status: 'valid',
        registerId: 'vim-2022',
        refPrefixMap: PREFIX_MAP,
      },
    );
    expect(nav.label).toBe('unit');
    expect(nav.id).toBe('1.1');
  });

  it('falls back to the first designation, then the termid, for the label', () => {
    const fra = collectNavigationEntry(
      { fra: { terms: [{ designation: 'unité' }] } },
      {
        termid: '1.2',
        designations: { fra: 'unité' } as Record<string, string>,
        groups: [],
        status: 'valid',
        registerId: 'r',
        refPrefixMap: PREFIX_MAP,
      },
    );
    expect(fra.label).toBe('unité');
    const none = collectNavigationEntry(
      {},
      {
        termid: '1.3',
        designations: {} as Record<string, string>,
        groups: [],
        status: 'valid',
        registerId: 'r',
        refPrefixMap: PREFIX_MAP,
      },
    );
    expect(none.label).toBe('1.3');
  });

  it('collects every language carrying at least one normalized designation term', () => {
    const nav = collectNavigationEntry(
      {
        eng: { terms: [{ designation: '  Unit  ' }] },
        fra: { terms: [{ designation: '   ' }] },
        deu: { terms: [] },
        zho: { terms: [{ designation: '<span>单位</span>' }] },
        _sources: [{ type: 'authoritative' }],
      },
      {
        termid: '1.1',
        designations: { eng: 'unit' } as Record<string, string>,
        groups: [],
        status: 'valid',
        registerId: 'r',
        refPrefixMap: PREFIX_MAP,
      },
    );
    expect(nav.languages.sort()).toEqual(['eng', 'zho']);
  });

  it('resolves hierarchy relation candidates', () => {
    const nav = collectNavigationEntry(
      {
        _related: [
          { type: 'broader', target: 'https://vocab.example.com/r/concept/1' },
          { type: 'narrower', ref: { id: '1.1.1' } },
          { type: 'references', ref: { id: '9.9' } },
        ],
      },
      {
        termid: '1.1',
        designations: { eng: 'x' } as Record<string, string>,
        groups: [],
        status: 'valid',
        registerId: 'r',
        refPrefixMap: PREFIX_MAP,
      },
    );
    expect(nav.related).toEqual([
      { type: 'broader', targetId: '1' },
      { type: 'narrower', targetId: '1.1.1' },
    ]);
  });

  it('carries groups, status, and termid through', () => {
    const nav = collectNavigationEntry(
      {},
      {
        termid: '2.1',
        designations: { eng: 'x' } as Record<string, string>,
        groups: ['2'],
        status: 'superseded',
        registerId: 'r',
        refPrefixMap: PREFIX_MAP,
      },
    );
    expect(nav.groups).toEqual(['2']);
    expect(nav.status).toBe('superseded');
    expect(nav.id).toBe('2.1');
  });
});

// ── buildNavigationIndex — hierarchy tree ────────────────────────────────────

describe('buildNavigationIndex: hierarchy tree', () => {
  it('builds a parent/child forest from broader relations', () => {
    const index = buildNavigationIndex('vim-2022', [
      entry({ id: '1', label: 'quantities' }),
      entry({ id: '1.1', related: [{ type: 'broader', targetId: '1' }] }),
      entry({ id: '1.1.1', related: [{ type: 'broader', targetId: '1.1' }] }),
    ], { sections: [], standards: new Map() });

    expect(index.tree.kind).toBe('hierarchy');
    expect(index.tree.roots).toHaveLength(1);
    expect(index.tree.roots[0].id).toBe('1');
    expect(index.tree.roots[0].label).toBe('quantities');
    expect(index.tree.roots[0].children?.map(c => c.id)).toEqual(['1.1']);
    expect(index.tree.roots[0].children?.[0].children?.map(c => c.id)).toEqual(['1.1.1']);
    expect(index.tree.relationCount).toBe(2);
  });

  it('treats narrower relations as child→parent', () => {
    // "1 declares 1.1 its narrower" ≡ "1.1 declares 1 its broader".
    const index = buildNavigationIndex('r', [
      entry({ id: '1', related: [{ type: 'narrower', targetId: '1.1' }] }),
      entry({ id: '1.1' }),
    ], { sections: [], standards: new Map() });
    expect(index.tree.kind).toBe('hierarchy');
    expect(index.tree.roots.map(r => r.id)).toEqual(['1']);
    expect(index.tree.roots[0].children?.map(c => c.id)).toEqual(['1.1']);
  });

  it('ignores relation targets that are not register concepts', () => {
    const index = buildNavigationIndex('r', [
      entry({ id: 'a' }),
      entry({ id: 'b-1', related: [{ type: 'broader', targetId: 'ghost' }] }),
    ], { sections: [], standards: new Map() });
    // No validated hierarchy → falls through to the next strategy (none here).
    expect(index.tree.kind).toBe('none');
    expect(index.tree.roots).toEqual([]);
  });

  it('keeps the first parent when a child declares several broaders (sorted, deterministic)', () => {
    const index = buildNavigationIndex('r', [
      entry({ id: 'a' }),
      entry({ id: 'b' }),
      entry({ id: 'c', related: [
        { type: 'broader', targetId: 'b' },
        { type: 'broader', targetId: 'a' },
      ] }),
    ], { sections: [], standards: new Map() });
    expect(index.tree.roots.map(r => r.id)).toEqual(['a', 'b']);
    const b = index.tree.roots.find(r => r.id === 'b');
    expect(b?.children?.map(c => c.id)).toEqual(['c']);
  });

  it('breaks parent cycles instead of dropping the concepts', () => {
    const index = buildNavigationIndex('r', [
      entry({ id: 'a', related: [{ type: 'broader', targetId: 'b' }] }),
      entry({ id: 'b', related: [{ type: 'broader', targetId: 'a' }] }),
    ], { sections: [], standards: new Map() });
    expect(index.tree.kind).toBe('hierarchy');
    const rootIds = index.tree.roots.map(r => r.id).sort();
    expect(rootIds).toHaveLength(1);
    const seen = new Set<string>();
    const walk = (n: { id: string; children?: { id: string }[] }) => {
      expect(seen.has(n.id)).toBe(false);
      seen.add(n.id);
      n.children?.forEach(walk);
    };
    index.tree.roots.forEach(walk);
    expect(seen.size).toBe(2);
  });

  it('sorts children naturally within a parent', () => {
    const index = buildNavigationIndex('r', [
      entry({ id: '1' }),
      entry({ id: '1.10', related: [{ type: 'broader', targetId: '1' }] }),
      entry({ id: '1.2', related: [{ type: 'broader', targetId: '1' }] }),
    ], { sections: [], standards: new Map() });
    expect(index.tree.roots[0].children?.map(c => c.id)).toEqual(['1.2', '1.10']);
  });
});

// ── buildNavigationIndex — section fallback ─────────────────────────────────

describe('buildNavigationIndex: section fallback', () => {
  const sections = [
    {
      id: '1',
      names: { eng: 'General terms' },
      children: [{ id: '1.1', names: { eng: 'Basic terms' } }],
    },
    { id: '2', names: { eng: 'Measurement' } },
  ];

  it('builds the section tree with localized labels and subtree counts', () => {
    const index = buildNavigationIndex('iala-2009', [
      entry({ id: '1-1-000', groups: ['1'] }),
      entry({ id: '1-1-010', groups: ['1'] }),
      entry({ id: '1-1-015', groups: ['1.1'] }),
      entry({ id: '2-1', groups: ['2'] }),
    ], { sections, standards: new Map() });

    expect(index.tree.kind).toBe('sections');
    expect(index.tree.roots).toHaveLength(2);
    expect(index.tree.roots[0].label).toBe('General terms');
    expect(index.tree.roots[0].children?.[0].label).toBe('Basic terms');
    // Parent counts include descendants' members.
    expect(index.tree.roots[0].count).toBe(3);
    expect(index.tree.roots[0].children?.[0].count).toBe(1);
    expect(index.tree.roots[1].count).toBe(1);
  });

  it('honors explicit section members over group matching', () => {
    const withMembers = [
      { id: '1', names: { eng: 'General' }, members: ['x-1'] },
    ];
    const index = buildNavigationIndex('r', [
      entry({ id: 'x-1', groups: [] }),
      entry({ id: 'x-2', groups: ['1'] }),
    ], { sections: withMembers, standards: new Map() });
    expect(index.tree.kind).toBe('sections');
    expect(index.tree.roots[0].count).toBe(1);
  });

  it('falls through to clauses when no concept matches the sections', () => {
    const index = buildNavigationIndex('r', [
      entry({ id: '5.1', groups: ['nomatch'] }),
      entry({ id: '5.1.1', groups: ['nomatch'] }),
    ], { sections, standards: new Map() });
    expect(index.tree.kind).toBe('clauses');
  });
});

// ── buildNavigationIndex — clause fallback ──────────────────────────────────

describe('buildNavigationIndex: clause fallback', () => {
  it('derives the clause-number tree from dotted concept ids', () => {
    const index = buildNavigationIndex('vim-2022', [
      entry({ id: '1', label: 'Quantities and units' }),
      entry({ id: '1.1' }),
      entry({ id: '1.1.1', label: 'length' }),
      entry({ id: '1.2' }),
      entry({ id: '2' }),
    ], { sections: [], standards: new Map() });

    expect(index.tree.kind).toBe('clauses');
    expect(index.tree.roots.map(r => r.id)).toEqual(['1', '2']);
    const one = index.tree.roots[0];
    expect(one.children?.map(c => c.id)).toEqual(['1.1', '1.2']);
    expect(one.children?.[0].children?.map(c => c.id)).toEqual(['1.1.1']);
    // Counts cover the concepts under each clause, including the clause's own term.
    expect(one.count).toBe(4);
    expect(one.children?.[0].count).toBe(2);
    expect(one.children?.[0].children?.[0].count).toBe(1);
  });

  it('does not invent a clause tree from flat ids', () => {
    const index = buildNavigationIndex('cie-2011', [
      entry({ id: '17-1' }),
      entry({ id: '17-2' }),
    ], { sections: [], standards: new Map() });
    expect(index.tree.kind).toBe('none');
  });

  it('does not invent a clause tree from non-numeric ids', () => {
    const index = buildNavigationIndex('isotc211-glossary', [
      entry({ id: '00061441-c9f2' }),
      entry({ id: '001dbe28-b22b' }),
    ], { sections: [], standards: new Map() });
    expect(index.tree.kind).toBe('none');
  });

  it('treats dash-form clause ids as leaves under their dotted stems only when dotted', () => {
    const index = buildNavigationIndex('r', [
      entry({ id: '5.1-1' }),
      entry({ id: '5.1-2' }),
    ], { sections: [], standards: new Map() });
    // "5.1-1" is not dotted-numeric; no clause tree is invented.
    expect(index.tree.kind).toBe('none');
  });
});

// ── buildNavigationIndex — precedence ───────────────────────────────────────

describe('buildNavigationIndex: precedence', () => {
  it('prefers the relation hierarchy over sections and clauses', () => {
    const index = buildNavigationIndex('r', [
      entry({ id: '1', related: [{ type: 'broader', targetId: '0' }] }),
      entry({ id: '0' }),
    ], {
      sections: [{ id: 's1', names: { eng: 'Section' } }],
      standards: new Map(),
    });
    expect(index.tree.kind).toBe('hierarchy');
  });

  it('prefers sections over clauses', () => {
    const index = buildNavigationIndex('r', [
      entry({ id: '1.1', groups: ['s1'] }),
    ], {
      sections: [{ id: 's1', names: { eng: 'Section' } }],
      standards: new Map(),
    });
    expect(index.tree.kind).toBe('sections');
  });
});

// ── buildNavigationIndex — facets ───────────────────────────────────────────

describe('buildNavigationIndex: facets', () => {
  it('indexes concepts per language, status, and source standard', () => {
    const standards = new Map([
      ['ISO 19136-1', { label: 'ISO 19136-1:2020', conceptIds: ['a', 'b'] }],
      ['ISO 6709', { label: 'ISO 6709', conceptIds: ['a'] }],
    ]);
    const index = buildNavigationIndex('r', [
      entry({ id: 'a', languages: ['eng', 'fra'], status: 'valid' }),
      entry({ id: 'b', languages: ['eng'], status: 'superseded' }),
    ], { sections: [], standards });

    expect(index.facets.languages).toEqual({ eng: ['a', 'b'], fra: ['a'] });
    expect(index.facets.status).toEqual({ superseded: ['b'], valid: ['a'] });
    expect(index.facets.standards['ISO 19136-1']).toEqual({ label: 'ISO 19136-1:2020', ids: ['a', 'b'] });
  });

  it('sorts facet ids and language/status keys for deterministic output', () => {
    const index = buildNavigationIndex('r', [
      entry({ id: 'b', languages: ['zho', 'eng'], status: 'valid' }),
      entry({ id: 'a', languages: ['eng'], status: 'valid' }),
    ], { sections: [], standards: new Map() });
    expect(index.facets.languages.eng).toEqual(['a', 'b']);
    expect(Object.keys(index.facets.languages)).toEqual(['eng', 'zho']);
    expect(index.facets.status.valid).toEqual(['a', 'b']);
  });

  it('omits empty facet groups entirely', () => {
    const index = buildNavigationIndex('r', [
      entry({ id: 'a', languages: ['eng'], status: 'valid' }),
    ], { sections: [], standards: new Map() });
    expect(index.facets.languages).toEqual({ eng: ['a'] });
    expect(index.facets.standards).toEqual({});
  });
});

// ── buildNavigationIndex — determinism and header ───────────────────────────

describe('buildNavigationIndex: header', () => {
  it('carries registerId and conceptCount', () => {
    const index = buildNavigationIndex('r', [entry({ id: 'a' }), entry({ id: 'b' })], {
      sections: [],
      standards: new Map(),
    });
    expect(index.registerId).toBe('r');
    expect(index.conceptCount).toBe(2);
  });

  it('is deterministic for the same input regardless of entry order', () => {
    const entries = [
      entry({ id: 'b', related: [{ type: 'broader', targetId: 'a' }] }),
      entry({ id: 'a' }),
    ];
    const one = buildNavigationIndex('r', entries, { sections: [], standards: new Map() });
    const two = buildNavigationIndex('r', [...entries].reverse(), { sections: [], standards: new Map() });
    expect(two).toEqual(one);
    expect(JSON.stringify(two)).toBe(JSON.stringify(one));
  });

  it('sorts tree roots naturally', () => {
    const index = buildNavigationIndex('vim-2022', [
      entry({ id: '10.1' }),
      entry({ id: '2.1' }),
    ], { sections: [], standards: new Map() });
    expect(index.tree.roots.map(r => r.id)).toEqual(['2', '10']);
  });
});

// ── generate-data CLI emission contract ─────────────────────────────────────
//
// Mirrors the curation emission contract: navigation.json is written in the
// processDataset tail (after curation.json, before the final log) as
// straight-line code, and entries are collected in the per-concept loop.

import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GENERATE_SOURCE = readFileSync(resolve(__dirname, '../generate-data.ts'), 'utf8');

function sourceIndex(pattern: RegExp): number {
  const m = GENERATE_SOURCE.search(pattern);
  return m === -1 ? Number.POSITIVE_INFINITY : m;
}

describe('generate-data navigation emission contract', () => {
  it('collects navigation entries in the per-concept loop', () => {
    expect(GENERATE_SOURCE).toMatch(/collectNavigationEntry\(/);
    expect(GENERATE_SOURCE).toMatch(/navigationEntries\.push\(/);
  });

  it('writes navigation.json after curation.json and before the final log', () => {
    const curationIdx = sourceIndex(/writeJson\(path\.join\(DATA, register, 'curation\.json'\)/);
    const navigationIdx = sourceIndex(/writeJson\(path\.join\(DATA, register, 'navigation\.json'\)/);
    const generatedLogIdx = sourceIndex(/Generated \$\{concepts\.length\} concepts, manifest/);
    expect(curationIdx).toBeLessThan(navigationIdx);
    expect(navigationIdx).toBeLessThan(generatedLogIdx);
    expect(generatedLogIdx).toBeLessThan(Number.POSITIVE_INFINITY);
    const between = GENERATE_SOURCE.slice(navigationIdx, generatedLogIdx);
    expect(between).not.toMatch(/\breturn\b/);
  });

  it('logs the tree kind so the emission is self-explaining', () => {
    expect(GENERATE_SOURCE).toMatch(/Navigation tree: \$\{/);
  });
});
