/**
 * Sphere projection + force-layout math for RelationSphere.
 *
 * All functions are pure — no Vue, no DOM. The component passes positions in,
 * gets screen coordinates out. This keeps the math testable and the component
 * focused on rendering.
 *
 * Coordinates: unit sphere (‖p‖ = 1). The "front pole" is (0, 0, 1) — the
 * focal point of the camera. The simulation runs in 3D and is projected to
 * 2D with perspective at render time.
 */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/** Perspective projection constants — tuned for unit sphere. */
const FOCAL = 600;
const Z_OFFSET = 800;
const SPHERE_R = 360;

/** Slow-fast-slow easing — cubic ease-in-out. */
export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/** Great-circle interpolation between two unit-sphere points. */
export function slerp(a: Vec3, b: Vec3, t: number): Vec3 {
  const dot = Math.max(-1, Math.min(1, a.x * b.x + a.y * b.y + a.z * b.z));
  const omega = Math.acos(dot);
  if (omega < 0.001) {
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t,
      z: a.z + (b.z - a.z) * t,
    };
  }
  const sinO = Math.sin(omega);
  const wa = Math.sin((1 - t) * omega) / sinO;
  const wb = Math.sin(t * omega) / sinO;
  return {
    x: a.x * wa + b.x * wb,
    y: a.y * wa + b.y * wb,
    z: a.z * wa + b.z * wb,
  };
}

/**
 * Initial sphere position by depth band. Focus at (0,0,1); 1°/2°/3° neighbors
 * distributed at increasing angular distance from the focus.
 *
 * Depth 1 forms an EVEN ring (best spacing for small N). Deeper levels use
 * the golden-angle offset so they interleave with the previous ring.
 */
export function fibonacciSpherePosition(
  depth: number,
  idx: number,
  total: number,
  jitterSeed: number,
): Vec3 {
  if (depth === 0) return { x: 0, y: 0, z: 1 };
  /* Angular distance from north pole — each ring further out. */
  const thetaByDepth: Record<number, number> = { 1: 1.15, 2: 1.55, 3: 1.95 };
  const theta = thetaByDepth[depth] ?? 1.15;
  const j = (jitterSeed % 7) * 0.008;
  const t = theta + j;
  let phi: number;
  if (depth === 1) {
    /* Even ring for depth 1 — gives best spread for small N */
    phi = (idx / Math.max(total, 1)) * Math.PI * 2;
  } else {
    /* Golden-angle spiral for deeper rings, offset by depth so rings interleave */
    phi = (idx * 2.39996 + depth * 1.7 + (jitterSeed % 11) * 0.4) % (Math.PI * 2);
  }
  return {
    x: Math.sin(t) * Math.cos(phi),
    y: Math.sin(t) * Math.sin(phi),
    z: Math.cos(t),
  };
}

/** 3D unit-sphere point → 2D screen offset from sphere center. */
export interface Projected {
  x: number;
  y: number;
  scale: number;
  z: number;
}

export function project(p: Vec3): Projected {
  const persp = FOCAL / (Z_OFFSET - p.z * SPHERE_R);
  return {
    x: p.x * SPHERE_R * persp,
    y: -p.y * SPHERE_R * persp,
    scale: persp,
    z: p.z,
  };
}

/**
 * Find the point on a rectangle's edge in the direction of an external point.
 * Used so SVG edge paths start/end on the rim of the card, not its center.
 */
export function cardEdge(
  from: { x: number; y: number },
  to: { x: number; y: number },
  w: number,
  h: number,
): { x: number; y: number } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const ux = dx / len;
  const uy = dy / len;
  const absUx = Math.abs(ux);
  const absUy = Math.abs(uy);
  const halfW = w / 2;
  const halfH = h / 2;
  const tX = absUx > 0.001 ? halfW / absUx : Infinity;
  const tY = absUy > 0.001 ? halfH / absUy : Infinity;
  const t = Math.min(tX, tY);
  return { x: from.x + ux * t, y: from.y + uy * t };
}
