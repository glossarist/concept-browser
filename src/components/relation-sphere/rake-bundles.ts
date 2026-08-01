/**
 * Rake bundle rendering for the RelationSphere.
 *
 * Draws ISO 704:2022 partitive-relation rakes (right-angle "fork"
 * notation) on the SVG layer. Each relation becomes:
 *
 *      comprehensive
 *          │  (stem, frame-width solid)
 *          ◆──────────────  (spine, frame-width solid)
 *          │       │
 *          │       │  (drop, per-member multiplicity + delimiting)
 *          ▼       ▼
 *        partitive partitive
 *
 * Per-member drop style derives from presence × count × is_delimiting
 * via rakeStrokeStyle() — solid/dashed lines, 1 or 2 lines, normal or
 * 3× delimiting width.
 *
 * Extracted from RelationSphere.vue (1914 lines → smaller). Pure
 * DOM/geometry — no Vue reactivity, no d3 state. The caller passes
 * the partitive relations, position map, and rendering context.
 */
import type { PartitiveRelationWire, PartitiveMemberWire } from '../../adapters/types';
import type { RakeStrokeStyle } from '../../utils/partitive-multiplicity';
import { rakeStrokeStyle } from '../../utils/partitive-multiplicity';
import { UriRouter } from '../../adapters/UriRouter';

const DOUBLE_GAP = 4;
const DASH = '4 3';
const FRAME_STROKE_WIDTH = 1.4;
const SPINE_FRACTION = 0.55;
const PARTIAL_TAIL = 28;

export interface RakeBundleOptions {
  /** Light/dark mode controls the frame contrast color. */
  isDark: boolean;
  /** Relation color (light or dark variant of the partitive teal). */
  color: string;
  /** Skip the entire bundle when the user mutes partitive relations. */
  isMuted: boolean;
  /** Relations to draw. */
  relations: readonly PartitiveRelationWire[];
}

interface NodePos { x: number; y: number; }

interface Tooth {
  member: PartitiveMemberWire;
  partitivePos: NodePos;
  toothX: number;
  toothY: number;
  along: number;
  style: RakeStrokeStyle;
}

/**
 * Draw all rake bundles for the current concept's partitive relations.
 *
 * Each relation produces: 1 stem, 1 spine, 1–2 drops per member,
 * 1 junction circle at the spine center, 1 diamond at the comp end.
 */
