import { describe, it, expect } from 'vitest';
import { drawRakeBundles } from '../../components/relation-sphere/rake-bundles';
import type { PartitiveRelationWire, PartitiveMemberWire } from '../../adapters/types';
import {
  NORMAL_STROKE_WIDTH,
  DELIMITING_STROKE_WIDTH,
} from '../../utils/partitive-multiplicity';

/**
 * Renderer tests for the partitive-relation rake bundle.
 *
 * Mirrors `pipe-bundles.test.ts` — pins the visual contract so a
 * regression in stem/spine/teeth geometry, multiplicity stroke style,
 * or partial-completeness spine extension cannot ship silently.
 *
 * Layout reference (ISO 704 rake notation):
 *
 *     comprehensive
 *         │           ← stem (FRAME_STROKE_WIDTH, single solid)
 *         ●─────────  ← spine (FRAME_STROKE_WIDTH, single solid)
 *         │     │
 *         ▼     ▼    ← teeth (per-member multiplicity + delimiting style)
 *       p1     p2
 */
function makeSvg(): SVGSVGElement {
  return document.createElementNS('http://www.w3.org/2000/svg', 'svg') as unknown as SVGSVGElement;
}

function member(uri: string, fields: Partial<PartitiveMemberWire> = {}): PartitiveMemberWire {
  return {
    uri,
    presence: fields.presence ?? 'required',
    count: fields.count ?? 'exactly_one',
    isDelimiting: fields.isDelimiting ?? false,
  };
}

function makeRelation(overrides: Partial<PartitiveRelationWire> = {}): PartitiveRelationWire {
  return {
    source: 'https://example.org/vim-2012/concept/1.3',
    comprehensive: 'https://example.org/vim-2012/concept/1.3',
    completeness: 'complete',
    register: 'vim-2012',
    partitives: [
      member('https://example.org/vim-2012/concept/1.4'),
      member('https://example.org/vim-2012/concept/1.5'),
      member('https://example.org/vim-2012/concept/1.22'),
    ],
    ...overrides,
  };
}

/* Fixed position map: comp at top-center, 3 members fanned across the bottom.
   The rake renderer projects members onto a perpendicular spine; absolute
   coordinates don't matter for the contract assertions, only that each
   member has a distinct position so the spine has non-zero length. */
const pos = new Map<string, { x: number; y: number }>([
  ['vim-2012/1.3', { x: 120, y: 20 }],
  ['vim-2012/1.4', { x: 30, y: 140 }],
  ['vim-2012/1.5', { x: 120, y: 140 }],
  ['vim-2012/1.22', { x: 210, y: 140 }],
]);

