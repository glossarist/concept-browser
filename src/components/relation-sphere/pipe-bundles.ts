/**
 * Pipe-and-thread rendering for GenericRelation hyperedges.
 *
 * Visual contract (ISO 704:2022 §5.5.4 generic relations, "tree branch"):
 *
 *     comprehensive ─── thick pipe ───▶ ◼ middle node
 *                                       ├─ thin thread ──▶ member 1
 *                                       ├─ thin thread ──▶ member 2
 *                                       └─ thin thread ──▶ member N
 *
 * Distinct from the partitive rake (drawRakeBundles) in three ways:
 *
 *   1. No right-angle fork. The pipe is a single straight line from
 *      comprehensive to a middle node; threads radiate from there to
 *      each member. No perpendicular spine, no teeth.
 *
 *   2. Thick → thin hierarchy. The parent pipe uses PIPE_WIDTH; child
 *      threads use THREAD_WIDTH. The parent visually dominates, like a
 *      tree trunk vs its twigs. (The previous generic rendering reused
 *      the rake code with isDelimiting=true on all members, which made
 *      the children THICKER than the parent — backwards.)
 *
 *   3. Characteristic label — the criterion is a single hyperedge-level
 *      field shared by all members (the dimension along which they
 *      differ), rendered once on the pipe body. Optional: when the
 *      criterion is absent, no label is shown at all. Per-member
 *      delimitingCharacteristic is NOT labeled here — those values
 *      distinguish each member but are not "the characteristic of
 *      the hyperedge".
 *
 * Pure DOM/geometry — no Vue reactivity, no d3 state. The caller passes
 * the generic relations, position map, and rendering context.
 */
import type { GenericRelationWire } from '../../adapters/types';
import { computePipeLayout, type PipeLayoutMember } from '../../utils/sphere-math';
import { UriRouter } from '../../adapters/UriRouter';

const PIPE_WIDTH = 3.2;
const THREAD_WIDTH = 1.0;
const JUNCTION_RADIUS = 4;
const DIAMOND_HALF = 5;

export interface PipeBundleOptions {
  /** Light/dark mode controls the contrast stroke around markers. */
  isDark: boolean;
  /** Relation color (light or dark variant of the generic amber). */
  color: string;
  /** Skip every bundle when the user mutes generic relations. */
  isMuted: boolean;
  /** Relations to draw. */
  relations: readonly GenericRelationWire[];
  /** UI locale, used to pick the delimiting-characteristic text. */
  locale: string;
}

interface NodePos { x: number; y: number }

/**
 * Draw every pipe-and-thread bundle for the current concept's generic
 * relations.
 *
 * Each relation produces: 1 thick pipe (comp → middle), N thin threads
 * (middle → each member), 1 junction square at the middle node, 1
 * diamond at the comp end, and — only when the hyperedge has a
 * criterion — 1 characteristic label on the pipe body.
 */
