<script setup lang="ts">
/**
 * RelationSphere — 3D sphere visualization of a concept's neighborhood.
 *
 * Self-contained: receives concept + edges as props, builds its own internal
 * graph with simple string IDs (like the prototype). No dependency on the
 * graph engine's URI scheme.
 *
 * Physics: EXACT replica of the prototype — only 3 forces:
 *   sphereConstraint (normalize ‖p‖=1 + tangent velocity projection),
 *   velocityClamp(0.20), navForce (SLERP-eased target tracking).
 */
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { forceSimulation, zoom, select, zoomIdentity } from 'd3';
import { useUiStore } from '../stores/ui';
import { useVocabularyStore } from '../stores/vocabulary';
import { useDsStyle } from '../utils/dataset-style';
import { getFactory } from '../adapters/factory';
import { SPHERE_RELATION_CATEGORIES as RELATION_CATEGORIES, sphereCategoryForType as categoryForType, categorizeRelationForSphere as categorizeRelation, colorForTypeInMode as colorForTypeRaw, relationLabel as relationTypeLabel } from '../utils/relation-sphere-styling';
import { easeInOutCubic, slerp, fibonacciSpherePosition, project, cardEdge, type Vec3 } from '../composables/useSphereProjection';
import { UriRouter } from '../adapters/UriRouter';
import { getPreferredTerm } from '../utils/concept-helpers';
import { renderContent } from '../utils/content-renderer';
import { hashSeed, expandParams, portSide, portPoint, idToUriGet } from '../utils/sphere-math';
import { useI18n } from '../i18n';

const { t, locale } = useI18n();
import type { Concept, Manifest, GraphEdge, PartitiveRelationWire } from '../adapters/types';
import { conceptUri } from '../adapters/model-bridge';

const props = defineProps<{
  concept: Concept;
  manifest: Manifest;
  registerId: string;
  edges: GraphEdge[];
  partitiveRelations?: PartitiveRelationWire[];
}>();

const emit = defineEmits<{
  navigate: [payload: { registerId: string; conceptId: string }];
}>();

const uiStore = useUiStore();
const store = useVocabularyStore();
const { getColor } = useDsStyle();

/* ── Types ──────────────────────────────────────────────── */
interface SNode {
  id: string;
  term: string;
  definition?: string;
  languages?: string[];  /* languages available on this concept */
  ref: string;
  register: string;
  conceptId: string;
  depth: number;
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
}
interface SLink {
  source: string; target: string;
  type: string; category: string;
  depth: number;
}

/* ── State ──────────────────────────────────────────────── */
const canvasRef = ref<HTMLDivElement | null>(null);
const viewportRef = ref<HTMLDivElement | null>(null);
const nodesLayerRef = ref<HTMLDivElement | null>(null);
const edgesSvgRef = ref<SVGSVGElement | null>(null);

let nodes: SNode[] = [];
let links: SLink[] = [];
const graphVersion = ref(0);  /* bump when nodes/links change → reactive computeds re-evaluate */
let sim: ReturnType<typeof forceSimulation<any>> | null = null;
let zoomBehavior: any = null;
const nodeEls = new Map<string, HTMLElement>();
let isFirstRender = true;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
const hoveredNode = ref<SNode | null>(null);
const degree = ref<1 | 2 | 3>(1);
const expandValue = ref(5);  /* 0–10 slider, 5 = default */
const mutedTypes = ref<Set<string>>(new Set());
const mutedRegisters = ref<Set<string>>(new Set());
const panelOpen = ref(true);
const MAX_NODES = 36;

/* Sphere-display language. Defaults to the i18n UI locale (which reads
   localStorage) so e.g. a user returning in French mode sees French
   terms by default. The user can override via the Language selector. */
const sphereLang = ref<string>(locale.value || 'eng');
const availableLangs = ref<Set<string>>(new Set());
const previewVersion = ref(0);  /* bump to refresh the preview card */

/* When the user mutes a register or changes degree, we keep the simulation
   running so nodes can reflow into their new positions. For dataset mute
   we just hide the affected DOM + edges — no graph rebuild. For degree
   change we rebuild the graph entirely. */

/* Nav tween state */
let navActive = false;
let navStart: Record<string, Vec3> | null = null;
let navEnd: Record<string, Vec3> | null = null;
let navOldDepths: Record<string, number> | null = null;
let navStartTime = 0;
let navT = 1;
let navDuration = 2200;  /* mutable — shorter for expand changes than for concept navigation */

/* ── Async-load neighbor designations ───────────────────── */
/* Three strategies, cheapest first:
 *   1. Graph engine node (already loaded with designations)
 *   2. Adapter's index entry (loaded via loadDataset → has designations)
 *   3. Full concept fetch (last resort, hits the network per-concept)
 */
async function loadNeighborTerms() {
  const factory = getFactory();
  const lang = sphereLang.value;
  const uriBase = props.manifest.uriBase;
  if (!uriBase) throw new Error('RelationSphere: manifest.uriBase is required');
  const neighborRegisters = new Set<string>();

  /* Phase 1: collect which neighbor datasets we need to load */
  for (const n of nodes) {
    if (n.depth === 0) continue;
    if (n.register && n.register !== props.registerId) neighborRegisters.add(n.register);
  }

  /* Phase 2: ensure all neighbor datasets are loaded (parallel) */
  await Promise.allSettled(
    [...neighborRegisters].map(async (reg) => {
      const existing = factory.getAdapter(reg) ?? store.datasets.get(reg);
      if (existing?.index) return;
      try { await store.loadDataset(reg); } catch { /* ignore */ }
    })
  );

  /* Phase 3: for each neighbor, resolve designation + definition + languages */
  const promises: Promise<void>[] = [];
  for (const n of nodes) {
    if (n.depth === 0) continue;
    promises.push((async () => {
      const info = await resolveTerm(n, lang, uriBase, factory);
      if (!info) return;
      if (info.term && info.term !== n.term) {
        n.term = info.term;
        updateNodeTerm(n);
      }
      if (info.definition) n.definition = info.definition;
      if (info.languages?.length) n.languages = info.languages;
      /* Update preview if this is the hovered node */
      if (hoveredNode.value?.id === n.id) previewVersion.value++;
      /* Refresh the available-languages set */
      if (info.languages?.length) {
        for (const l of info.languages) availableLangs.value.add(l);
      }
    })());
  }
  await Promise.allSettled(promises);
}

interface ResolvedTerm {
  term: string | null;
  definition?: string;
  languages?: string[];
}

async function resolveTerm(
  n: SNode,
  lang: string,
  uriBase: string,
  factory: ReturnType<typeof getFactory>
): Promise<ResolvedTerm | null> {
  const neighborUri = UriRouter.buildConceptUri(uriBase, n.register, n.conceptId);
  const out: ResolvedTerm = { term: null };

  /* Strategy 1: graph engine */
  const gn = store.graph.getNode(neighborUri);
  if (gn?.designations) {
    const term = gn.designations[lang] ?? gn.designations.eng ?? Object.values(gn.designations)[0];
    if (term) out.term = term;
    out.languages = Object.keys(gn.designations);
  }

  /* Strategy 2: adapter's index entry */
  const adapter = factory.getAdapter(n.register) ?? store.datasets.get(n.register);
  if (adapter?.index) {
    const entry = adapter.getIndexEntry(n.conceptId);
    if (entry?.designations) {
      if (!out.term) {
        const term = entry.designations[lang] ?? entry.designations.eng ?? Object.values(entry.designations)[0];
        if (term) out.term = term;
      }
      if (!out.languages?.length) out.languages = Object.keys(entry.designations);
    }
  }

  /* Strategy 3: full concept fetch — gives us the definition too */
  if (adapter) {
    try {
      const concept = await adapter.fetchConcept(n.conceptId);
      if (concept?.languages?.length && !out.languages?.length) {
        out.languages = [...concept.languages];
      }
      const langs = concept?.languages ?? [];
      const lc =
        concept?.localization?.(lang) ??
        concept?.localization?.('eng') ??
        (langs.length > 0 ? concept?.localization?.(langs[0]) : undefined);
      if (!out.term) {
        const term = getPreferredTerm(lc ?? null, n.conceptId);
        if (term && term !== n.conceptId) out.term = term;
      }
      if (lc?.definitions?.[0]?.content) {
        out.definition = lc.definitions[0].content;
      } else if (lc?.primaryDefinition) {
        out.definition = lc.primaryDefinition;
      }
    } catch { /* keep what we have */ }
  }

  return out.term ? out : null;
}

function updateNodeTerm(n: SNode) {
  const el = nodeEls.get(n.id);
  if (el) {
    const termEl = el.querySelector('.sp-term');
    if (termEl) termEl.textContent = n.term;
  }
}

/* ── Build internal graph from concept + edges (BFS) ────── */

