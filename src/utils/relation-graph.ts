/**
 * relation-graph.ts — pure logic behind the concept-page relation
 * neighborhood graph (issue #259).
 *
 * Wire shape is `relation-graph.json`, emitted by scripts/build-edges.ts:
 *   { registerId, nodeCount, edgeCount,
 *     nodes: { [`${register}/${id}`]: [designation, status] },
 *     edges: [[srcId, tgtId, type]],
 *     types: { type: count } }
 *
 * Everything here is a pure function over that wire shape so the BFS,
 * capping, and export-serialization behavior is unit-testable without
 * mounting the d3 component.
 */

export interface RelationGraphWire {
  registerId: string;
  nodeCount: number;
  edgeCount: number;
  nodes: Record<string, [string, string]>;
  edges: [string, string, string][];
  types?: Record<string, number>;
}

/** A node id is `${registerId}/${conceptId}`. */
export function splitNodeId(nodeId: string): { registerId: string; conceptId: string } {
  const i = nodeId.indexOf('/');
  if (i <= 0) return { registerId: '', conceptId: nodeId };
  return { registerId: nodeId.slice(0, i), conceptId: nodeId.slice(i + 1) };
}

export interface GraphSubNode {
  id: string;
  registerId: string;
  conceptId: string;
  designation: string;
  status: string;
  /** BFS distance from the focus node (focus = 0) */
  depth: number;
}

export interface GraphSubEdge {
  source: string;
  target: string;
  type: string;
}

export interface Neighborhood {
  focusId: string;
  nodes: GraphSubNode[];
  edges: GraphSubEdge[];
  /** true when the traversal hit the node cap and truncated the frontier */
  truncated: boolean;
}

/**
 * Breadth-first neighborhood around `focusId` following undirected
 * edges up to `depth` hops. `depth: 1` is the "local" (direct
 * relations) mode; larger depths are the "global" mode. Traverses at
 * most `maxNodes` nodes — the frontier is truncated (and flagged)
 * rather than flooding the render.
 */
export function neighborhood(
  graph: RelationGraphWire,
  focusId: string,
  depth: number,
  maxNodes = 300,
): Neighborhood {
  const adjacency = new Map<string, { node: string; type: string }[]>();
  for (const [src, tgt, type] of graph.edges) {
    if (!adjacency.has(src)) adjacency.set(src, []);
    if (!adjacency.has(tgt)) adjacency.set(tgt, []);
    adjacency.get(src)!.push({ node: tgt, type });
    adjacency.get(tgt)!.push({ node: src, type });
  }

  const nodes: GraphSubNode[] = [];
  const seen = new Set<string>([focusId]);
  let frontier = [focusId];
  let truncated = false;

  const wireNode = (id: string, d: number): GraphSubNode => {
    const [designation = '', status = ''] = graph.nodes[id] ?? [];
    const { registerId, conceptId } = splitNodeId(id);
    return { id, registerId, conceptId, designation, status, depth: d };
  };

  if (graph.nodes[focusId] || adjacency.has(focusId)) {
    nodes.push(wireNode(focusId, 0));
  }

  for (let d = 1; d <= depth; d++) {
    const next: string[] = [];
    for (const current of frontier) {
      for (const { node } of adjacency.get(current) ?? []) {
        if (seen.has(node)) continue;
        if (nodes.length >= maxNodes) {
          truncated = true;
          continue;
        }
        seen.add(node);
        nodes.push(wireNode(node, d));
        next.push(node);
      }
      if (truncated && nodes.length >= maxNodes) break;
    }
    frontier = next;
    if (truncated) break;
  }

  const kept = new Set(nodes.map(n => n.id));
  const edges = graph.edges
    .filter(([src, tgt]) => kept.has(src) && kept.has(tgt))
    .map(([source, target, type]) => ({ source, target, type }));

  return { focusId, nodes, edges, truncated };
}

/** Distinct relation types present in a subgraph, with counts. */
export function edgeTypeCounts(edges: { type: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of edges) counts[e.type] = (counts[e.type] ?? 0) + 1;
  return counts;
}

// ── Export: SVG serialization + PNG rasterization ──────────────────

/**
 * Serialize a rendered SVG element into a standalone, self-contained
 * SVG string. All visual attributes on the production graph are plain
 * SVG attributes (no CSS custom properties), so cloning the node with
 * explicit xmlns + pixel dimensions is enough for a portable file.
 */
export function serializeSvg(svg: SVGSVGElement, width: number, height: number): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  clone.setAttribute('xmlns:xlink', 'http://www.w3.org/1999/xlink');
  clone.setAttribute('width', String(width));
  clone.setAttribute('height', String(height));
  // The live element sizes via CSS classes; the exported one is fixed-size.
  clone.removeAttribute('class');
  const serializer = new XMLSerializer();
  return `<?xml version="1.0" standalone="no"?>\n${serializer.serializeToString(clone)}`;
}

function svgToBlobUrl(svgString: string): string {
  const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
  return URL.createObjectURL(blob);
}

/**
 * Rasterize an SVG string onto a canvas at `scale` device pixels and
 * resolve a PNG blob. The background is painted opaquely — PNG viewers
 * on dark desktops make transparent exports unreadable.
 */
export function rasterizePng(
  svgString: string,
  width: number,
  height: number,
  background: string,
  scale = 2,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = svgToBlobUrl(svgString);
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(width * scale);
        canvas.height = Math.round(height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('canvas 2d context unavailable');
        ctx.fillStyle = background;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('PNG export failed'));
        }, 'image/png');
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e instanceof Error ? e : new Error(String(e)));
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('PNG export failed: could not rasterize SVG'));
    };
    img.src = url;
  });
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Filename stem for exports, e.g. `concept-2-1-graph`. */
export function exportFilename(registerId: string, conceptId: string, ext: string): string {
  const slug = `${registerId}-${conceptId}`.replace(/[^a-zA-Z0-9._-]+/g, '-');
  return `${slug}-graph.${ext}`;
}
