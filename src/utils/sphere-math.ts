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