export function drawGenericPipes(
  svg: SVGSVGElement,
  pos: Map<string, NodePos>,
  opts: PipeBundleOptions,
): void {
  if (opts.isMuted) return;
  const contrastStroke = opts.isDark ? '#1a1208' : '#ffffff';

  for (const rel of opts.relations) {
    const compParsed = UriRouter.parseUri(rel.comprehensive);
    if (!compParsed) continue;
    const compNodeId = `${compParsed.registerId}/${compParsed.conceptId}`;
    const compPos = pos.get(compNodeId);
    if (!compPos) continue;

    const memberPositions: PipeLayoutMember[] = [];
    const ghostMembers: Array<{ member: GenericRelationWire['members'][number]; pos: NodePos }> = [];
    for (const m of rel.members) {
      /* Ghost members (external / ellipsis, concept-model PR #91) carry
         synthetic urn:gloss:* URIs that never resolve to a node — they
         get virtual positions on an arc beyond the middle node and are
         drawn as dashed ghosts after the layout. */
      if (m.ellipsis === true || m.external === true) {
        ghostMembers.push({ member: m, pos: { x: 0, y: 0 } });
        continue;
      }
      const parsed = UriRouter.parseUri(m.uri);
      if (!parsed) continue;
      const nid = `${parsed.registerId}/${parsed.conceptId}`;
      const p = pos.get(nid);
      if (!p) continue;
      memberPositions.push({ pos: p, delimitingCharacteristic: m.delimitingCharacteristic });
    }

    /* Ghosts need a middle-node estimate to fan around. With ≥2
       positioned members the layout gives it directly; with exactly 1
       use the comp→member midpoint (computePipeLayout requires ≥2 and
       would return null). Zero positioned members means the ghosts have
       no anchor — drop the rake. */
    if (memberPositions.length === 0 && ghostMembers.length > 0) continue;
    let provisionalMiddle: NodePos | null = null;
    if (memberPositions.length >= 2) {
      const l = computePipeLayout(compPos, memberPositions);
      provisionalMiddle = l ? l.middleNode : null;
    } else if (memberPositions.length === 1) {
      provisionalMiddle = {
        x: (compPos.x + memberPositions[0].pos.x) / 2,
        y: (compPos.y + memberPositions[0].pos.y) / 2,
      };
    }
    if (!provisionalMiddle) continue;
    assignGhostPositions(provisionalMiddle, compPos, memberPositions, ghostMembers);

    const allPositions = [
      ...memberPositions,
      ...ghostMembers.map(g => ({ pos: g.pos, delimitingCharacteristic: g.member.delimitingCharacteristic })),
    ];

    const layout = computePipeLayout(compPos, allPositions);
    if (!layout) continue;

    /* 1. Thick parent pipe: comp → middle node. The characteristic
          label (criterion) sits on the pipe body — see step 4. */
    drawSegment(svg, opts.color, layout.pipeStart, layout.pipeEnd, PIPE_WIDTH);

    /* 2. Thin threads: middle → each member. No per-thread labels —
          the characteristic is a single hyperedge-level field shared
          by all members, rendered once on the pipe body.
          Ghost members are excluded here (step 2b draws their dashed
          threads separately) — layout.threads preserves the
          allPositions order: positioned members first, ghosts last. */
    layout.threads.forEach((thread, i) => {
      if (i >= memberPositions.length) return;
      drawSegment(svg, opts.color, thread.start, thread.end, THREAD_WIDTH);
    });

    /* 2b. Ghost members — external concepts and ellipsis gaps. Dashed
          threads + dashed pills so they read as "present but not a
          node of this dataset" (ISO 704:2022 §5.5.4.3.1). */
    for (const ghost of ghostMembers) {
      drawSegment(svg, opts.color, layout.middleNode, ghost.pos, THREAD_WIDTH, { dashed: true, opacity: 0.55 });
      if (ghost.member.ellipsis === true) {
        drawEllipsisGhost(svg, ghost.pos, opts.color);
      } else {
        drawExternalGhost(svg, ghost.pos, ghost.member.text ?? '', opts.color, opts.isDark);
      }
    }

    /* 3. Square junction at the middle node (distinct from the rake's
          circular junction — gives a visual cue: square = generic,
          circle = partitive). */
    drawSquare(svg, layout.middleNode.x, layout.middleNode.y, JUNCTION_RADIUS, opts.color, contrastStroke);

    /* 4. Characteristic label — single, hyperedge-level, optional.
          Drawn on the pipe body (midpoint between comp and middle node).
          When criterion is absent, no label is rendered at all. */
    const critText = pickLocalized(rel.criterion, opts.locale);
    if (critText) {
      const midX = (layout.pipeStart.x + layout.pipeEnd.x) / 2;
      const midY = (layout.pipeStart.y + layout.pipeEnd.y) / 2;
      drawLabel(svg, midX, midY, critText, opts.color, {
        fontSize: 9.5,
        weight: '600',
        bg: true,
        isDark: opts.isDark,
      });
    }

    /* 5. Diamond at the comprehensive end (origin marker shared with
          the rake — both are hyperedges emanating from one concept). */
    drawDiamond(svg, compPos.x, compPos.y, DIAMOND_HALF, opts.color, contrastStroke);
  }
}

function drawSegment(svg: SVGSVGElement, color: string, from: NodePos, to: NodePos, width: number, style?: { dashed?: boolean; opacity?: number }): void {
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('class', 'pipe-seg');
  line.setAttribute('x1', String(from.x));
  line.setAttribute('y1', String(from.y));
  line.setAttribute('x2', String(to.x));
  line.setAttribute('y2', String(to.y));
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', String(width));
  line.setAttribute('stroke-linecap', 'round');
  line.setAttribute('opacity', String(style?.opacity ?? 0.9));
  if (style?.dashed) line.setAttribute('stroke-dasharray', '3 3');
  svg.appendChild(line);
}

/**
 * Place ghost members (external / ellipsis) on an arc beyond the middle
 * node, on the side away from the comprehensive, fanned to match the
 * spread of the positioned members. Pure 2D — ghosts never enter the
 * 3D force layout.
 */
function assignGhostPositions(
  middleNode: NodePos,
  compPos: NodePos,
  positioned: readonly { pos: NodePos }[],
  ghosts: Array<{ pos: NodePos }>,
): void {
  if (ghosts.length === 0) return;
  /* Fan radius: a bit beyond the average positioned-member distance
     from the middle node so ghosts sit outside the resolved set. */
  const avgDist = positioned.length > 0
    ? positioned.reduce((s, m) => s + Math.hypot(m.pos.x - middleNode.x, m.pos.y - middleNode.y), 0) / positioned.length
    : 40;
  const radius = Math.max(avgDist, 40);
  /* Base direction: away from the comprehensive. */
  const awayX = middleNode.x - compPos.x;
  const awayY = middleNode.y - compPos.y;
  const awayLen = Math.hypot(awayX, awayY) || 1;
  const baseAngle = Math.atan2(awayY / awayLen, awayX / awayLen);
  const spread = 0.5; /* radians between consecutive ghosts */
  ghosts.forEach((g, i) => {
    const offset = ghosts.length === 1 ? 0 : (i - (ghosts.length - 1) / 2) * spread;
    const a = baseAngle + offset;
    g.pos.x = middleNode.x + Math.cos(a) * radius;
    g.pos.y = middleNode.y + Math.sin(a) * radius;
  });
}

