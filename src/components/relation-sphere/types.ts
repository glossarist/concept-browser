/**
 * Sphere graph types: SNode + SLink.
 *
 * Extracted from RelationSphere.vue so force factories and rendering
 * helpers in `relation-sphere/` can share the same types without
 * reaching into the Vue component.
 */

export interface SNode {
  id: string;
  term: string;
  definition?: string;
  /** Languages available on this concept. */
  languages?: string[];
  ref: string;
  register: string;
  conceptId: string;
  depth: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
}

export interface SLink {
  source: string;
  target: string;
  type: string;
  category: string;
  depth: number;
}

/**
 * Simulation state shared with the force factories.
 *
 * The Vue component holds the mutable bindings; the forces read them
 * via getters each tick so user changes (Expand slider, mute toggles,
 * navigation target) take effect on the next simulation step.
 */
export interface ForcesContext {
  nodes: () => SNode[];
  links: () => SLink[];
  mutedTypes: () => Set<string>;
  mutedRegisters: () => Set<string>;
  /** Expand-slider-driven parameters (link distance/strength, repulse min/strength). */
  linkDistance: () => number;
  linkStrength: () => number;
  repulseMinDist: () => number;
  repulseStrength: () => number;
}

/** d3-force-compatible force: a callable + initialize hook. */
export type Force = ((alpha?: number) => void) & { initialize?: (nodes: SNode[]) => void };
