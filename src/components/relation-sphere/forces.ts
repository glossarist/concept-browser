/**
 * d3-force-compatible force factories for the sphere simulation.
 *
 * Extracted from RelationSphere.vue. Each factory is pure — takes a
 * ForcesContext (read-only getters for the mutable sim state) and
 * returns a Force compatible with d3-force-simulation's `.force()`.
 *
 * Forces in play:
 *   - sphereConstraint: renormalizes node positions to the unit sphere
 *     each tick (‖p‖ = 1) and projects velocity onto the tangent plane.
 *   - velocityClamp(maxV): caps ‖v‖ at maxV to prevent runaway sim.
 *   - repulsion: pairwise chord-distance repulsion so cards spread on
 *     the sphere surface. Focus (depth=0) is immovable.
 *   - linkForce: 3D spring pulling connected nodes toward a target
 *     chord distance. Skips muted types / muted registers.
 *   - focusPin: pins the focus node at (0, 0, 1).
 *
 * navForce stays inline in RelationSphere.vue — its state
 * (navActive/navStart/navEnd/etc.) has 10+ touch points in the Vue
 * component's navigation logic, so extracting it adds risk without
 * proportional benefit.
 */
import type { Force, ForcesContext, SNode } from './types';

/** Renormalize ‖p‖ = 1 each tick + project velocity onto tangent plane. */
export function sphereConstraint(): Force {
  let nL: SNode[] = [];
  const force = () => {
    for (const n of nL) {
      const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z);
      if (len > 0.001) {
        const nx = n.x / len, ny = n.y / len, nz = n.z / len;
        n.x = nx; n.y = ny; n.z = nz;
        const rad = n.vx * nx + n.vy * ny + n.vz * nz;
        n.vx -= rad * nx; n.vy -= rad * ny; n.vz -= rad * nz;
      }
    }
  };
  (force as Force).initialize = (n: SNode[]) => { nL = n; };
  return force as Force;
}

/** Cap ‖v‖ at maxV to prevent runaway simulation. */
export function velocityClamp(maxV: number): Force {
  let nL: SNode[] = [];
  const force = () => {
    for (const n of nL) {
      const v2 = n.vx * n.vx + n.vy * n.vy + n.vz * n.vz;
      if (v2 > maxV * maxV) {
        const s = maxV / Math.sqrt(v2);
        n.vx *= s; n.vy *= s; n.vz *= s;
      }
    }
  };
  (force as Force).initialize = (n: SNode[]) => { nL = n; };
  return force as Force;
}

/**
 * Pairwise repulsion — pushes nodes apart on the sphere surface so
 * cards don't stack. Operates in 3D (chord distance), with the
 * sphereConstraint normalizing positions back to the unit sphere
 * each tick. Focus node (depth=0) is immovable.
 */
export function repulsion(ctx: ForcesContext): Force {
  let nL: SNode[] = [];
  const force = () => {
    const minDist = ctx.repulseMinDist();
    const strength = ctx.repulseStrength();
    const min2 = minDist * minDist;
    for (let i = 0; i < nL.length; i++) {
      const a = nL[i];
      if (a.depth === 0) continue;  /* focus pinned */
      for (let j = i + 1; j < nL.length; j++) {
        const b = nL[j];
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 >= min2 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const f = (strength * (minDist - d)) / d;
        const fx = dx * f, fy = dy * f, fz = dz * f;
        a.vx += fx; a.vy += fy; a.vz += fz;
        if (b.depth !== 0) { b.vx -= fx; b.vy -= fy; b.vz -= fz; }
      }
    }
  };
  (force as Force).initialize = (n: SNode[]) => { nL = n; };
  return force as Force;
}

/**
 * 3D spring (link) force — pulls connected nodes toward a target chord
 * distance. This is what actually spreads cards apart: longer springs
 * (higher Expand level) push the graph outward along its edges. Stock
 * d3-forceLink only handles x/y; this custom version operates in full
 * 3D so the sphereConstraint can renormalize positions correctly.
 *
 * Skips edges involving muted types or muted registers (except when
 * the focus node is on either end).
 */
export function linkForce(ctx: ForcesContext): Force {
  let nL: SNode[] = [];
  let idToIdx = new Map<string, number>();
  const force = () => {
    const links = ctx.links();
    if (links.length === 0) return;
    const target = ctx.linkDistance();
    const strength = ctx.linkStrength();
    /* Read muted sets each tick so toggleType/toggleRegister take effect
       immediately on the next simulation step. */
    const mutedT = ctx.mutedTypes();
    const mutedR = ctx.mutedRegisters();
    for (const link of links) {
      if (mutedT.has(link.type)) continue;
      const ai = idToIdx.get(link.source);
      const bi = idToIdx.get(link.target);
      if (ai === undefined || bi === undefined) continue;
      const a = nL[ai], b = nL[bi];
      /* Skip edges involving a muted register (unless the node is the focus) */
      if (a.depth !== 0 && mutedR.has(a.register)) continue;
      if (b.depth !== 0 && mutedR.has(b.register)) continue;
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const diff = ((d - target) / d) * strength;
      const fx = dx * diff, fy = dy * diff, fz = dz * diff;
      if (a.depth !== 0) { a.vx += fx; a.vy += fy; a.vz += fz; }
      if (b.depth !== 0) { b.vx -= fx; b.vy -= fy; b.vz -= fz; }
    }
  };
  (force as Force).initialize = (n: SNode[]) => {
    nL = n;
    idToIdx = new Map();
    for (let i = 0; i < n.length; i++) idToIdx.set(n[i].id, i);
  };
  return force as Force;
}

/**
 * Pin the focus node at (0, 0, 1) so neighbor repulsion doesn't shove
 * it. Without this, the focus drifts and the whole sphere wobbles.
 */
export function focusPin(): Force {
  let nL: SNode[] = [];
  const force = () => {
    for (const n of nL) {
      if (n.depth === 0) {
        n.x = 0; n.y = 0; n.z = 1;
        n.vx = 0; n.vy = 0; n.vz = 0;
      }
    }
  };
  (force as Force).initialize = (n: SNode[]) => { nL = n; };
  return force as Force;
}
