/**
 * SVG marker definitions for the RelationSphere edge rendering.
 *
 * Extracted from RelationSphere.vue for scannability. Pure DOM
 * helpers — no Vue reactivity, no d3 state.
 */

/**
 * Ensure the SVG has a `<defs>` element. No-op if one already exists.
 * Call once per render pass before adding markers.
 */
export function ensureMarkers(svg: SVGSVGElement): void {
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);
  }
}

/**
 * Lazy per-type arrow marker. Arrow color matches the edge's per-type
 * color (which may differ from the category color via
 * TYPE_COLOR_OVERRIDE in relation-sphere-styling).
 *
 * Returns the marker id so the caller can reference it via
 * `marker-end="url(#id)"`. Idempotent — repeated calls for the same
 * (typeId, color) pair return the existing marker.
 */
export function ensureTypeMarker(svg: SVGSVGElement, typeId: string, color: string): string {
  const safeId = typeId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const markerId = `rel-arrow-t-${safeId}`;
  if (svg.querySelector(`#${markerId}`)) return markerId;
  let defs = svg.querySelector('defs');
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    svg.appendChild(defs);
  }
  const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  m.setAttribute('id', markerId);
  m.setAttribute('viewBox', '0 0 8 8');
  m.setAttribute('refX', '6');
  m.setAttribute('refY', '4');
  m.setAttribute('markerWidth', '5');
  m.setAttribute('markerHeight', '5');
  m.setAttribute('orient', 'auto');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M 0 0 L 6 4 L 0 8 z');
  p.setAttribute('fill', color);
  m.appendChild(p);
  defs.appendChild(m);
  return markerId;
}
