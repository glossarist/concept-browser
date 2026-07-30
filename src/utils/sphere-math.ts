/** Deterministic hash from string → positive integer (for seeding positions). */
export function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Expand-slider → simulation parameters. Maps [0, 10] to physical constants. */
export function expandParams(v: number): {
  linkDist: number;
  linkStrength: number;
  repMin: number;
  repStrength: number;
} {
  const t = Math.max(0, Math.min(10, v)) / 10;
  return {
    linkDist: 0.5 + t * 1.45,
    linkStrength: 0.08,
    repMin: 0.55 + t * 0.40,
    repStrength: 0.05,
  };
}

/** Which side of a card does an edge connect to? */
export function portSide(
  from: { x: number; y: number },
  to: { x: number; y: number },
): 'top' | 'bottom' | 'left' | 'right' {
  const dx = to.x - from.x, dy = to.y - from.y;
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? 'right' : 'left';
  return dy > 0 ? 'bottom' : 'top';
}

/** Connection point on a card's side, with offset to prevent stacking. */
export function portPoint(
  center: { x: number; y: number },
  side: 'top' | 'bottom' | 'left' | 'right',
  w: number,
  h: number,
  offset: number,
): { x: number; y: number } {
  switch (side) {
    case 'right':  return { x: center.x + w / 2, y: center.y + (h / 2 - 6) * offset };
    case 'left':   return { x: center.x - w / 2, y: center.y + (h / 2 - 6) * offset };
    case 'bottom': return { x: center.x + (w / 2 - 12) * offset, y: center.y + h / 2 };
    case 'top':    return { x: center.x + (w / 2 - 12) * offset, y: center.y - h / 2 };
  }
}

/** Reverse lookup: find the node ID whose URI matches, in an ID→URI map. */
export function idToUriGet(map: Map<string, string>, uri: string): string | undefined {
  for (const [id, u] of map) if (u === uri) return id;
  return undefined;
}

export interface SphereNodeLike {
  id: string;
  register: string;
  depth: number;
}

export interface SphereLinkLike {
  source: string;
  target: string;
  type: string;
}

export interface SphereHyperedgeLike {
  /** Node ID of the comprehensive concept. */
  comprehensive: string;
  /** Node IDs of the member concepts. */
  members: readonly string[];
  /** Mute key — when present in mutedTypes, the whole hyperedge is hidden. */
  muteKey?: string;
}

/**
 * IDs of nodes that should render given the current mute state.
 *
 * The focus node (depth 0) is always visible. Every other node must have
 * at least one edge whose type is not muted AND whose other endpoint is
 * not in a muted register — OR be a member of a non-muted hyperedge —
 * otherwise the card floats with no connections and should disappear
 * when its relations are hidden.
 *
 * Hyperedge membership counts as a "visible edge" because rake bundles
 * are the connection: a member with no bilateral edges still needs its
 * card rendered so the rake has something to point at.
 *
 * Extracted as a pure function so the visibility contract can be tested
 * without mounting the sphere component.
 */
export function visibleNodeIds(
  nodes: readonly SphereNodeLike[],
  links: readonly SphereLinkLike[],
  mutedTypes: ReadonlySet<string>,
  mutedRegisters: ReadonlySet<string>,
  hyperedges: readonly SphereHyperedgeLike[] = [],
): Set<string> {
  const byId = new Map<string, SphereNodeLike>();
  for (const n of nodes) byId.set(n.id, n);

  /* Pre-compute node IDs that participate in a non-muted hyperedge. */
  const hyperedgeNodeIds = new Set<string>();
  for (const he of hyperedges) {
    if (he.muteKey && mutedTypes.has(he.muteKey)) continue;
    hyperedgeNodeIds.add(he.comprehensive);
    for (const m of he.members) hyperedgeNodeIds.add(m);
  }

  const visible = new Set<string>();
  for (const n of nodes) {
    if (n.depth === 0) {
      visible.add(n.id);
      continue;
    }
    if (mutedRegisters.has(n.register)) continue;
    if (hyperedgeNodeIds.has(n.id)) {
      visible.add(n.id);
      continue;
    }
    for (const l of links) {
      if (mutedTypes.has(l.type)) continue;
      const otherId = l.source === n.id ? l.target : l.target === n.id ? l.source : null;
      if (!otherId) continue;
      const other = byId.get(otherId);
      if (!other) continue;
      if (other.depth !== 0 && mutedRegisters.has(other.register)) continue;
      visible.add(n.id);
      break;
    }
  }
  return visible;
}