export function drawRakeBundles(
  svg: SVGSVGElement,
  pos: Map<string, NodePos>,
  opts: RakeBundleOptions,
): void {
  if (opts.isMuted) return;
  const contrastStroke = opts.isDark ? '#0a1f1c' : '#ffffff';

  for (const rel of opts.relations) {
    const compParsed = UriRouter.parseUri(rel.comprehensive);
    if (!compParsed) continue;
    const compNodeId = `${compParsed.registerId}/${compParsed.conceptId}`;
    const compPos = pos.get(compNodeId);
    if (!compPos) continue;

    const memberPositions = rel.partitives
      .map(member => {
        const parsed = UriRouter.parseUri(member.uri);
        if (!parsed) return null;
        const nid = `${parsed.registerId}/${parsed.conceptId}`;
        const p = pos.get(nid);
        return p ? { member, pos: p } : null;
      })
      .filter((x): x is { member: PartitiveMemberWire; pos: NodePos } => x !== null);

    if (memberPositions.length === 0) continue;

    // 1. Compute stem-axis (comp → centroid of partitives) and spine-axis (perpendicular)
    const centroidX = memberPositions.reduce((s, m) => s + m.pos.x, 0) / memberPositions.length;
    const centroidY = memberPositions.reduce((s, m) => s + m.pos.y, 0) / memberPositions.length;
    const stemDx = centroidX - compPos.x;
    const stemDy = centroidY - compPos.y;
    const stemLen = Math.hypot(stemDx, stemDy) || 1;
    const stemDirX = stemDx / stemLen;
    const stemDirY = stemDy / stemLen;
    const spineDirX = -stemDirY;
    const spineDirY = stemDirX;

    // 2. Spine center: along stem-axis at SPINE_FRACTION from comp
    const spineCx = compPos.x + stemDirX * stemLen * SPINE_FRACTION;
    const spineCy = compPos.y + stemDirY * stemLen * SPINE_FRACTION;

    // 3. Tooth positions = projection of each partitive onto spine line
    const teeth: Tooth[] = memberPositions.map(({ member, pos: pPos }) => {
      const vx = pPos.x - spineCx;
      const vy = pPos.y - spineCy;
      const along = vx * spineDirX + vy * spineDirY;
      const toothX = spineCx + spineDirX * along;
      const toothY = spineCy + spineDirY * along;
      return {
        member,
        partitivePos: pPos,
        toothX,
        toothY,
        along,
        style: rakeStrokeStyle(member.presence, member.count, member.isDelimiting),
      };
    });

    // 4. Spine extents (leftmost to rightmost tooth along spine-axis)
    let minAlong = teeth[0].along;
    let maxAlong = teeth[0].along;
    for (const t of teeth) {
      if (t.along < minAlong) minAlong = t.along;
      if (t.along > maxAlong) maxAlong = t.along;
    }
    // For completeness: 'partial', extend past last tooth (continued backline)
    if (rel.completeness === 'partial') maxAlong += PARTIAL_TAIL;
    const spineStartX = spineCx + spineDirX * minAlong;
    const spineStartY = spineCy + spineDirY * minAlong;
    const spineEndX = spineCx + spineDirX * maxAlong;
    const spineEndY = spineCy + spineDirY * maxAlong;

    // 5. Stem: comp → spine center (frame — single solid)
    drawSegment(svg, opts.color, compPos.x, compPos.y, spineCx, spineCy, { width: FRAME_STROKE_WIDTH });

    // 6. Spine: leftmost tooth → rightmost tooth (frame — single solid)
    if (Math.abs(maxAlong - minAlong) > 1) {
      drawSegment(svg, opts.color, spineStartX, spineStartY, spineEndX, spineEndY, { width: FRAME_STROKE_WIDTH });
    }

    // 6b. Ellipsis marker for partial completeness — ISO 704:2022
    //     "..." at the open end of the spine indicates further members
    //     exist but are not encoded.
    if (rel.completeness === 'partial') {
      const ellipsis = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      ellipsis.setAttribute('class', 'rake-ellipsis');
      ellipsis.setAttribute('x', String(spineEndX + spineDirX * 4));
      ellipsis.setAttribute('y', String(spineEndY + spineDirY * 4 + 3));
      ellipsis.setAttribute('fill', opts.color);
      ellipsis.setAttribute('font-size', '10');
      ellipsis.setAttribute('font-family', 'JetBrains Mono, monospace');
      ellipsis.setAttribute('font-weight', '600');
      ellipsis.setAttribute('opacity', '0.8');
      ellipsis.textContent = '…';
      svg.appendChild(ellipsis);
    }

    // 7. Drops: tooth → partitive (per-member multiplicity + delimiting).
    //    1 or 2 parallel lines per the style.
    for (const tooth of teeth) {
      drawSegment(svg, opts.color, tooth.toothX, tooth.toothY, tooth.partitivePos.x, tooth.partitivePos.y, {
        width: tooth.style.strokeWidth,
        dashed: tooth.style.primaryDashed,
      });
      if (tooth.style.lineCount === 2) {
        drawSegment(svg, opts.color, tooth.toothX, tooth.toothY, tooth.partitivePos.x, tooth.partitivePos.y, {
          width: tooth.style.strokeWidth,
          dashed: tooth.style.secondaryDashed,
          offset: DOUBLE_GAP,
        });
      }
    }

    // 8. Junction marker at spine center (the right-angle corner)
    const junction = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    junction.setAttribute('class', 'rake-junction');
    junction.setAttribute('cx', String(spineCx));
    junction.setAttribute('cy', String(spineCy));
    junction.setAttribute('r', '2.5');
    junction.setAttribute('fill', opts.color);
    junction.setAttribute('opacity', '0.9');
    junction.setAttribute('stroke', contrastStroke);
    junction.setAttribute('stroke-width', '1');
    svg.appendChild(junction);

    // 9. Diamond marker at comprehensive end (hyperedge origin)
    const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const dsize = 5;
    diamond.setAttribute('d',
      `M ${compPos.x} ${compPos.y - dsize} L ${compPos.x + dsize} ${compPos.y} L ${compPos.x} ${compPos.y + dsize} L ${compPos.x - dsize} ${compPos.y} Z`);
    diamond.setAttribute('fill', opts.color);
    diamond.setAttribute('opacity', '0.9');
    diamond.setAttribute('stroke', contrastStroke);
    diamond.setAttribute('stroke-width', '1');
    svg.appendChild(diamond);
  }
}

interface SegmentOpts {
  width: number;
  dashed?: boolean;
  offset?: number;
  opacity?: number;
}

/**
 * Draw a single straight segment with the given style.
 *
 * Stem + spine use FRAME_STROKE_WIDTH (single solid frame).
 * Drops use the per-member multiplicity + delimiting style.
 */
function drawSegment(
  svg: SVGSVGElement,
  color: string,
  ax: number, ay: number, bx: number, by: number,
  opts: SegmentOpts,
): void {
  const opacity = opts.opacity ?? 0.85;
  const offset = opts.offset ?? 0;
  const dashed = opts.dashed ?? false;
  const dx = bx - ax, dy = by - ay;
  const len = Math.hypot(dx, dy) || 1;
  const px = -dy / len, py = dx / len;
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
  line.setAttribute('class', 'rake-seg');
  line.setAttribute('x1', String(ax + px * offset));
  line.setAttribute('y1', String(ay + py * offset));
  line.setAttribute('x2', String(bx + px * offset));
  line.setAttribute('y2', String(by + py * offset));
  line.setAttribute('stroke', color);
  line.setAttribute('stroke-width', String(opts.width));
  line.setAttribute('opacity', String(opacity));
  line.setAttribute('stroke-linecap', 'square');
  if (dashed) line.setAttribute('stroke-dasharray', DASH);
  svg.appendChild(line);
}