function buildGraph() {
  const focusUri = conceptUri(props.concept, props.registerId, props.manifest.uriBase);
  const focusId = props.concept?.id || props.registerId;
  const focusNodeId = `${props.registerId}/${focusId}`;
  const lang = sphereLang.value;
  const maxDepth = degree.value;

  /* Seed availableLangs from the focus concept's languages */
  if (props.concept?.languages?.length) {
    for (const l of props.concept.languages) availableLangs.value.add(l);
  }

  /* Focus node — pinned at north pole. Try requested lang, then English,
     then any available language (e.g. viml-1968 is French-only — falling
     back to 'fra' is much better than showing the raw conceptId). */
  const conceptLangs = props.concept?.languages ?? [];
  const focusLc =
    props.concept?.localization?.(lang) ??
    props.concept?.localization?.('eng') ??
    (conceptLangs.length > 0 ? props.concept?.localization?.(conceptLangs[0]) : undefined);
  const focusNode: SNode = {
    id: focusNodeId,
    term: getPreferredTerm(focusLc ?? null, focusId),
    ref: props.manifest.ref || props.registerId,
    register: props.registerId,
    conceptId: focusId,
    depth: 0,
    x: 0, y: 0, z: 1,
    vx: 0, vy: 0, vz: 0,
  };

  const nodeMap = new Map<string, SNode>([[focusNodeId, focusNode]]);
  const visited: Map<string, number> = new Map([[focusUri, 0]]);  // uri → depth
  const idToUri = new Map<string, string>([[focusNodeId, focusUri]]);  // for inter-neighbor edge pass
  const resultLinks: SLink[] = [];
  const linkKeys = new Set<string>();  /* dedupe edges */
  const queue: Array<{ uri: string; depth: number; id: string }> = [];

  /* First pass: collect depth-1 neighbors (deduped) so we know N for even
     ring placement. */
  const depth1List: Array<{ uri: string; parsed: { registerId: string; conceptId: string }; isOutgoing: boolean; edge: GraphEdge }> = [];
  for (const edge of props.edges) {
    const isOutgoing = edge.source === focusUri || edge.source === focusId;
    const otherUri = isOutgoing ? edge.target : edge.source;
    if (!otherUri || visited.has(otherUri)) continue;
    const parsed = UriRouter.parseUri(otherUri);
    if (!parsed || (parsed.conceptId === focusId && parsed.registerId === props.registerId)) continue;
    visited.set(otherUri, 1);
    depth1List.push({ uri: otherUri, parsed, isOutgoing, edge });
  }

  /* Second pass: place depth-1 nodes on an even ring around the focus. */
  const depth1Total = depth1List.length;
  depth1List.forEach(({ uri, parsed, isOutgoing, edge }, i) => {
    const nid = `${parsed.registerId}/${parsed.conceptId}`;
    const pos = fibonacciSpherePosition(1, i, depth1Total, hashSeed(parsed.conceptId));
    nodeMap.set(nid, {
      id: nid,
      term: edge.label || parsed.conceptId,
      ref: parsed.registerId,
      register: parsed.registerId,
      conceptId: parsed.conceptId,
      depth: 1,
      x: pos.x, y: pos.y, z: pos.z,
      vx: 0, vy: 0, vz: 0,
    });
    idToUri.set(nid, uri);
    const src = isOutgoing ? focusNodeId : nid;
    const tgt = isOutgoing ? nid : focusNodeId;
    const key = `${src}\0${tgt}\0${edge.type}`;
    if (!linkKeys.has(key)) {
      linkKeys.add(key);
      resultLinks.push({
        source: src,
        target: tgt,
        type: edge.type,
        category: categorizeRelation(edge.type),
        depth: 1,
      });
    }
    queue.push({ uri, depth: 1, id: `${parsed.registerId}/${parsed.conceptId}` });
  });

  /* BFS deeper levels using graph engine (has cross-dataset edges) */
  while (queue.length > 0 && nodeMap.size < MAX_NODES) {
    const { uri, depth, id } = queue.shift()!;
    if (depth >= maxDepth) continue;

    const outEdges = store.graph.getEdges(uri);
    const inEdges = store.graph.getIncomingEdges(uri);
    /* Collect this node's children first so we can place them as an even
       sub-ring around their parent. */
    const children: Array<{ uri: string; parsed: { registerId: string; conceptId: string }; isOutgoing: boolean; edge: GraphEdge }> = [];
    for (const edge of [...outEdges, ...inEdges]) {
      if (nodeMap.size + children.length >= MAX_NODES) break;
      const isOutgoing = edge.source === uri;
      const otherUri = isOutgoing ? edge.target : edge.source;
      if (!otherUri || visited.has(otherUri)) continue;
      const parsed = UriRouter.parseUri(otherUri);
      if (!parsed) continue;
      const childId = `${parsed.registerId}/${parsed.conceptId}`;
      if (childId === focusNodeId || nodeMap.has(childId)) continue;
      visited.set(otherUri, depth + 1);
      children.push({ uri: otherUri, parsed, isOutgoing, edge });
    }
    children.forEach(({ uri: cUri, parsed, isOutgoing, edge }, i) => {
      const cid = `${parsed.registerId}/${parsed.conceptId}`;
      const pos = fibonacciSpherePosition(depth + 1, i, children.length, hashSeed(parsed.conceptId));
      nodeMap.set(cid, {
        id: cid,
        term: parsed.conceptId,
        ref: parsed.registerId,
        register: parsed.registerId,
        conceptId: parsed.conceptId,
        depth: depth + 1,
        x: pos.x, y: pos.y, z: pos.z,
        vx: 0, vy: 0, vz: 0,
      });
      idToUri.set(cid, cUri);
      const src = isOutgoing ? id : cid;
      const tgt = isOutgoing ? cid : id;
      const key = `${src}\0${tgt}\0${edge.type}`;
      if (!linkKeys.has(key)) {
        linkKeys.add(key);
        resultLinks.push({
          source: src,
          target: tgt,
          type: edge.type,
          category: categorizeRelation(edge.type),
          depth: depth + 1,
        });
      }
      queue.push({ uri: cUri, depth: depth + 1, id: cid });
    });
  }

  /* Third pass: find inter-neighbor edges (connections between nodes that
     aren't the BFS parent→child relationship). Adds structural fidelity —
     e.g. two depth-2 nodes that reference each other get an edge drawn. */
  for (const [aId, aUri] of idToUri) {
    const outEdges = store.graph.getEdges(aUri);
    for (const edge of outEdges) {
      if (edge.target === aUri) continue;
      const bId = idToUriGet(idToUri, edge.target);
      if (!bId || bId === aId) continue;
      const key = `${aId}\0${bId}\0${edge.type}`;
      if (linkKeys.has(key)) continue;
      linkKeys.add(key);
      resultLinks.push({
        source: aId,
        target: bId,
        type: edge.type,
        category: categorizeRelation(edge.type),
        depth: Math.max(nodeMap.get(aId)?.depth ?? 0, nodeMap.get(bId)?.depth ?? 0),
      });
    }
  }

  nodes = Array.from(nodeMap.values());
  links = resultLinks;

  /* Ensure every PartitiveRelation member is present in the graph
     so the rake bundle can render. The comprehensive is normally the
     focus; partitives may need to be added as depth-1 neighbors. */
  for (const rel of props.partitiveRelations ?? []) {
    const compParsed = UriRouter.parseUri(rel.comprehensive);
    if (!compParsed) continue;
    const compNodeId = `${compParsed.registerId}/${compParsed.conceptId}`;
    if (!nodeMap.has(compNodeId)) continue;

    for (const member of rel.partitives) {
      const parsed = UriRouter.parseUri(member.uri);
      if (!parsed) continue;
      const nid = `${parsed.registerId}/${parsed.conceptId}`;
      if (nodeMap.has(nid)) continue;
      if (nodeMap.size >= MAX_NODES) break;
      const pos = fibonacciSpherePosition(1, nodeMap.size, MAX_NODES, hashSeed(parsed.conceptId));
      nodeMap.set(nid, {
        id: nid,
        term: parsed.conceptId,
        ref: parsed.registerId,
        register: parsed.registerId,
        conceptId: parsed.conceptId,
        depth: 1,
        x: pos.x, y: pos.y, z: pos.z,
        vx: 0, vy: 0, vz: 0,
      });
      idToUri.set(nid, member.uri);
      nodes = Array.from(nodeMap.values());
    }
  }

  graphVersion.value++;
}

/* Reverse lookup: URI → node id. Linear scan is fine for ≤36 nodes. */
/* ── Custom forces (EXACT prototype replica) ────────────── */
function sphereConstraint() {
  let nL: SNode[] = nodes;
  function force() {
    for (const n of nL) {
      const len = Math.sqrt(n.x*n.x + n.y*n.y + n.z*n.z);
      if (len > 0.001) {
        const nx = n.x/len, ny = n.y/len, nz = n.z/len;
        n.x = nx; n.y = ny; n.z = nz;
        const rad = n.vx*nx + n.vy*ny + n.vz*nz;
        n.vx -= rad*nx; n.vy -= rad*ny; n.vz -= rad*nz;
      }
    }
  }
  (force as any).initialize = (n: SNode[]) => { nL = n; };
  return force;
}
function velocityClamp(maxV: number) {
  let nL: SNode[] = nodes;
  function force() {
    for (const n of nL) {
      const v2 = n.vx*n.vx + n.vy*n.vy + n.vz*n.vz;
      if (v2 > maxV*maxV) { const s = maxV/Math.sqrt(v2); n.vx*=s; n.vy*=s; n.vz*=s; }
    }
  }
  (force as any).initialize = (n: SNode[]) => { nL = n; };
  return force;
}
/* Pairwise repulsion — pushes nodes apart on the sphere surface so cards
   don't stack. Operates in 3D (chord distance), with the sphereConstraint
   normalizing positions back to the unit sphere each tick. Focus node is
   immovable: its position is reset every tick by `tickFocusReset`.
   `minDist` and `strength` are mutable so the user can change the spread
   via the Expand selector without rebuilding the force. */
/* Expand parameters — driven by a 0–10 slider. We map the slider value
   to a link (spring) distance continuously across a wide range so the
   visual difference between tight (0) and loose (10) is dramatic.
   Link distance is chord distance on the unit sphere: 0.5 ≈ 29° (cards
   cluster near focus), 1.95 ≈ 154° (cards spread to back hemisphere). */
