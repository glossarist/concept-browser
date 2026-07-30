import { describe, it, expect } from 'vitest';
import { drawGenericPipes } from '../../components/relation-sphere/pipe-bundles';
import type { GenericRelationWire } from '../../adapters/types';

/**
 * Renderer tests for the generic-relation pipe-and-thread bundle.
 *
 * Pins the visual contract the user specified:
 *   1. NO rake shape — no perpendicular spine, no right-angle teeth.
 *      All segments are direct lines from comp→middle and middle→members.
 *   2. Thick/thin hierarchy — the parent pipe is THICKER than the child
 *      threads (reversed from the previous "isDelimiting=true" hack
 *      that made children thicker than the parent).
 *   3. Per-member delimiting characteristic is labeled along each thread.
 */
function makeSvg(): SVGSVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement;
}

function makeRelation(): GenericRelationWire {
  return {
    source: 'https://example.org/vim-2012/concept/1.9',
    comprehensive: 'https://example.org/vim-2012/concept/1.9',
    completeness: 'partial',
    criterion: { eng: 'by magnitude relationship' },
    register: 'vim-2012',
    members: [
      { uri: 'https://example.org/vim-2012/concept/1.17', presence: 'required', count: 'at_least_one',
        delimitingCharacteristic: { eng: 'multiple of a unit' } },
      { uri: 'https://example.org/vim-2012/concept/1.18', presence: 'required', count: 'at_least_one',
        delimitingCharacteristic: { eng: 'submultiple of a unit' } },
      { uri: 'https://example.org/vim-2012/concept/1.12', presence: 'required', count: 'at_least_one',
        delimitingCharacteristic: { eng: 'coherent derived unit' } },
    ],
  };
}

describe('drawGenericPipes — pipe-and-thread contract', () => {
  const pos = new Map<string, { x: number; y: number }>([
    ['vim-2012/1.9', { x: 0, y: 0 }],
    ['vim-2012/1.17', { x: 100, y: -50 }],
    ['vim-2012/1.18', { x: 100, y: 50 }],
    ['vim-2012/1.12', { x: 100, y: 0 }],
  ]);

  it('renders nothing when muted', () => {
    const svg = makeSvg();
    drawGenericPipes(svg, pos, {
      isDark: false,
      color: '#b45309',
      isMuted: true,
      relations: [makeRelation()],
      locale: 'eng',
    });
    expect(svg.children.length).toBe(0);
  });

  it('renders exactly one thick pipe (comp → middle) and three thin threads', () => {
    const svg = makeSvg();
    drawGenericPipes(svg, pos, {
      isDark: false,
      color: '#b45309',
      isMuted: false,
      relations: [makeRelation()],
      locale: 'eng',
    });
    const segs = svg.querySelectorAll('line.pipe-seg');
    /* 1 pipe + 3 threads = 4 segments total */
    expect(segs.length).toBe(4);

    /* Identify the pipe: it's the segment originating at the comp position (0,0). */
    const pipe = Array.from(segs).find(s =>
      s.getAttribute('x1') === '0' && s.getAttribute('y1') === '0');
    expect(pipe).toBeDefined();
    const pipeWidth = parseFloat(pipe!.getAttribute('stroke-width')!);

    /* Threads: every other segment. Their width must be LESS than the pipe. */
    const threads = Array.from(segs).filter(s => s !== pipe);
    expect(threads.length).toBe(3);
    for (const t of threads) {
      const w = parseFloat(t.getAttribute('stroke-width')!);
      expect(w).toBeLessThan(pipeWidth);
    }
  });

  it('does NOT emit perpendicular spine or right-angle teeth artifacts', () => {
    const svg = makeSvg();
    drawGenericPipes(svg, pos, {
      isDark: false,
      color: '#b45309',
      isMuted: false,
      relations: [makeRelation()],
      locale: 'eng',
    });
    /* The rake emits circle.rake-junction for its right-angle corner.
       The pipe-and-thread emits rect.pipe-junction (square) instead —
       a different shape so the two are visually distinguishable. */
    expect(svg.querySelectorAll('circle.rake-junction').length).toBe(0);
    expect(svg.querySelectorAll('rect.pipe-junction').length).toBe(1);
  });

  it('renders a delimiting-characteristic label per thread', () => {
    const svg = makeSvg();
    drawGenericPipes(svg, pos, {
      isDark: false,
      color: '#b45309',
      isMuted: false,
      relations: [makeRelation()],
      locale: 'eng',
    });
    const labels = Array.from(svg.querySelectorAll('text.pipe-label')).map(t => t.textContent);
    /* 3 per-member characteristics + 1 group-level criterion = 4 labels */
    expect(labels).toContain('multiple of a unit');
    expect(labels).toContain('submultiple of a unit');
    expect(labels).toContain('coherent derived unit');
    expect(labels).toContain('by magnitude relationship');
  });

  it('renders a diamond at the comprehensive end (origin marker)', () => {
    const svg = makeSvg();
    drawGenericPipes(svg, pos, {
      isDark: false,
      color: '#b45309',
      isMuted: false,
      relations: [makeRelation()],
      locale: 'eng',
    });
    /* Diamond is the only <path> element produced by the renderer. */
    const paths = svg.querySelectorAll('path');
    expect(paths.length).toBe(1);
    const d = paths[0].getAttribute('d') ?? '';
    /* Diamond path starts at (cx, cy - half) — centered on comp (0,0). */
    expect(d.startsWith('M 0 -')).toBe(true);
  });

  it('skips a relation when fewer than 2 members have positions in the map', () => {
    const svg = makeSvg();
    const sparsePos = new Map([
      ['vim-2012/1.9', { x: 0, y: 0 }],
      ['vim-2012/1.17', { x: 100, y: 0 }],
      /* 1.18 and 1.12 not in the map */
    ]);
    drawGenericPipes(svg, sparsePos, {
      isDark: false,
      color: '#b45309',
      isMuted: false,
      relations: [makeRelation()],
      locale: 'eng',
    });
    /* Single-member layout is rejected (computePipeLayout requires ≥2),
       so no pipe or thread segments should be drawn. */
    expect(svg.querySelectorAll('line.pipe-seg').length).toBe(0);
  });
});