/** Ellipsis ghost: a muted "..." — the author knew more members exist. */
function drawEllipsisGhost(svg: SVGSVGElement, at: NodePos, color: string): void {
  const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  text.setAttribute('class', 'pipe-ghost-ellipsis');
  text.setAttribute('x', String(at.x));
  text.setAttribute('y', String(at.y + 3));
  text.setAttribute('text-anchor', 'middle');
  text.setAttribute('fill', color);
  text.setAttribute('font-size', '11');
  text.setAttribute('font-family', 'JetBrains Mono, monospace');
  text.setAttribute('font-weight', '600');
  text.setAttribute('opacity', '0.8');
  text.textContent = '...';
  svg.appendChild(text);
}

/** External ghost: dashed-border pill with the parenthetical label. */
function drawExternalGhost(svg: SVGSVGElement, at: NodePos, label: string, color: string, isDark: boolean): void {
  const fontSize = 9;
  const text = label ? `(${label})` : '(external)';
  const w = Math.max(text.length * (fontSize * 0.55) + 10, 34);
  const h = 15;
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('class', 'pipe-ghost-external');
  rect.setAttribute('x', String(at.x - w / 2));
  rect.setAttribute('y', String(at.y - h / 2));
  rect.setAttribute('width', String(w));
  rect.setAttribute('height', String(h));
  rect.setAttribute('rx', '4');
  rect.setAttribute('fill', isDark ? 'rgba(26,18,8,0.85)' : 'rgba(255,255,255,0.92)');
  rect.setAttribute('stroke', color);
  rect.setAttribute('stroke-width', '1');
  rect.setAttribute('stroke-dasharray', '3 2');
  rect.setAttribute('opacity', '0.92');
  svg.appendChild(rect);

  const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  t.setAttribute('class', 'pipe-ghost-external-label');
  t.setAttribute('x', String(at.x));
  t.setAttribute('y', String(at.y + 3));
  t.setAttribute('text-anchor', 'middle');
  t.setAttribute('fill', color);
  t.setAttribute('font-size', String(fontSize));
  t.setAttribute('font-family', 'JetBrains Mono, monospace');
  t.setAttribute('font-style', 'italic');
  t.textContent = text;
  svg.appendChild(t);
}

function drawSquare(svg: SVGSVGElement, cx: number, cy: number, half: number, fill: string, stroke: string): void {
  const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect.setAttribute('class', 'pipe-junction');
  rect.setAttribute('x', String(cx - half));
  rect.setAttribute('y', String(cy - half));
  rect.setAttribute('width', String(half * 2));
  rect.setAttribute('height', String(half * 2));
  rect.setAttribute('fill', fill);
  rect.setAttribute('opacity', '0.9');
  rect.setAttribute('stroke', stroke);
  rect.setAttribute('stroke-width', '1');
  svg.appendChild(rect);
}

function drawDiamond(svg: SVGSVGElement, cx: number, cy: number, half: number, fill: string, stroke: string): void {
  const d = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  d.setAttribute('d',
    `M ${cx} ${cy - half} L ${cx + half} ${cy} L ${cx} ${cy + half} L ${cx - half} ${cy} Z`);
  d.setAttribute('fill', fill);
  d.setAttribute('opacity', '0.9');
  d.setAttribute('stroke', stroke);
  d.setAttribute('stroke-width', '1');
  svg.appendChild(d);
}

interface LabelOpts {
  fontSize?: number;
  weight?: string;
  italic?: boolean;
  bg?: boolean;
  isDark?: boolean;
}

function drawLabel(
  svg: SVGSVGElement,
  x: number,
  y: number,
  text: string,
  color: string,
  opts: LabelOpts,
): void {
  const fontSize = opts.fontSize ?? 9;
  const w = text.length * (fontSize * 0.55) + 8;
  if (opts.bg) {
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('class', 'pipe-label-bg');
    bg.setAttribute('x', String(x - w / 2));
    bg.setAttribute('y', String(y - fontSize));
    bg.setAttribute('width', String(w));
    bg.setAttribute('height', String(fontSize + 4));
    bg.setAttribute('fill', opts.isDark ? '#1c1e32' : '#ffffff');
    bg.setAttribute('opacity', '0.88');
    bg.setAttribute('rx', '2');
    svg.appendChild(bg);
  }
  const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
  label.setAttribute('class', 'pipe-label');
  label.setAttribute('x', String(x));
  label.setAttribute('y', String(y + 1));
  label.setAttribute('text-anchor', 'middle');
  label.setAttribute('fill', color);
  label.setAttribute('font-size', String(fontSize));
  label.setAttribute('font-family', 'JetBrains Mono, monospace');
  if (opts.weight) label.setAttribute('font-weight', opts.weight);
  if (opts.italic) label.setAttribute('font-style', 'italic');
  label.textContent = text;
  svg.appendChild(label);
}

function pickLocalized(ls: Record<string, string> | undefined, locale: string): string | undefined {
  if (!ls) return undefined;
  return ls[locale] ?? ls.eng ?? ls.default ?? Object.values(ls)[0];
}