let linkDistance = expandParams(5).linkDist;
let linkStrength = expandParams(5).linkStrength;
let repulseMinDist = expandParams(5).repMin;
let repulseStrength = expandParams(5).repStrength;

function repulsion() {
  let nL: SNode[] = nodes;
  function force() {
    const minDist = repulseMinDist;
    const strength = repulseStrength;
    const min2 = minDist * minDist;
    for (let i = 0; i < nL.length; i++) {
      const a = nL[i];
      if (a.depth === 0) continue;  /* focus pinned */
      for (let j = i + 1; j < nL.length; j++) {
        const b = nL[j];
        const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
        const d2 = dx*dx + dy*dy + dz*dz;
        if (d2 >= min2 || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const f = strength * (minDist - d) / d;
        const fx = dx * f, fy = dy * f, fz = dz * f;
        a.vx += fx; a.vy += fy; a.vz += fz;
        if (b.depth !== 0) { b.vx -= fx; b.vy -= fy; b.vz -= fz; }
      }
    }
  }
  (force as any).initialize = (n: SNode[]) => { nL = n; };
  return force;
}
const navForce = (() => {
  let nL: SNode[] = nodes;
  function force() {
    if (!navActive || !navStart || !navEnd) return;
    const t = Math.min((performance.now() - navStartTime) / navDuration, 1);
    const e = easeInOutCubic(t);
    navT = t;
    for (const n of nL) {
      const s = navStart[n.id], en = navEnd[n.id];
      if (!s || !en) continue;
      const target = slerp(s, en, e);
      let dx = target.x - n.x, dy = target.y - n.y, dz = target.z - n.z;
      const rad = dx*n.x + dy*n.y + dz*n.z;
      dx -= rad*n.x; dy -= rad*n.y; dz -= rad*n.z;
      const k = 0.18;
      n.vx += dx*k; n.vy += dy*k; n.vz += dz*k;
    }
    if (t >= 1) { navActive = false; navStart = null; navEnd = null; navOldDepths = null; navT = 1; }
  }
  (force as any).initialize = (n: SNode[]) => { nL = n; };
  return force;
})();
const sphereF = sphereConstraint();
const clampF = velocityClamp(0.20);
/* minDist=0.95 ≈ 56° separation on the unit sphere — strong spread so
   cards don't cluster around the focus. strength is high enough that
   nodes reach their spread positions within ~2 seconds of sim start. */
const repulseF = repulsion();

/* 3D spring (link) force — pulls connected nodes toward a target chord
   distance. This is what actually spreads cards apart: longer springs
   (higher Expand level) push the graph outward along its edges. Stock
   d3-forceLink only handles x/y; this custom version operates in full
   3D so the sphereConstraint can renormalize positions correctly. */
function linkForce() {
  let nL: SNode[] = nodes;
  let idToIdx = new Map<string, number>();
  function force() {
    if (links.length === 0) return;
    const target = linkDistance;
    const strength = linkStrength;
    for (const link of links) {
      const ai = idToIdx.get(link.source);
      const bi = idToIdx.get(link.target);
      if (ai === undefined || bi === undefined) continue;
      const a = nL[ai], b = nL[bi];
      const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
      const d2 = dx*dx + dy*dy + dz*dz;
      if (d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const diff = (d - target) / d * strength;
      const fx = dx * diff, fy = dy * diff, fz = dz * diff;
      if (a.depth !== 0) { a.vx += fx; a.vy += fy; a.vz += fz; }
      if (b.depth !== 0) { b.vx -= fx; b.vy -= fy; b.vz -= fz; }
    }
  }
  (force as any).initialize = (n: SNode[]) => {
    nL = n;
    idToIdx = new Map();
    for (let i = 0; i < n.length; i++) idToIdx.set(n[i].id, i);
  };
  return force;
}
const linkF = linkForce();
/* Pin the focus node at (0, 0, 1) so neighbor repulsion doesn't shove it.
   Without this, the focus drifts and the whole sphere wobbles. */
function focusPin() {
  let nL: SNode[] = nodes;
  function force() {
    for (const n of nL) {
      if (n.depth === 0) { n.x = 0; n.y = 0; n.z = 1; n.vx = 0; n.vy = 0; n.vz = 0; }
    }
  }
  (force as any).initialize = (n: SNode[]) => { nL = n; };
  return force;
}
const focusPinF = focusPin();

/* ── Simulation ─────────────────────────────────────────── */
function setupSim() {
  if (sim) sim.stop();
  if (nodes.length === 0) return;
  sim = forceSimulation(nodes as any)
    .force('nav', navForce as any)
    .force('link', linkF as any)
    .force('repulse', repulseF as any)
    .force('sphere', sphereF as any)
    .force('clamp', clampF as any)
    .force('pin', focusPinF as any)
    .alpha(1)
    .alphaDecay(0.05)
    .alphaMin(0.001)
    .velocityDecay(0.55)
    .on('tick', onTick)
    .on('end', autoFitZoom);
}

/* ── Tick: imperative DOM updates ───────────────────────── */
function onTick() {
  const c = canvasRef.value; if (!c) return;
  const cx = c.clientWidth / 2;
  const cy = c.clientHeight * 0.46;
  for (const n of nodes) {
    const el = nodeEls.get(n.id); if (!el) continue;
    const p = project({x: n.x, y: n.y, z: n.z});
    const x = p.x + cx, y = p.y + cy;
    const ds = (n.depth === 0 || n.depth === 1) ? 0.95 : n.depth === 2 ? 0.78 : 0.62;
    const isHovered = el.classList.contains('hovered');
    const baseOp = n.depth === 0 ? 1.0 : n.depth === 1 ? 0.92 : n.depth === 2 ? 0.80 : 0.68;
    const zFade = (p.z + 1) / 2;
    const op = isHovered ? 1.0 : Math.max(baseOp * 0.85, baseOp * (0.7 + zFade * 0.3));
    el.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%) scale(${ds})`;
    el.style.opacity = op.toFixed(3);
    /* Don't clobber z-index=999 set on hover */
    if (!isHovered) {
      el.style.zIndex = String(Math.round(p.z * 10 + (n.depth === 0 ? 20 : 5)));
    }
  }
  drawEdges(cx, cy);
}

/* ── Edge drawing with 4-port card connections + type labels ─ */
/* Determine which side of a card (top/bottom/left/right) an edge should
   connect to, based on the direction to the other endpoint. */
/* Compute the connection point on a card's side, with an offset along
   that side so multiple edges to the same side don't stack on top of
   each other. `offset` is in [-1, 1] (0 = midpoint, ±1 = corners). */
function drawEdges(cx: number, cy: number) {
  const svg = edgesSvgRef.value; if (!svg) return;
  const w = cx * 2, h = cy * 2 / 0.46;
  svg.setAttribute('width', String(w));
  svg.setAttribute('height', String(h));
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'none');
  /* Remove only path + text + rect (edges), keep defs (markers).
     Also remove <line> elements (rake-bundle segments) and <circle>
     (rake junction markers). */
  svg.querySelectorAll('path:not(defs path), line.rake-seg, circle.rake-junction, text.edge-label, rect.edge-label-bg').forEach(el => el.remove());
  if (!svg.querySelector('defs')) ensureMarkers(svg);

  /* Compute visible node positions */
  const pos = new Map<string, {x: number; y: number}>();
  for (const n of nodes) {
    if (n.depth !== 0 && mutedRegisters.value.has(n.register)) continue;
    const p = project({x: n.x, y: n.y, z: n.z});
    pos.set(n.id, {x: p.x + cx, y: p.y + cy});
  }

  /* Pre-compute visible edges */
  const visibleLinks = links.filter(l => {
    if (mutedTypes.value.has(l.type)) return false;
    return pos.has(l.source) && pos.has(l.target);
  });

  const CARD_W = 220, CARD_H = 70;

  /* For each card, collect all edges that touch it, grouped by side.
     Then distribute connection points along each side so arrows don't
     overlap. Returns: Map<edgeIdx + endpoint, {x,y}> */
  const portMap = new Map<string, {x: number; y: number}>();
  const cardsEdges = new Map<string, Array<{ idx: number; otherId: string; side: 'top'|'bottom'|'left'|'right'; isSource: boolean }>>();
  visibleLinks.forEach((link, idx) => {
    const a = pos.get(link.source)!, b = pos.get(link.target)!;
    const sideA = portSide(a, b);
    const sideB = portSide(b, a);
    if (!cardsEdges.has(link.source)) cardsEdges.set(link.source, []);
    if (!cardsEdges.has(link.target)) cardsEdges.set(link.target, []);
    cardsEdges.get(link.source)!.push({ idx, otherId: link.target, side: sideA, isSource: true });
    cardsEdges.get(link.target)!.push({ idx, otherId: link.source, side: sideB, isSource: false });
  });
  for (const [cardId, list] of cardsEdges) {
    const cardCenter = pos.get(cardId)!;
    /* Group by side */
    const bySide: Record<string, typeof list> = {};
    for (const e of list) {
      if (!bySide[e.side]) bySide[e.side] = [];
      bySide[e.side].push(e);
    }
    for (const sideKey of Object.keys(bySide)) {
      const side = sideKey as 'top'|'bottom'|'left'|'right';
      const items = bySide[side];
      /* Sort by perpendicular coordinate of the OTHER endpoint so edges
         are visually ordered along the side. */
      items.sort((a, b) => {
        const ao = pos.get(a.otherId)!, bo = pos.get(b.otherId)!;
        if (side === 'top' || side === 'bottom') return ao.x - bo.x;
        return ao.y - bo.y;
      });
      const n = items.length;
      items.forEach((item, i) => {
        /* Even distribution: offsets at (i - (n-1)/2) / n.
           n=1 → 0; n=2 → ±0.25; n=3 → -1/3, 0, +1/3; etc. */
        const offset = n === 1 ? 0 : (i - (n - 1) / 2) / n;
        const key = `${item.idx}:${item.isSource ? 'src' : 'tgt'}`;
        portMap.set(key, portPoint(cardCenter, side, CARD_W, CARD_H, offset));
      });
    }
  }

  for (let i = 0; i < visibleLinks.length; i++) {
    const link = visibleLinks[i];
    const eA = portMap.get(`${i}:src`)!;
    const eB = portMap.get(`${i}:tgt`)!;
    const mid_x = (eA.x + eB.x) / 2;
    const mid_y = (eA.y + eB.y) / 2;
    const edgeColor = colorForTypeRaw(link.type || 'unknown', uiStore.isDark);
    const cat = RELATION_CATEGORIES.find(c => c.key === link.category) ?? categoryForType(link.type || 'related');

    /* Edge path — straight line from port to port for clean port connection */
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', `M ${eA.x} ${eA.y} L ${eB.x} ${eB.y}`);
    path.setAttribute('stroke', edgeColor);
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('opacity', '0.7');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke-linecap', 'round');
    if (cat.dasharray !== 'none') path.setAttribute('stroke-dasharray', cat.dasharray);
    const markerId = ensureTypeMarker(svg, link.type || 'unknown', edgeColor);
    path.setAttribute('marker-end', `url(#${markerId})`);
    svg.appendChild(path);

    /* Type label at midpoint with background for readability.
       Translated via i18n so French users see "référence" not "references". */
    const rawType = link.type || '?';
    const labelText = relationTypeLabel(rawType);
    const labelWidth = labelText.length * 5.5 + 6;
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('class', 'edge-label-bg');
    bg.setAttribute('x', String(mid_x - labelWidth/2));
    bg.setAttribute('y', String(mid_y - 7));
    bg.setAttribute('width', String(labelWidth));
    bg.setAttribute('height', '13');
    bg.setAttribute('rx', '2');
    bg.setAttribute('fill', 'rgba(255,255,255,0.92)');
    bg.setAttribute('stroke', edgeColor);
    bg.setAttribute('stroke-width', '0.5');
    bg.setAttribute('opacity', '0.9');
    svg.appendChild(bg);

    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('class', 'edge-label');
    label.setAttribute('x', String(mid_x));
    label.setAttribute('y', String(mid_y + 3));
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('fill', edgeColor);
    label.setAttribute('font-size', '8.5');
    label.setAttribute('font-family', 'JetBrains Mono, monospace');
    label.setAttribute('font-weight', '600');
    label.textContent = labelText;
    svg.appendChild(label);
  }

  drawRakeBundles(svg, pos, cx, cy);
}

/**
 * Render PartitiveRelations as ISO 704 rake/bracket bundles in the sphere.
 *
 * Each relation renders as a real bracket:
 *
 *     [comprehensive]
 *            |
 *            |          ← single stem (vertical/radial)
 *            |
 *        +---•---+      ← spine midpoint (junction)
 *        |   |   |
 *        |   |   |      ← N branches from spine midpoint
 *      [p1] [p2] [p3]      (one per partitive)
 *
 * In 3D the bracket's "vertical" direction is along the line from
 * comprehensive to the centroid of partitives. The branches fan out
 * from the spine midpoint to each partitive. Right angles are not
 * enforceable in a force-directed layout; instead we use a single
 * shared junction point so the eye reads "ONE relation, N branches".
 *
 * ISO 704 line conventions applied (each segment: stem + spine + branches):
 *   - default                              : single solid line
 *   - plurality.isShared && !isUncertain   : two parallel solid lines
 *                                            (close-set; offset ±DOUBLE_GAP/2)
 *   - plurality.isShared && isUncertain    : one solid + one dashed line
 *
 * Per-member certainty:
 *   - confirmed : branch is solid (with the plurality style above)
 *   - possible  : branch is dashed + reduced opacity (overrides plurality
 *                 on that branch only; the stem + spine keep the relation
 *                 style)
 *
 * A diamond marker at the comprehensive end signals the hyperedge origin.
 */
function drawRakeBundles(
  svg: SVGSVGElement,
  pos: Map<string, {x: number; y: number}>,
  _cx: number,
  _cy: number,
) {
  const color = uiStore.isDark ? '#2dd4bf' : '#0d9488';
  const DOUBLE_GAP = 4;
  const DASH = '4 3';

  for (const rel of props.partitiveRelations ?? []) {
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
      .filter((x): x is { member: { uri: string; certainty: 'confirmed' | 'possible' }; pos: {x: number; y: number} } => x !== null);

    if (memberPositions.length === 0) continue;

    // Spine midpoint = centroid of comprehensive + all partitives.
    // This is the junction where the stem meets the branches.
    const cx_part = (compPos.x + memberPositions.reduce((s, m) => s + m.pos.x, 0)) / (memberPositions.length + 1);
    const cy_part = (compPos.y + memberPositions.reduce((s, m) => s + m.pos.y, 0)) / (memberPositions.length + 1);

    const isShared = !!rel.plurality?.isShared;
    const isUncertain = !!rel.plurality?.isUncertain;

    /**
     * Draw a single straight line segment with optional parallel offset
     * and dash style. Used for both stem and branches.
     */
    const drawSegment = (
      ax: number, ay: number, bx: number, by: number,
      opts: { offset?: number; dashed?: boolean; opacity?: number } = {},
    ) => {
      const offset = opts.offset ?? 0;
      const dashed = opts.dashed ?? false;
      const opacity = opts.opacity ?? 0.85;
      if (offset === 0) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'rake-seg');
        line.setAttribute('x1', String(ax));
        line.setAttribute('y1', String(ay));
        line.setAttribute('x2', String(bx));
        line.setAttribute('y2', String(by));
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '1.6');
        line.setAttribute('opacity', String(opacity));
        line.setAttribute('stroke-linecap', 'round');
        if (dashed) line.setAttribute('stroke-dasharray', DASH);
        svg.appendChild(line);
      } else {
        // Compute perpendicular unit vector for parallel offset
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
        line.setAttribute('stroke-width', '1.6');
        line.setAttribute('opacity', String(opacity));
        line.setAttribute('stroke-linecap', 'round');
        if (dashed) line.setAttribute('stroke-dasharray', DASH);
        svg.appendChild(line);
      }
    };

    /**
     * Draw a segment with the relation's plurality style:
     * single solid (default), double solid (isShared),
     * or solid + dashed (isShared + isUncertain).
     */
    const drawSegmentWithPlurality = (
      ax: number, ay: number, bx: number, by: number,
      opts: { opacity?: number; perMemberPossible?: boolean } = {},
    ) => {
      const opacity = opts.opacity ?? 0.85;
      if (!isShared) {
        drawSegment(ax, ay, bx, by, { opacity, dashed: opts.perMemberPossible });
      } else {
        // Close-set double: two parallel lines offset ±DOUBLE_GAP/2
        drawSegment(ax, ay, bx, by, { offset: -DOUBLE_GAP / 2, opacity });
        drawSegment(ax, ay, bx, by, {
          offset: DOUBLE_GAP / 2,
          opacity,
          dashed: isUncertain || opts.perMemberPossible,
        });
      }
    };

    // 1. Stem: comprehensive → spine midpoint
    drawSegmentWithPlurality(compPos.x, compPos.y, cx_part, cy_part);

    // 2. Branches: spine midpoint → each partitive
    for (const { member, pos: pPos } of memberPositions) {
      drawSegmentWithPlurality(cx_part, cy_part, pPos.x, pPos.y, {
        opacity: member.certainty === 'possible' ? 0.45 : 0.85,
        perMemberPossible: member.certainty === 'possible',
      });
    }

    // 3. Junction marker at spine midpoint (small filled circle)
    const junction = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    junction.setAttribute('class', 'rake-junction');
    junction.setAttribute('cx', String(cx_part));
    junction.setAttribute('cy', String(cy_part));
    junction.setAttribute('r', '3');
    junction.setAttribute('fill', color);
    junction.setAttribute('opacity', '0.85');
    junction.setAttribute('stroke', uiStore.isDark ? '#0a1f1c' : '#ffffff');
    junction.setAttribute('stroke-width', '1');
    svg.appendChild(junction);

    // 4. Diamond marker at comprehensive end (hyperedge origin signal)
    const diamond = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const dsize = 5;
    diamond.setAttribute('d',
      `M ${compPos.x} ${compPos.y - dsize} L ${compPos.x + dsize} ${compPos.y} L ${compPos.x} ${compPos.y + dsize} L ${compPos.x - dsize} ${compPos.y} Z`);
    diamond.setAttribute('fill', color);
    diamond.setAttribute('opacity', '0.9');
    diamond.setAttribute('stroke', uiStore.isDark ? '#0a1f1c' : '#ffffff');
    diamond.setAttribute('stroke-width', '1');
    svg.appendChild(diamond);
  }
}