describe('drawRakeBundles — rake contract', () => {
  it('renders nothing when muted', () => {
    const svg = makeSvg();
    drawRakeBundles(svg, pos, {
      isDark: false,
      color: '#0d9488',
      isMuted: true,
      relations: [makeRelation()],
    });
    expect(svg.querySelectorAll('line.rake-seg').length).toBe(0);
    expect(svg.querySelectorAll('circle.rake-junction').length).toBe(0);
    expect(svg.querySelectorAll('path').length).toBe(0);
  });

  it('renders a diamond at the comprehensive end (origin marker)', () => {
    const svg = makeSvg();
    drawRakeBundles(svg, pos, {
      isDark: false,
      color: '#0d9488',
      isMuted: false,
      relations: [makeRelation()],
    });
    /* Diamond is the only <path> element the rake emits. */
    const paths = svg.querySelectorAll('path');
    expect(paths.length).toBe(1);
    /* Diamond path is centered on the comp position (120, 20).
       The first coordinate of the diamond "M cx (cy-half)" pattern. */
    const d = paths[0].getAttribute('d') ?? '';
    expect(d.startsWith('M 120 ')).toBe(true);
  });

  it('renders exactly one circular junction at the spine center', () => {
    const svg = makeSvg();
    drawRakeBundles(svg, pos, {
      isDark: false,
      color: '#0d9488',
      isMuted: false,
      relations: [makeRelation()],
    });
    expect(svg.querySelectorAll('circle.rake-junction').length).toBe(1);
  });

  it('does NOT emit pipe-and-thread artifacts (no shape leak)', () => {
    const svg = makeSvg();
    drawRakeBundles(svg, pos, {
      isDark: false,
      color: '#0d9488',
      isMuted: false,
      relations: [makeRelation()],
    });
    expect(svg.querySelectorAll('line.pipe-seg').length).toBe(0);
    expect(svg.querySelectorAll('rect.pipe-junction').length).toBe(0);
  });

  it('renders frame-width stem + spine at FRAME_STROKE_WIDTH (1.4)', () => {
    const svg = makeSvg();
    drawRakeBundles(svg, pos, {
      isDark: false,
      color: '#0d9488',
      isMuted: false,
      relations: [makeRelation()],
    });
    const segs = Array.from(svg.querySelectorAll('line.rake-seg'));
    const frameSegs = segs.filter(s => Math.abs(parseFloat(s.getAttribute('stroke-width')!) - 1.4) < 0.01);
    /* Stem + spine = 2 frame-width segments. */
    expect(frameSegs.length).toBe(2);
  });

  it('tooth stroke width reflects isDelimiting (NORMAL vs 3× DELIMITING)', () => {
    const svg = makeSvg();
    /* All members required/exactly_one, but only the second is delimiting.
       Expected tooth widths: NORMAL, DELIMITING (3×), NORMAL. */
    const rel = makeRelation({
      partitives: [
        member('https://example.org/vim-2012/concept/1.4'),
        member('https://example.org/vim-2012/concept/1.5', { isDelimiting: true }),
        member('https://example.org/vim-2012/concept/1.22'),
      ],
    });
    drawRakeBundles(svg, pos, {
      isDark: false,
      color: '#0d9488',
      isMuted: false,
      relations: [rel],
    });
    const segs = Array.from(svg.querySelectorAll('line.rake-seg'));
    const widths = segs.map(s => parseFloat(s.getAttribute('stroke-width')!));
    /* Stem + spine are 1.4; non-delimiting teeth are NORMAL (1.5);
       delimiting teeth are DELIMITING (4.5). */
    expect(widths.filter(w => Math.abs(w - NORMAL_STROKE_WIDTH) < 0.01).length).toBe(2);
    expect(widths.filter(w => Math.abs(w - DELIMITING_STROKE_WIDTH) < 0.01).length).toBe(1);
  });

  it('count=multiple renders 2 parallel tooth lines (lineCount=2)', () => {
    const svg = makeSvg();
    /* One member with count=multiple. Counting segments:
       - 1 stem (FRAME)
       - 1 spine (FRAME) — only if spine extents > 1px; with a single
         member the spine is degenerate (zero length). The renderer
         guards with `if (Math.abs(maxAlong - minAlong) > 1)`, so spine
         is skipped for single-member input.
       - 2 tooth lines (lineCount=2 for count=multiple).
       Total: 1 stem + 2 teeth = 3 segments. */
    const rel = makeRelation({
      partitives: [
        member('https://example.org/vim-2012/concept/1.4', { count: 'multiple' }),
        member('https://example.org/vim-2012/concept/1.5', { count: 'multiple' }),
      ],
    });
    drawRakeBundles(svg, pos, {
      isDark: false,
      color: '#0d9488',
      isMuted: false,
      relations: [rel],
    });
    const segs = svg.querySelectorAll('line.rake-seg');
    /* 2 members × 2 lines each = 4 teeth, + 1 stem + 1 spine = 6. */
    expect(segs.length).toBe(6);
  });

  it('presence=optional makes the tooth dashed', () => {
    const svg = makeSvg();
    const rel = makeRelation({
      partitives: [
        member('https://example.org/vim-2012/concept/1.4', { presence: 'optional' }),
        member('https://example.org/vim-2012/concept/1.5', { presence: 'required' }),
      ],
    });
    drawRakeBundles(svg, pos, {
      isDark: false,
      color: '#0d9488',
      isMuted: false,
      relations: [rel],
    });
    const segs = Array.from(svg.querySelectorAll('line.rake-seg'));
    /* Teeth are the segments at NORMAL_STROKE_WIDTH (1.5) — frame
       segments are at 1.4. Filter to teeth, then check dash pattern. */
    const teeth = segs.filter(s => Math.abs(parseFloat(s.getAttribute('stroke-width')!) - NORMAL_STROKE_WIDTH) < 0.01);
    expect(teeth.length).toBeGreaterThanOrEqual(2);
    /* presence=optional tooth is dashed; presence=required is solid.
       At least one dashed, at least one solid. */
    const dashed = teeth.filter(t => t.getAttribute('stroke-dasharray'));
    const solid = teeth.filter(t => !t.getAttribute('stroke-dasharray'));
    expect(dashed.length).toBeGreaterThanOrEqual(1);
    expect(solid.length).toBeGreaterThanOrEqual(1);
  });

  it('partial completeness extends the spine beyond the member bounding box', () => {
    /* Members at x = {30, 120, 210}; their bbox X is [30, 210].
       With completeness='partial', PARTIAL_TAIL (28px) is appended to
       the spine extent — so the spine endpoint must land OUTSIDE [30, 210].
       With completeness='complete' the spine stays inside the bbox. */
    const members = [
      member('https://example.org/vim-2012/concept/1.4'),
      member('https://example.org/vim-2012/concept/1.5'),
      member('https://example.org/vim-2012/concept/1.22'),
    ];
    const completeSvg = makeSvg();
    const partialSvg = makeSvg();
    drawRakeBundles(completeSvg, pos, {
      isDark: false, color: '#0d9488', isMuted: false,
      relations: [makeRelation({ completeness: 'complete', partitives: members })],
    });
    drawRakeBundles(partialSvg, pos, {
      isDark: false, color: '#0d9488', isMuted: false,
      relations: [makeRelation({ completeness: 'partial', partitives: members })],
    });
    /* Frame-width (1.4) segments are stem + spine. For complete, all
       spine frame-segment endpoints lie within the member X bbox [30,210].
       For partial, at least one endpoint lies outside. */
    const isFrame = (s: Element) => Math.abs(parseFloat(s.getAttribute('stroke-width')!) - 1.4) < 0.01;
    const endpointsOutsideBbox = (svg: SVGSVGElement) => {
      return Array.from(svg.querySelectorAll('line.rake-seg'))
        .filter(isFrame)
        .some(s => {
          const x1 = parseFloat(s.getAttribute('x1')!);
          const x2 = parseFloat(s.getAttribute('x2')!);
          return x1 < 30 || x1 > 210 || x2 < 30 || x2 > 210;
        });
    };
    expect(endpointsOutsideBbox(completeSvg)).toBe(false);
    expect(endpointsOutsideBbox(partialSvg)).toBe(true);
  });

  it('renders a degenerate rake (stem + 1 tooth, no spine) when only 1 member has a position', () => {
    /* The renderer does not enforce ≥2 members — the model layer does.
       Given 1 member, the rake produces a stem and a single tooth, no
       spine (maxAlong - minAlong = 0, so the spine is skipped). */
    const svg = makeSvg();
    const sparsePos = new Map<string, { x: number; y: number }>([
      ['vim-2012/1.3', { x: 120, y: 20 }],
      ['vim-2012/1.4', { x: 30, y: 140 }],
      /* 1.5 and 1.22 missing — only 1 member with a position */
    ]);
    drawRakeBundles(svg, sparsePos, {
      isDark: false, color: '#0d9488', isMuted: false,
      relations: [makeRelation()],
    });
    /* 1 stem (frame) + 1 tooth (normal) = 2 segments. */
    expect(svg.querySelectorAll('line.rake-seg').length).toBe(2);
    expect(svg.querySelectorAll('circle.rake-junction').length).toBe(1);
  });

  it('skips the relation entirely when the comprehensive is missing from pos', () => {
    const svg = makeSvg();
    const sparsePos = new Map<string, { x: number; y: number }>([
      ['vim-2012/1.4', { x: 30, y: 140 }],
      ['vim-2012/1.5', { x: 120, y: 140 }],
      /* comprehensive 1.3 missing — compPos lookup fails, relation skipped */
    ]);
    drawRakeBundles(svg, sparsePos, {
      isDark: false, color: '#0d9488', isMuted: false,
      relations: [makeRelation()],
    });
    expect(svg.querySelectorAll('line.rake-seg').length).toBe(0);
    expect(svg.querySelectorAll('circle.rake-junction').length).toBe(0);
    expect(svg.querySelectorAll('path').length).toBe(0);
  });

  it('renders a separate junction + diamond per relation when multiple are present', () => {
    const svg = makeSvg();
    /* Two distinct comprehensives → two rake bundles. */
    const multiPos = new Map<string, { x: number; y: number }>([
      ['vim-2012/1.3', { x: 60, y: 20 }],
      ['vim-2012/1.4', { x: 30, y: 140 }],
      ['vim-2012/1.5', { x: 90, y: 140 }],
      ['vim-2012/2.9', { x: 180, y: 20 }],
      ['vim-2012/2.10', { x: 150, y: 140 }],
      ['vim-2012/2.26', { x: 210, y: 140 }],
    ]);
    drawRakeBundles(svg, multiPos, {
      isDark: false, color: '#0d9488', isMuted: false,
      relations: [
        makeRelation({
          comprehensive: 'https://example.org/vim-2012/concept/1.3',
          source: 'https://example.org/vim-2012/concept/1.3',
          partitives: [
            member('https://example.org/vim-2012/concept/1.4'),
            member('https://example.org/vim-2012/concept/1.5'),
          ],
        }),
        makeRelation({
          comprehensive: 'https://example.org/vim-2012/concept/2.9',
          source: 'https://example.org/vim-2012/concept/2.9',
          partitives: [
            member('https://example.org/vim-2012/concept/2.10'),
            member('https://example.org/vim-2012/concept/2.26'),
          ],
        }),
      ],
    });
    expect(svg.querySelectorAll('circle.rake-junction').length).toBe(2);
    expect(svg.querySelectorAll('path').length).toBe(2);
  });
});