function ensureMarkers(svg: SVGSVGElement) {
  let defs = svg.querySelector('defs');
  if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svg.appendChild(defs); }
}

/* Lazy per-type marker — arrow color matches the edge's per-type color
   (which may differ from the category color via TYPE_COLOR_OVERRIDE). */
function ensureTypeMarker(svg: SVGSVGElement, typeId: string, color: string): string {
  const safeId = typeId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const markerId = `rel-arrow-t-${safeId}`;
  if (svg.querySelector(`#${markerId}`)) return markerId;
  let defs = svg.querySelector('defs');
  if (!defs) { defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs'); svg.appendChild(defs); }
  const m = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
  m.setAttribute('id', markerId);
  m.setAttribute('viewBox', '0 0 8 8'); m.setAttribute('refX', '6'); m.setAttribute('refY', '4');
  m.setAttribute('markerWidth', '5'); m.setAttribute('markerHeight', '5'); m.setAttribute('orient', 'auto');
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', 'M 0 0 L 6 4 L 0 8 z'); p.setAttribute('fill', color);
  m.appendChild(p); defs.appendChild(m);
  return markerId;
}

/* ── Render DOM nodes ───────────────────────────────────── */
function renderDOM() {
  const layer = nodesLayerRef.value; if (!layer) return;
  layer.innerHTML = '';
  nodeEls.clear();
  const c = canvasRef.value;
  const cx = c ? c.clientWidth / 2 : 0;
  const cy = c ? c.clientHeight * 0.46 : 0;

  for (const n of nodes) {
    /* Skip muted-register nodes (except focus) */
    if (n.depth !== 0 && mutedRegisters.value.has(n.register)) continue;

    const dsColor = getColor(n.register) || '#888';
    const el = document.createElement('div');
    el.className = `sp-node d-${n.depth}${n.depth === 0 ? ' focus' : ''}`;
    el.dataset.register = n.register;
    el.dataset.id = n.id;
    /* Initial position inline */
    const p = project({x: n.x, y: n.y, z: n.z});
    const ds = (n.depth === 0 || n.depth === 1) ? 0.95 : n.depth === 2 ? 0.78 : 0.62;
    el.style.transform = `translate3d(${p.x + cx}px,${p.y + cy}px,0) translate(-50%,-50%) scale(${ds})`;
    el.style.opacity = n.depth === 0 ? '1' : '0.92';
    el.style.zIndex = String(Math.round(p.z * 10 + (n.depth === 0 ? 20 : 5)));

    /* Per-dataset color treatment — bold top bar (4px) + subtle bg tint.
       The top bar gives instant dataset identification at any angle; the
       tinted background ties same-dataset cards together visually. */
    el.style.setProperty('--ds-color', dsColor);
    el.style.borderTop = `4px solid ${dsColor}`;
    el.style.background = `linear-gradient(180deg, color-mix(in srgb, ${dsColor} 10%, var(--surface)) 0%, var(--surface) 30%)`;

    el.innerHTML = `
      <div class="sp-ref">${n.register} · ${n.conceptId}</div>
      <div class="sp-term">${n.term}</div>
      <div class="sp-meta">
        <span class="sp-badge" style="--ds-color: ${dsColor};">${n.register}</span>
        <span class="sp-rel">◈ ${links.filter(l => l.source === n.id || l.target === n.id).length}</span>
      </div>
    `;
    if (n.depth === 0) {
      const fb = document.createElement('div');
      fb.className = 'sp-focus-badge';
      fb.textContent = `◆ ${t('sphere.focus')}`;
      el.appendChild(fb);
    }

    /* Hover — bring to front, opacity 100%, amber glow. */
    el.addEventListener('mouseenter', () => {
      if (hoverTimer) clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => { hoveredNode.value = n; }, 120);
      el.classList.add('hovered');
      el.style.zIndex = '999';
      el.style.opacity = '1';
    });
    el.addEventListener('mouseleave', () => {
      if (hoverTimer) { clearTimeout(hoverTimer); hoverTimer = null; }
      hoveredNode.value = null;
      el.classList.remove('hovered');
      const pn = project({x: n.x, y: n.y, z: n.z});
      el.style.zIndex = String(Math.round(pn.z * 10 + (n.depth === 0 ? 20 : 5)));
      /* Opacity will be recomputed by onTick; nudge a default in case sim is idle */
      const baseOp = n.depth === 0 ? 1.0 : n.depth === 1 ? 0.92 : n.depth === 2 ? 0.80 : 0.68;
      const zFade = (pn.z + 1) / 2;
      el.style.opacity = Math.max(baseOp * 0.85, baseOp * (0.7 + zFade * 0.3)).toFixed(3);
    });

    /* Click → navigate (non-focus only) */
    if (n.depth !== 0) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        emit('navigate', { registerId: n.register, conceptId: n.conceptId });
      });
    }

    layer.appendChild(el);
    nodeEls.set(n.id, el);
  }
}

/* ── Reset pan/zoom — ease back to center on navigation ── */
function resetZoom() {
  if (!zoomBehavior || !canvasRef.value) return;
  /* Animate the zoom transform back to identity over 800ms,
     synced with the SLERP tween duration. */
  select(canvasRef.value)
    .transition()
    .duration(800)
    .ease((t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
    .call(zoomBehavior.transform as any, zoomIdentity);
}

/* Auto-fit — compute the bounding box of all visible cards and adjust the
   pan/zoom so they all fit in the viewport with padding. Clamped to a
   minimum scale (0.45) so very large graphs don't shrink to illegibility.
   Reserves space for the View options panel (top-right) and preview card
   (bottom-right) so cards don't slide under them. */
function autoFitZoom(opts: { immediate?: boolean; bboxScale?: number } = {}) {
  const { immediate = false, bboxScale = 1.0 } = opts;
  if (!zoomBehavior || !canvasRef.value) return;
  const c = canvasRef.value;
  const cw = c.clientWidth;
  const ch = c.clientHeight;
  if (cw === 0 || ch === 0) return;

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  let count = 0;
  for (const n of nodes) {
    if (n.depth !== 0 && mutedRegisters.value.has(n.register)) continue;
    const p = project({x: n.x, y: n.y, z: n.z});
    const halfW = 115 * p.scale;
    const halfH = 40 * p.scale;
    minX = Math.min(minX, p.x - halfW);
    maxX = Math.max(maxX, p.x + halfW);
    minY = Math.min(minY, p.y - halfH);
    maxY = Math.max(maxY, p.y + halfH);
    count++;
  }
  if (count === 0) return;

  /* Scale the bounding box around its center to predict the layout's final
     extent — used by changeExpand to zoom out BEFORE the sim has finished
     moving cards to their new spacing. */
  if (bboxScale !== 1.0) {
    const bcx = (minX + maxX) / 2;
    const bcy = (minY + maxY) / 2;
    const halfW = (maxX - minX) / 2 * bboxScale;
    const halfH = (maxY - minY) / 2 * bboxScale;
    minX = bcx - halfW; maxX = bcx + halfW;
    minY = bcy - halfH; maxY = bcy + halfH;
  }

  const cx = cw / 2;
  const cy = ch * 0.46;
  const bboxW = maxX - minX;
  const bboxH = maxY - minY;
  const bboxCx = (minX + maxX) / 2 + cx;
  const bboxCy = (minY + maxY) / 2 + cy;

  /* Asymmetric padding: reserve right side for the View options panel
     (~280px wide when collapsed or open) and bottom-right for preview. */
  const panelW = 280;
  const previewW = 304;
  const padTop = 24;
  const padBottom = 32;
  const padLeft = 32;
  const panelH = panelOpen.value ? 360 : 56;
  const padRight = Math.max(panelW, previewW) + 8;

  const usableLeft = padLeft;
  const usableRight = cw - padRight;
  const usableTop = padTop;
  const usableBottom = ch - padBottom;
  const usableCx = (usableLeft + usableRight) / 2;
  const usableCy = (usableTop + usableBottom) / 2;
  const usableW = usableRight - usableLeft;
  const usableH = usableBottom - usableTop;

  const scaleX = usableW / bboxW;
  const scaleY = usableH / bboxH;
  const scale = Math.max(0.3, Math.min(scaleX, scaleY, 1.0));

  const tx = usableCx - scale * bboxCx;
  const ty = usableCy - scale * bboxCy;

  if (immediate) {
    select(c).call(zoomBehavior.transform as any, zoomIdentity.translate(tx, ty).scale(scale));
  } else {
    select(c)
      .transition()
      .duration(700)
      .ease((t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)
      .call(zoomBehavior.transform as any, zoomIdentity.translate(tx, ty).scale(scale));
  }
}

/* ── Navigation tween ───────────────────────────────────── */
function navigate(newConceptId: string, newRegisterId: string) {
  /* Snapshot current positions */
  navStart = {};
  navOldDepths = {};
  for (const n of nodes) {
    navStart[n.id] = {x: n.x, y: n.y, z: n.z};
    navOldDepths[n.id] = n.depth;
  }
  /* Build new graph — uses updated props (concept/edges change via watch) */
  buildGraph();
  navEnd = {};
  for (const n of nodes) {
    navEnd[n.id] = {x: n.x, y: n.y, z: n.z};
  }
  /* Reset to start positions */
  for (const n of nodes) {
    const s = navStart[n.id];
    if (s) { n.x = s.x; n.y = s.y; n.z = s.z; }
    n.vx = 0; n.vy = 0; n.vz = 0;
  }
  navStartTime = performance.now();
  navDuration = 2200;  /* concept navigation: long for the cinematic feel */
  navActive = true;
  renderDOM();
  setupSim();
}

/* ── Watch concept change ───────────────────────────────── */
/* When props.concept changes (via store.viewConcept from sphere click,
   or external navigation), animate the transition with a SLERP tween. */
let lastConceptKey = '';

/* UI language change → sync sphere language (unless user has explicitly
   chosen a different one via the Language selector). We track that with
   `userOverrodeLang`. */
let userOverrodeLang = false;
watch(locale, (newLang) => {
  if (userOverrodeLang) return;
  if (!newLang || newLang === sphereLang.value) return;
  sphereLang.value = newLang;
  rebuildForLangChange();
});

/* User picks a language in the View options panel */
function changeSphereLang(l: string) {
  if (l === sphereLang.value) return;
  userOverrodeLang = true;
  sphereLang.value = l;
  rebuildForLangChange();
}

/* Re-render cards with the new language's designations + definitions. */
async function rebuildForLangChange() {
  /* Reset focus node's term in-place */
  const lang = sphereLang.value;
  const focus = nodes.find(n => n.depth === 0);
  if (focus) {
    const langs = props.concept?.languages ?? [];
    const lc =
      props.concept?.localization?.(lang) ??
      props.concept?.localization?.('eng') ??
      (langs.length > 0 ? props.concept?.localization?.(langs[0]) : undefined);
    focus.term = getPreferredTerm(lc ?? null, focus.id);
    if (lc?.primaryDefinition) focus.definition = lc.primaryDefinition;
  }
  renderDOM();
  await loadNeighborTerms();
}

watch(() => [props.concept?.id, props.registerId] as const, ([newId, newReg]) => {
  if (!newId) return;
  const key = `${newReg}/${newId}`;
  if (key === lastConceptKey) return;
  const wasFirst = !lastConceptKey;
  lastConceptKey = key;

  if (wasFirst) {
    /* Initial load — fresh placement, no tween */
    buildGraph();
    nextTick(() => {
      renderDOM();
      /* Snap the viewport to a good fit BEFORE the sim starts, so cards
         are correctly framed from first paint and don't slide under the
         View options panel. */
      autoFitZoom({ immediate: true });
      setupSim();
      const c = canvasRef.value;
      if (c) drawEdges(c.clientWidth / 2, c.clientHeight * 0.46);
      loadNeighborTerms();
    });
  } else {
    /* Concept changed — SLERP tween from old positions to new.
       Snap to fit immediately so the new card appears centered in the
       usable region (left of the View options panel), not in the
       geometric middle where it'd be obscured. */
    navStart = {};
    navOldDepths = {};
    for (const n of nodes) {
      navStart[n.id] = { x: n.x, y: n.y, z: n.z };
      navOldDepths[n.id] = n.depth;
    }
    buildGraph();
    navEnd = {};
    for (const n of nodes) {
      navEnd[n.id] = { x: n.x, y: n.y, z: n.z };
    }
    for (const n of nodes) {
      const s = navStart[n.id];
      if (s) { n.x = s.x; n.y = s.y; n.z = s.z; }
      n.vx = 0; n.vy = 0; n.vz = 0;
    }
    navStartTime = performance.now();
    navDuration = 2200;
    navActive = true;
    renderDOM();
    autoFitZoom({ immediate: true });
    setupSim();
    loadNeighborTerms();
  }
});

/* ── Legend — grouped by relation TYPE (not category) ───── */
const legendItems = computed(() => {
  graphVersion.value;  /* reactive dependency */
  const typeMap = new Map<string, { type: string; label: string; color: string; count: number }>();
  for (const link of links) {
    /* Per-type color (with override) so e.g. 'see' and 'references' differ */
    const color = colorForTypeRaw(link.type || 'unknown', uiStore.isDark);
    const key = link.type || 'unknown';
    if (!typeMap.has(key)) {
      /* Translated label for display; raw type kept for mute/unmute keying */
      const label = relationTypeLabel(key);
      typeMap.set(key, { type: key, label, color, count: 0 });
    }
    typeMap.get(key)!.count++;
  }
  return Array.from(typeMap.values()).sort((a, b) => b.count - a.count);
});

/* ── Datasets present in the current graph ──────────────── */
const datasetItems = computed(() => {
  graphVersion.value;
  const map = new Map<string, { register: string; color: string; count: number }>();
  for (const n of nodes) {
    if (n.depth === 0) continue;
    if (!map.has(n.register)) {
      map.set(n.register, { register: n.register, color: getColor(n.register) || '#888', count: 0 });
    }
    map.get(n.register)!.count++;
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
});

function toggleRegister(reg: string) {
  const n = new Set(mutedRegisters.value);
  if (n.has(reg)) n.delete(reg); else n.add(reg);
  mutedRegisters.value = n;
  renderDOM();
  const c = canvasRef.value;
  if (c) drawEdges(c.clientWidth / 2, c.clientHeight * 0.46);
}

async function changeDegree(d: 1 | 2 | 3) {
  if (degree.value === d) return;
  degree.value = d;

  /* For deeper BFS we need every neighbor dataset's edges loaded into
     store.graph — by default only the active dataset's edges are loaded
     (via ensureEdgesForDataset in viewConcept). Load the rest in parallel. */
  if (d > 1) {
    const neighborRegisters = new Set<string>();
    for (const n of nodes) {
      if (n.depth !== 0 && n.register) neighborRegisters.add(n.register);
    }
    await Promise.allSettled(
      [...neighborRegisters].map(reg => store.ensureEdgesForDataset(reg))
    );
  }

  /* Full re-place — don't preserve positions. Going from 1° to 2° needs
     the layout to visibly EXPAND: depth-1 nodes move outward to make room
     for the new depth-2 ring. Preserving positions would cram everything
     into the old 1° footprint. */
  buildGraph();
  renderDOM();
  /* Snap to fit immediately so the new bigger graph is framed correctly
     before the sim starts expending ticks on a cramped layout. */
  autoFitZoom({ immediate: true });
  setupSim();
  loadNeighborTerms();
}

/* Manual redraw — reshuffles initial positions (with fresh jitter from
   Date.now()) and restarts the simulation. Useful when the user wants a
   different layout, e.g. after muting/unmuting several cards. */
function redraw() {
  const counters: Record<number, number> = {};
  const totals: Record<number, number> = {};
  for (const n of nodes) totals[n.depth] = (totals[n.depth] ?? 0) + 1;
  const entropy = Date.now();
  for (const n of nodes) {
    if (n.depth === 0) {
      n.x = 0; n.y = 0; n.z = 1;
    } else {
      const idx = counters[n.depth] ?? 0;
      counters[n.depth] = idx + 1;
      const pos = fibonacciSpherePosition(n.depth, idx, totals[n.depth], hashSeed(n.id) + entropy);
      n.x = pos.x; n.y = pos.y; n.z = pos.z;
    }
    n.vx = 0; n.vy = 0; n.vz = 0;
  }
  renderDOM();
  autoFitZoom({ immediate: true });
  setupSim();
}

/* Expand level — controls how far apart cards sit on the sphere. Higher
   levels increase the repulsion's minDist + strength so cards push each
   other further away. Cheap to apply: just mutates the closure variables
   the repulsion force reads each tick, then nudges alpha to reheat the
   simulation. Auto-fit fires after the sim settles to reframe. */
function changeExpand(v: number) {
  const prev = expandValue.value;
  if (prev === v) return;
  expandValue.value = v;
  const params = expandParams(v);
  linkDistance = params.linkDist;
  linkStrength = params.linkStrength;
  repulseMinDist = params.repMin;
  repulseStrength = params.repStrength;

  /* Compute new target positions by scaling each non-focus node's angle
     from the focus. slider 0 → angles shrink (cluster near focus);
     slider 10 → angles grow (spread to back hemisphere). Then SLERP-tween
     from current positions to targets so the user sees the spread happen
     immediately — the link force alone is too weak to overcome the
     sphereConstraint's tangent projection for large displacements. */
  const t = v / 10;
  const thetaScale = 0.4 + t * 1.4;  /* 0.4 at slider 0, 1.8 at slider 10 */
  const newEnd: Record<string, Vec3> = {};
  navStart = {};
  for (const n of nodes) {
    navStart[n.id] = { x: n.x, y: n.y, z: n.z };
    if (n.depth === 0) {
      newEnd[n.id] = { x: 0, y: 0, z: 1 };
      continue;
    }
    /* Current theta from focus (focus is at (0,0,1), so cos(theta) = z) */
    const z = Math.max(-1, Math.min(1, n.z));
    const currentTheta = Math.acos(z);
    const newTheta = Math.max(0.05, currentTheta * thetaScale);
    const phi = Math.atan2(n.y, n.x);
    newEnd[n.id] = {
      x: Math.sin(newTheta) * Math.cos(phi),
      y: Math.sin(newTheta) * Math.sin(phi),
      z: Math.cos(newTheta),
    };
  }
  navEnd = newEnd;
  navStartTime = performance.now();
  navDuration = 900;  /* snappier than concept navigation */
  navActive = true;
  const prevParams = expandParams(prev);
  const ratio = params.linkDist / prevParams.linkDist;
  autoFitZoom({ bboxScale: ratio });

  if (sim) sim.alpha(1).restart();
}

function toggleType(type: string) {
  /* Mute individual types — 'see' and 'references' can be toggled
     independently even though they share the 'associative' category. */
  const n = new Set(mutedTypes.value);
  if (n.has(type)) n.delete(type); else n.add(type);
  mutedTypes.value = n;
  const c = canvasRef.value;
  if (c) drawEdges(c.clientWidth / 2, c.clientHeight * 0.46);
}

function isTypeMuted(type: string): boolean {
  return mutedTypes.value.has(type);
}

/* ── Preview ────────────────────────────────────────────── */
/* Preview card — term + definition (refreshes when previewVersion bumps
   so async-loaded definitions appear without re-hovering). */
const previewRef = computed(() => {
  previewVersion.value;
  return hoveredNode.value ? `${hoveredNode.value.register} · ${hoveredNode.value.conceptId}` : '';
});
const previewTerm = computed(() => {
  previewVersion.value;
  return hoveredNode.value?.term ?? '';
});
/* Resolve glossarist cross-ref markup ({{id, display}}, <<ref,title>>,
   {urn:...}, etc.) to plain text for the preview card. We use the same
   renderContent machinery as ConceptDetail but with plain-text resolvers
   (no anchor tags) since the preview is transient and not navigable.
   Stripping remaining HTML tags (from bib formatting etc.) keeps the
   display clean. */
function previewDefinitionText(text: string | undefined): string {
  if (!text) return '';
  const html = renderContent(text, {
    xrefResolver: (_uri: string, term: string) => term,
    conceptRefResolver: (_id: string, term: string) => term,
  });
  return html
    .replace(/<[^>]+>/g, '')           /* strip HTML tags */
    .replace(/\s+/g, ' ')              /* collapse whitespace */
    .trim();
}

const previewDefinition = computed(() => {
  previewVersion.value;
  return previewDefinitionText(hoveredNode.value?.definition);
});

/* Languages available across loaded concepts — for the Language selector */
const langOptions = computed(() => {
  const langs = new Set(availableLangs.value);
  /* Always include eng + the active UI language as fallbacks */
  langs.add('eng');
  langs.add(locale.value || 'eng');
  return [...langs].sort();
});

/* ── Resize ─────────────────────────────────────────────── */
function onResize() {
  const c = canvasRef.value; if (!c) return;
  drawEdges(c.clientWidth / 2, c.clientHeight * 0.46);
}

/* ── Lifecycle ──────────────────────────────────────────── */
async function waitForCanvas(): Promise<void> {
  const start = performance.now();
  while (performance.now() - start < 2000) {
    const c = canvasRef.value;
    if (c && c.clientWidth > 0 && c.clientHeight > 0) return;
    await new Promise(r => requestAnimationFrame(() => r(null)));
  }
}

onMounted(async () => {
  window.addEventListener('resize', onResize);
  lastConceptKey = `${props.registerId}/${props.concept?.id || ''}`;
  await waitForCanvas();

  /* Setup pan/zoom via d3-zoom on the canvas.
     The zoom transform is applied as CSS transform on the viewport wrapper.
     Node drag handlers call stopPropagation so panning only starts on empty space. */
  if (canvasRef.value && viewportRef.value) {
    zoomBehavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event: any) => {
        if (viewportRef.value) {
          const t = event.transform;
          viewportRef.value.style.transform = `translate(${t.x}px, ${t.y}px) scale(${t.k})`;
        }
      });
    select(canvasRef.value).call(zoomBehavior as any);
  }

  buildGraph();
  await nextTick();
  renderDOM();
  autoFitZoom({ immediate: true });
  setupSim();
  const c = canvasRef.value;
  if (c) drawEdges(c.clientWidth / 2, c.clientHeight * 0.46);
  loadNeighborTerms();
  await nextTick();
  isFirstRender = false;
});

onBeforeUnmount(() => {
  if (sim) sim.stop();
  if (hoverTimer) clearTimeout(hoverTimer);
  nodeEls.clear();
  window.removeEventListener('resize', onResize);
});

/* Expose navigate for parent to call on internal navigation */
defineExpose({ navigate });
</script>

<template>
  <div class="rel-sphere" :class="{ dark: uiStore.isDark }">
    <div class="sp-canvas" ref="canvasRef">
      <div class="sp-viewport" ref="viewportRef">
        <svg ref="edgesSvgRef" class="sp-edges"></svg>
        <div ref="nodesLayerRef" class="sp-nodes"></div>
      </div>
    </div>

    <!-- View options panel — top-right, collapsible. Houses degree selector,
         dataset filter, and relation-type legend in one unified control. -->
    <div class="sp-panel sp-panel-top-right" :class="{ collapsed: !panelOpen }">
      <button class="sp-panel-head" @click="panelOpen = !panelOpen">
        <span class="sp-panel-title">{{ t('sphere.viewOptions') }}</span>
        <span class="sp-panel-count">{{ nodes.length - 1 }}</span>
        <span class="sp-panel-chevron">{{ panelOpen ? '▾' : '▸' }}</span>
      </button>

      <div v-show="panelOpen" class="sp-panel-body">
        <!-- Degree selector -->
        <div class="sp-section">
          <div class="sp-section-label">{{ t('sphere.degree') }}</div>
          <div class="sp-degree-seg">
            <button v-for="d in ([1, 2, 3] as const)" :key="d"
              :class="['sp-degree-btn', { active: degree === d }]"
              @click="changeDegree(d)">
              {{ d }}°
            </button>
          </div>
        </div>

        <!-- Language selector -->
        <div v-if="langOptions.length > 1" class="sp-section">
          <div class="sp-section-label">{{ t('sphere.language') }}</div>
          <div class="sp-lang-seg">
            <button v-for="l in langOptions" :key="l"
              :class="['sp-lang-btn', { active: sphereLang === l }]"
              @click="changeSphereLang(l)">
              {{ l }}
            </button>
          </div>
        </div>

        <!-- Datasets filter -->
        <div v-if="datasetItems.length" class="sp-section">
          <div class="sp-section-label">{{ t('sphere.datasets') }}</div>
          <div class="sp-chips">
            <button v-for="ds in datasetItems" :key="ds.register"
              class="sp-chip"
              :class="{ muted: mutedRegisters.has(ds.register) }"
              :style="{ '--chip-color': ds.color }"
              @click="toggleRegister(ds.register)">
              <span class="sp-chip-dot"></span>
              <span class="sp-chip-label">{{ ds.register }}</span>
              <span class="sp-chip-count">{{ ds.count }}</span>
            </button>
          </div>
        </div>

        <!-- Type legend -->
        <div v-if="legendItems.length" class="sp-section">
          <div class="sp-section-label">{{ t('sphere.relationTypes') }}</div>
          <div class="sp-legend-grid">
            <button v-for="item in legendItems" :key="item.type" class="sp-legend-item"
              :class="{ muted: isTypeMuted(item.type) }" @click="toggleType(item.type)"
              :title="item.type">
              <span class="sp-swatch" :style="{ background: isTypeMuted(item.type) ? '#b8b9cc' : item.color }"></span>
              <span>{{ item.label }}</span>
              <span class="sp-count">{{ item.count }}</span>
            </button>
          </div>
        </div>

        <!-- Expand — continuous slider 0 (tight) to 10 (loose) -->
        <div class="sp-section">
          <div class="sp-section-label">
            <span>{{ t('sphere.expand') }}</span>
            <span class="sp-slider-val">{{ expandValue.toFixed(1) }}</span>
          </div>
          <input
            type="range" min="0" max="10" step="0.5"
            :value="expandValue"
            @input="changeExpand(parseFloat(($event.target as HTMLInputElement).value))"
            class="sp-slider"
          />
          <div class="sp-slider-labels"><span>{{ t('sphere.tight') }}</span><span>{{ t('sphere.loose') }}</span></div>

          <button class="sp-redraw" @click="redraw" title="Reshuffle the layout">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v6h6M20 20v-6h-6M4 10a8 8 0 0114-5M20 14a8 8 0 01-14 5"/>
            </svg>
            <span>{{ t('sphere.redraw') }}</span>
          </button>
        </div>
      </div>
    </div>

    <Transition name="sp-preview">
      <div v-if="hoveredNode" class="sp-preview">
        <div class="sp-pv-ref">{{ previewRef }}</div>
        <div class="sp-pv-term">{{ previewTerm }}</div>
        <div v-if="previewDefinition" class="sp-pv-def">{{ previewDefinition }}</div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
.rel-sphere {
  position: relative; flex: 1; min-height: 0; width: 100%;
  background: #faf9f6; overflow: hidden;
  --ink: #1a1b2e; --ink-mute: #636588; --surface: #fff; --rule: rgba(26,27,46,0.08); --blue: #2563eb;
  /* Hover accent — warm amber. Deliberately distinct from the blue focus ring
     and from any dataset color (all are cool/blue-gray tones). */
  --hover-glow: #f59e0b;
  --hover-glow-soft: rgba(245, 158, 11, 0.18);
}
.rel-sphere.dark { background: #0f1020; --ink: #f0f0f4; --ink-mute: #8d8faa; --surface: #1c1e32; --rule: rgba(255,255,255,0.08); --blue: #60a5fa; --hover-glow: #fbbf24; --hover-glow-soft: rgba(251, 191, 36, 0.22); }

.sp-canvas { position: absolute; inset: 0; overflow: hidden; cursor: grab; }
.sp-canvas:active { cursor: grabbing; }
.sp-viewport { position: absolute; inset: 0; transform-origin: 0 0; will-change: transform; }
.sp-edges { position: absolute; inset: 0; pointer-events: none; z-index: 2; }
.sp-nodes { position: absolute; inset: 0; z-index: 4; }

:deep(.sp-node) {
  position: absolute; background: var(--surface); border: 1px solid var(--rule);
  border-radius: 6px; padding: 10px 13px; width: 220px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 2px 6px rgba(0,0,0,0.04);
  transition: box-shadow 0.15s, border-color 0.15s, transform 0.18s ease-out; will-change: transform;
}
:deep(.sp-node:hover), :deep(.sp-node.hovered) {
  /* Amber glow — multi-layer shadow for a "pulled forward" feel.
     Outer ring is the accent at low alpha; inner ring is tighter, stronger.
     Border picks up the same hue so the card outline reads as "active". */
  box-shadow:
    0 0 0 3px var(--hover-glow-soft),
    0 8px 28px rgba(245, 158, 11, 0.35),
    0 2px 8px rgba(0,0,0,0.12);
  border-color: var(--hover-glow);
}
:deep(.sp-node.d-1) { /* left border set inline per dataset color */ }
:deep(.sp-ref) { font-family: 'JetBrains Mono', monospace; font-size: 9px; color: var(--ink-mute); margin-bottom: 4px; text-transform: uppercase; font-weight: 500; letter-spacing: 0.02em; }
:deep(.sp-term) { font-family: 'Fraunces', Georgia, serif; font-size: 14px; line-height: 1.2; color: var(--ink); margin-bottom: 6px; font-weight: 500; }
:deep(.sp-meta) { display: flex; gap: 5px; align-items: center; font-size: 9px; font-family: 'JetBrains Mono', monospace; color: var(--ink-mute); text-transform: uppercase; }
:deep(.sp-badge) {
  padding: 2px 6px; border-radius: 2px; letter-spacing: 0.06em;
  /* Dataset color is passed via --ds-color inline. Mix it for readable
     text/background/border in light mode. */
  color: var(--ds-color, var(--ink));
  background: color-mix(in srgb, var(--ds-color, var(--ink)) 14%, transparent);
  border: 1px solid color-mix(in srgb, var(--ds-color, var(--ink)) 28%, transparent);
}
/* Dark mode — lighten the text (mix with white) and strengthen the
   background tint so the dataset hue is still visible against #1c1e32. */
.rel-sphere.dark :deep(.sp-badge) {
  color: color-mix(in srgb, var(--ds-color, var(--ink)) 72%, white);
  background: color-mix(in srgb, var(--ds-color, var(--ink)) 26%, transparent);
  border: 1px solid color-mix(in srgb, var(--ds-color, var(--ink)) 50%, transparent);
}
:deep(.sp-rel) { margin-left: auto; }
:deep(.sp-node.focus) {
  z-index: 20; cursor: default;
  outline: 2px solid var(--blue);
  outline-offset: 3px;
  box-shadow: 0 0 12px 4px rgba(37,99,235,0.25), 0 0 24px 8px rgba(37,99,235,0.12);
}
:deep(.sp-focus-badge) {
  position: absolute; top: -10px; right: 12px; font-size: 9px; color: white;
  background: var(--blue); padding: 3px 8px; font-weight: 700; letter-spacing: 0.18em;
  border-radius: 2px; font-family: 'DM Sans', sans-serif;
}

/* ── Degree selector (inline in panel) ───────────────────── */
.sp-degree-seg {
  display: inline-flex; gap: 2px; padding: 2px; background: var(--rule);
  border-radius: 4px; width: fit-content;
}
.sp-degree-btn {
  border: none; background: transparent; cursor: pointer;
  padding: 3px 9px; font-size: 11px; font-family: 'JetBrains Mono', monospace;
  color: var(--ink-mute); border-radius: 3px; transition: all 0.15s;
  font-weight: 600;
}
.sp-degree-btn:hover { color: var(--ink); }
.sp-degree-btn.active {
  background: var(--surface); color: var(--blue);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

/* Language selector — same shape as Degree, slightly narrower buttons */
.sp-lang-seg {
  display: inline-flex; gap: 2px; padding: 2px; background: var(--rule);
  border-radius: 4px; width: fit-content; flex-wrap: wrap;
}
.sp-lang-btn {
  border: none; background: transparent; cursor: pointer;
  padding: 3px 8px; font-size: 10px; font-family: 'JetBrains Mono', monospace;
  color: var(--ink-mute); border-radius: 3px; transition: all 0.15s;
  font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
}
.sp-lang-btn:hover { color: var(--ink); }
.sp-lang-btn.active {
  background: var(--surface); color: var(--blue);
  box-shadow: 0 1px 2px rgba(0,0,0,0.1);
}

/* ── Collapsible View options panel ──────────────────────── */
.sp-panel {
  position: absolute; z-index: 30;
  background: var(--surface); border: 1px solid var(--rule); border-radius: 6px;
  width: 250px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.05), 0 8px 24px rgba(0,0,0,0.08);
  overflow: hidden;
}
/* Top-right placement — clears the canvas drag area below */
.sp-panel.sp-panel-top-right { top: 20px; right: 20px; }
.sp-panel-head {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 10px 14px; border: none; background: transparent; cursor: pointer;
  font-family: inherit; text-align: left;
  border-bottom: 1px solid var(--rule);
}
.sp-panel.collapsed .sp-panel-head { border-bottom: none; }
.sp-panel-title {
  font-family: 'DM Serif Display', serif; font-size: 13px; color: var(--ink);
  flex: 1;
}
.sp-panel-count {
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  background: var(--rule); color: var(--ink-mute);
  padding: 2px 7px; border-radius: 10px; font-weight: 600;
}
.sp-panel-chevron { color: var(--ink-mute); font-size: 11px; }
.sp-panel-body { padding: 8px 12px 12px; }
.sp-section { margin-top: 6px; }
.sp-section-label {
  font-family: 'JetBrains Mono', monospace; font-size: 9px;
  color: var(--ink-mute); text-transform: uppercase; letter-spacing: 0.08em;
  margin-bottom: 6px; font-weight: 600;
}

/* Expand slider — continuous 0–10 range */
.sp-slider {
  width: 100%; height: 4px; appearance: none; -webkit-appearance: none;
  background: var(--rule); border-radius: 2px; outline: none; cursor: pointer;
  margin: 6px 0 2px;
}
.sp-slider::-webkit-slider-thumb {
  -webkit-appearance: none; appearance: none;
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--blue); border: 2px solid var(--surface);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2); cursor: grab;
}
.sp-slider::-webkit-slider-thumb:active { cursor: grabbing; }
.sp-slider::-moz-range-thumb {
  width: 14px; height: 14px; border-radius: 50%;
  background: var(--blue); border: 2px solid var(--surface);
  box-shadow: 0 1px 3px rgba(0,0,0,0.2); cursor: grab;
}
.sp-slider-val {
  float: right; font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: var(--blue); font-weight: 600;
}
.sp-slider-labels {
  display: flex; justify-content: space-between;
  font-family: 'JetBrains Mono', monospace; font-size: 8px;
  color: var(--ink-mute); text-transform: uppercase; letter-spacing: 0.06em;
  margin-bottom: 6px;
}
.sp-redraw {
  display: flex; align-items: center; justify-content: center; gap: 6px;
  width: 100%; padding: 5px 8px;
  border: 1px solid var(--rule); background: transparent;
  color: var(--ink); font-family: inherit; font-size: 11px; font-weight: 500;
  border-radius: 4px; cursor: pointer; transition: all 0.15s;
}
.sp-redraw:hover {
  background: var(--rule); border-color: var(--blue); color: var(--blue);
}

/* Dataset chips */
.sp-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.sp-chip {
  display: inline-flex; align-items: center; gap: 5px;
  padding: 3px 8px 3px 6px; border-radius: 3px; cursor: pointer;
  border: 1px solid var(--rule); background: transparent;
  font-family: 'JetBrains Mono', monospace; font-size: 10px;
  color: var(--ink); font-weight: 500;
  transition: all 0.15s;
}
.sp-chip:hover { background: var(--rule); }
.sp-chip.muted { opacity: 0.4; }
.sp-chip-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: var(--chip-color, var(--blue));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--chip-color, var(--blue)) 20%, transparent);
}
.sp-chip.muted .sp-chip-dot { background: var(--ink-mute); box-shadow: none; }
.sp-chip-label { letter-spacing: 0.02em; }
.sp-chip-count {
  font-size: 9px; color: var(--ink-mute);
  background: var(--rule); padding: 1px 4px; border-radius: 2px;
}

/* Type legend */
.sp-legend-grid { display: flex; flex-direction: column; gap: 2px; }
.sp-legend-item {
  display: flex; align-items: center; gap: 8px; padding: 3px 6px; border-radius: 3px;
  cursor: pointer; border: 1px solid transparent; background: transparent; text-align: left;
  width: 100%; font-family: inherit; font-size: 11px; color: var(--ink-mute);
}
.sp-legend-item:hover { background: var(--rule); }
.sp-legend-item.muted { opacity: 0.35; }
.sp-swatch { width: 18px; height: 2px; flex-shrink: 0; border-radius: 1px; }
.sp-count { margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 10px; }

.sp-preview {
  position: absolute; bottom: 24px; right: 24px; z-index: 40;
  background: var(--surface); border: 1px solid var(--rule); border-radius: 6px;
  padding: 12px 16px; width: 280px; pointer-events: none;
  box-shadow: 0 12px 32px rgba(0,0,0,0.1);
}
.sp-pv-ref { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--ink-mute); text-transform: uppercase; }
.sp-pv-term { font-family: 'DM Serif Display', serif; font-size: 18px; color: var(--ink); margin-top: 4px; }
.sp-pv-def {
  font-family: 'Source Sans 3', system-ui, sans-serif; font-size: 12px;
  line-height: 1.45; color: var(--ink-mute); margin-top: 8px;
  /* Clamp to 4 lines so very long definitions don't blow out the panel */
  display: -webkit-box; -webkit-line-clamp: 4; -webkit-box-orient: vertical;
  overflow: hidden;
}
.sp-preview-enter-active, .sp-preview-leave-active { transition: all 0.25s; }
.sp-preview-enter-from, .sp-preview-leave-to { opacity: 0; transform: translateY(8px); }
</style>
