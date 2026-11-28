// scripts/lib/concept-uri.ts
function buildConceptUri(uriBase, registerId, conceptId) {
  return `${uriBase}/dataset/${registerId}/concept/${conceptId}`;
}

// scripts/extract-source-refs.js
function extractSourceRefs(concept, registerId) {
  const refs = /* @__PURE__ */ new Set();
  for (const src of concept["gl:source"] || []) {
    const origin = src["gl:origin"];
    if (origin) {
      const ref = origin["gl:ref"];
      if (ref?.["gl:source"]) refs.add(ref["gl:source"]);
    }
  }
  for (const lc of Object.values(concept["gl:localizedConcept"] || {})) {
    for (const src of lc["gl:source"] || []) {
      const origin = src["gl:origin"];
      if (origin) {
        const ref = origin["gl:ref"];
        if (ref?.["gl:source"]) refs.add(ref["gl:source"]);
      }
    }
  }
  return [...refs].map((source) => ({ source, registerId }));
}

// scripts/build-edges.ts
import { readFileSync, writeFileSync, readdirSync, existsSync, realpathSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// src/utils/slugify.ts
var KEEP = /[^\p{L}\p{N}\p{M}_\s-]/gu;
var HAS_WORD = /[\p{L}\p{N}]/u;
function shortHash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
function slugify(text) {
  if (text === "") return "";
  const folded = text.normalize("NFKC").toLowerCase();
  const slug = folded.replace(KEEP, "").replace(/[\s/]+/g, "-");
  return HAS_WORD.test(slug) ? slug : `x-${shortHash(folded.trim())}`;
}

// src/adapters/UriRouter.ts
function matchUriPattern(uri, pattern) {
  if (!pattern.endsWith("*")) return uri === pattern;
  return uri.startsWith(pattern.slice(0, -1));
}
function extractConceptId(uri, pattern) {
  if (!pattern.endsWith("*")) return null;
  const base = pattern.slice(0, -1);
  if (!uri.startsWith(base)) return null;
  const remainder = uri.slice(base.length);
  if (uri.startsWith("https://") || uri.startsWith("http://")) {
    const match = remainder.match(/^\/?concept\/([^/?#]+)/);
    return match ? match[1] : null;
  }
  if (uri.startsWith("urn:")) {
    return remainder || null;
  }
  return null;
}
var URI_REGISTER_RE = /\/([^/]+)\/concept\/([^/]+)$/;
var UriRouter = class _UriRouter {
  /** registerId → { baseUrl, uriBase, uriPatterns } */
  registerMap = /* @__PURE__ */ new Map();
  /** URN prefix → registerId (extracted from uriPatterns at registration time) */
  urnMap = /* @__PURE__ */ new Map();
  /**
   * Register a dataset's URI patterns for routing.
   * URN-prefixed patterns are also indexed for fast URN → registerId lookup.
   */
  registerDataset(registerId, baseUrl, uriBase, uriPatterns) {
    this.registerMap.set(registerId, { baseUrl, uriBase, uriPatterns });
    for (const pattern of uriPatterns) {
      const base = pattern.endsWith("*") ? pattern.slice(0, -1) : pattern;
      if (base.startsWith("urn:")) {
        const clean = base.endsWith(":") ? base.slice(0, -1) : base;
        this.urnMap.set(clean, registerId);
      }
    }
  }
  /**
   * Resolve a URI to {registerId, conceptId} using registered patterns.
   * Returns null if no registered dataset matches.
   */
  resolveUri(uri) {
    for (const [registerId, info] of this.registerMap) {
      for (const pattern of info.uriPatterns) {
        if (matchUriPattern(uri, pattern)) {
          const conceptId = extractConceptId(uri, pattern);
          if (conceptId) return { registerId, conceptId };
        }
      }
    }
    return null;
  }
  /** Resolve a URN prefix to a registerId. Matches by longest prefix. Returns null if unknown. */
  resolveUrn(urn) {
    for (let len = urn.length; len > 0; len--) {
      const prefix = urn.slice(0, len);
      const match = this.urnMap.get(prefix);
      if (match) return match;
    }
    return null;
  }
  /** Get the uriBase for a register. Returns empty string if unknown. */
  getUriBase(registerId) {
    return this.registerMap.get(registerId)?.uriBase ?? "";
  }
  /** Extract registerId and conceptId from any glossarist URI (no registration needed). */
  static parseUri(uri) {
    const m = uri.match(URI_REGISTER_RE);
    return m ? { registerId: m[1], conceptId: m[2] } : null;
  }
  /** Construct a canonical concept URI from components. */
  static buildConceptUri(uriBase, registerId, conceptId) {
    return `${uriBase}/${registerId}/concept/${conceptId}`;
  }
  /** Construct a canonical domain URI from components. */
  static buildDomainUri(uriBase, registerId, domainSlug) {
    return `${uriBase}/${registerId}/domain/${domainSlug}`;
  }
  /** Construct a canonical URI for a concept from its register-id + concept-id. */
  buildUri(registerId, conceptId) {
    const info = this.registerMap.get(registerId);
    const uriBase = info?.uriBase ?? "";
    return _UriRouter.buildConceptUri(uriBase, registerId, conceptId);
  }
  getRegisteredIds() {
    return [...this.registerMap.keys()];
  }
};

// scripts/build-edges.ts
var VALID_COMPLETENESS = /* @__PURE__ */ new Set(["complete", "partial"]);
function validateCompleteness(value) {
  if (value == null) return "complete";
  if (!VALID_COMPLETENESS.has(value)) {
    throw new Error(
      `Invalid partitive relation completeness: "${value}". Allowed: complete, partial`
    );
  }
  return value;
}
var VALID_PRESENCE = /* @__PURE__ */ new Set(["required", "optional"]);
var VALID_COUNT = /* @__PURE__ */ new Set(["exactly_one", "at_least_one", "multiple"]);
var LEGACY_MULTIPLICITY_MAP = {
  compulsory: { presence: "required", count: "exactly_one" },
  optional: { presence: "optional", count: "exactly_one" },
  compulsory_multiple: { presence: "required", count: "multiple" },
  optional_multiple: { presence: "optional", count: "multiple" },
  compulsory_at_least_one: { presence: "required", count: "at_least_one" }
};
function resolvePresence(member) {
  const p = member["gl:presence"] ?? member.presence;
  if (p != null) {
    if (!VALID_PRESENCE.has(p)) throw new Error(`Invalid presence: "${p}"`);
    return p;
  }
  return migrateMultiplicity(member).presence;
}
function resolveCount(member) {
  const c = member["gl:count"] ?? member.count;
  if (c != null) {
    if (!VALID_COUNT.has(c)) throw new Error(`Invalid count: "${c}"`);
    return c;
  }
  return migrateMultiplicity(member).count;
}
function migrateMultiplicity(member) {
  const m = member["gl:multiplicity"] ?? member.multiplicity;
  if (m && LEGACY_MULTIPLICITY_MAP[m]) return LEGACY_MULTIPLICITY_MAP[m];
  const certainty = member["gl:certainty"] ?? member.certainty;
  if (certainty === "possible") return { presence: "optional", count: "exactly_one" };
  return { presence: "required", count: "exactly_one" };
}
function resolveIsDelimiting(member) {
  return member["gl:isDelimiting"] === true || member.isDelimiting === true;
}
function normalizeLocalizedString(content) {
  if (content == null) return void 0;
  if (typeof content === "string") return { default: content };
  return content;
}
var __dirname = dirname(fileURLToPath(import.meta.url));
var ROOT = process.cwd();
var DATA_DIR = join(ROOT, "public", "data");
function extractReferences(concept, registerId) {
  const edges = [];
  const sourceUri = concept["@id"];
  for (const [lang, lc] of Object.entries(concept["gl:localizedConcept"] || {})) {
    if (lc["gl:references"]) {
      for (const ref of lc["gl:references"]) {
        if (ref["@id"] && ref["@id"] !== sourceUri) {
          const edge = {
            source: sourceUri,
            target: ref["@id"],
            type: ref["@id"].startsWith("cite:") ? "citation" : "references",
            label: ref["gl:term"] || void 0,
            register: registerId,
            lang
          };
          if (ref["gl:sourceId"]) edge.sourceId = ref["gl:sourceId"];
          edges.push(edge);
        }
      }
    }
  }
  return edges;
}
function extractDomains(concept, registerId, uriBase) {
  if (!uriBase) throw new Error("build-edges: uriBase is required \u2014 set uriBase in site-config.yml");
  const base = uriBase;
  const edges = [];
  const sourceUri = concept["@id"];
  const seen = /* @__PURE__ */ new Set();
  const domains = concept["gl:domain"];
  if (Array.isArray(domains)) {
    for (const d of domains) {
      const conceptId = d["gl:conceptId"] || d.concept_id;
      if (conceptId) {
        const refType = d["gl:refType"] || d.ref_type || "domain";
        const isSection = refType === "section";
        const edgeType = isSection ? "section" : "domain";
        const domainUri = `${base}/${registerId}/domain/${conceptId}`;
        if (!seen.has(domainUri)) {
          seen.add(domainUri);
          edges.push({
            source: sourceUri,
            target: domainUri,
            type: edgeType,
            label: conceptId,
            register: registerId
          });
        }
      }
    }
  }
  const lcs = concept["gl:localizedConcept"] || {};
  const langs = Object.keys(lcs);
  for (const lang of langs) {
    const domain = lcs[lang]["gl:domain"];
    if (domain && !seen.has(domain)) {
      seen.add(domain);
      edges.push({
        source: sourceUri,
        target: `${base}/${registerId}/domain/${slugify(domain)}`,
        type: "domain",
        label: domain,
        register: registerId
      });
    }
  }
  return edges;
}
function extractRelated(concept, registerId, uriBase, urnMap) {
  const edges = [];
  const sourceUri = concept["@id"];
  for (const r of concept["gl:related"] || []) {
    if (r["gl:target"]) {
      edges.push({
        source: sourceUri,
        target: r["gl:target"],
        type: r["gl:relationshipType"] || "references",
        label: r["gl:term"] || void 0,
        register: r["gl:target"].match(/\/([^/]+)\/concept\//)?.[1] || registerId
      });
      continue;
    }
    const ref = r["gl:ref"];
    if (!ref) continue;
    const source = ref["gl:source"] || ref["source"];
    const id = ref["gl:id"] || ref["id"];
    if (!source || !id) continue;
    const reg = urnMap.get(source) || source;
    const target = buildConceptUri(uriBase, reg, id);
    if (target === sourceUri) continue;
    edges.push({
      source: sourceUri,
      target,
      type: r["gl:relationshipType"] || "references",
      label: r["gl:term"] || void 0,
      register: reg
    });
  }
  return edges;
}
function extractPartitiveRelations(concept, registerId, uriBase, urnMap) {
  const relations = [];
  const sourceUri = concept["@id"];
  for (const rel of concept["gl:partitiveRelations"] || []) {
    const compRef = rel["gl:comprehensive"];
    if (!compRef) continue;
    const comprehensive = resolveConceptUri(compRef, uriBase, urnMap);
    if (!comprehensive) continue;
    const partitives = (rel["gl:hasPartitive"] || []).map((p) => {
      const memberRef = p["gl:ref"] || p;
      const uri = resolveConceptUri(memberRef, uriBase, urnMap);
      if (!uri || uri === sourceUri) return null;
      return {
        uri,
        presence: resolvePresence(p),
        count: resolveCount(p),
        isDelimiting: resolveIsDelimiting(p)
      };
    }).filter((p) => p !== null);
    if (partitives.length === 0) continue;
    relations.push({
      source: sourceUri,
      comprehensive,
      partitives,
      completeness: validateCompleteness(rel["gl:completeness"]),
      criterion: normalizeLocalizedString(rel["gl:criterion"]),
      register: registerId
    });
  }
  return relations;
}
function resolveConceptUri(ref, uriBase, urnMap) {
  const source = ref["gl:source"] || ref["source"];
  const id = ref["gl:id"] || ref["id"];
  if (!source || !id) return null;
  const reg = urnMap.get(source) || source;
  return buildConceptUri(uriBase, reg, id);
}
function flattenPartitiveEdges(relations) {
  const edges = [];
  for (const rel of relations) {
    const comprehensive = UriRouter.parseUri(rel.comprehensive);
    if (!comprehensive) continue;
    const from = `${comprehensive.registerId}/${comprehensive.conceptId}`;
    for (const member of rel.partitives ?? []) {
      const memberUri = member.uri ?? member;
      const parsed = UriRouter.parseUri(memberUri);
      if (!parsed) continue;
      const to = `${parsed.registerId}/${parsed.conceptId}`;
      if (to === from) continue;
      edges.push([from, to, "partitive"]);
    }
  }
  return edges;
}
function buildRelationGraph(registerId, edges, labels, extraEdges = []) {
  const nodes = {};
  const seen = /* @__PURE__ */ new Set();
  const outEdges = [];
  const types = {};
  const ensureNode = (id) => {
    if (!nodes[id]) {
      const label = labels.get(id);
      nodes[id] = label ? [label[0], label[1]] : ["", ""];
    }
  };
  const addEdge = (srcId, tgtId, type) => {
    if (srcId === tgtId) return;
    const key = `${srcId}|${tgtId}|${type}`;
    if (seen.has(key)) return;
    seen.add(key);
    ensureNode(srcId);
    ensureNode(tgtId);
    outEdges.push([srcId, tgtId, type]);
    types[type] = (types[type] ?? 0) + 1;
  };
  for (const edge of edges) {
    const source = UriRouter.parseUri(edge.source);
    const target = UriRouter.parseUri(edge.target);
    if (!source || !target) continue;
    addEdge(`${source.registerId}/${source.conceptId}`, `${target.registerId}/${target.conceptId}`, edge.type);
  }
  for (const [from, to, type] of extraEdges) {
    addEdge(from, to, type);
  }
  return {
    registerId,
    nodeCount: Object.keys(nodes).length,
    edgeCount: outEdges.length,
    nodes,
    edges: outEdges,
    types
  };
}
function summarizeProjectedOut(edges) {
  const out = {};
  for (const edge of edges) {
    if (UriRouter.parseUri(edge.source) && UriRouter.parseUri(edge.target)) continue;
    const type = edge.type || "unknown";
    out[type] = (out[type] ?? 0) + 1;
  }
  return out;
}
function loadRelationLabels(datasets, dataDir) {
  const labels = /* @__PURE__ */ new Map();
  for (const ds of datasets) {
    try {
      const graphNodesPath = join(dataDir, ds, "graph-nodes.json");
      if (!existsSync(graphNodesPath)) continue;
      const parsed = JSON.parse(readFileSync(graphNodesPath, "utf-8"));
      for (const entry of parsed.nodes ?? []) {
        const [id, designations, status] = entry;
        if (typeof id !== "string" || !id) continue;
        let designation = "";
        if (designations && typeof designations === "object") {
          const values = Object.values(designations).filter((v) => typeof v === "string" && v.length > 0);
          designation = typeof designations.eng === "string" && designations.eng || values[0] || "";
        }
        labels.set(`${ds}/${id}`, [designation, typeof status === "string" ? status : ""]);
      }
    } catch {
    }
  }
  return labels;
}
var EXTRACTORS = [extractReferences, extractRelated, extractDomains];
function extractAllEdges(concept, registerId, uriBase, urnMap) {
  return EXTRACTORS.flatMap((fn) => fn(concept, registerId, uriBase, urnMap));
}
var BINARY_PARTITIVE_TYPES = /* @__PURE__ */ new Set(["has_part", "is_part_of", "broader_partitive", "narrower_partitive"]);
function warnBinaryPartitiveRedundancy(edges, relations, registerId) {
  if (!relations?.length) return;
  const partitivePairs = /* @__PURE__ */ new Set();
  for (const rel of relations) {
    for (const member of rel.partitives ?? []) {
      const memberUri = member.uri ?? member;
      partitivePairs.add(`${rel.comprehensive}|${memberUri}`);
      partitivePairs.add(`${memberUri}|${rel.comprehensive}`);
    }
  }
  const redundant = edges.filter(
    (e) => BINARY_PARTITIVE_TYPES.has(e.type) && partitivePairs.has(`${e.source}|${e.target}`)
  );
  if (redundant.length > 0) {
    console.warn(
      `  \u26A0 ${registerId}: ${redundant.length} binary has_part/is_part_of edge(s) duplicate a PartitiveRelation member \u2014 prefer the PartitiveRelation encoding (concept-model TODO item 14).`
    );
  }
}
function buildEdgesForDataset(datasetDir, registerId, uriBase, urnMap, manifest, labels = /* @__PURE__ */ new Map()) {
  const conceptsDir = join(datasetDir, "concepts");
  if (!existsSync(conceptsDir)) {
    console.log(`  Skipping ${registerId}: no concepts directory`);
    return { edges: [], sourceRefs: [] };
  }
  const files = readdirSync(conceptsDir).filter((f) => f.endsWith(".json"));
  console.log(`  Processing ${files.length} concepts...`);
  const allEdges = [];
  const allPartitiveRelations = [];
  const allSourceRefs = [];
  const domainConceptCount = /* @__PURE__ */ new Map();
  let processed = 0;
  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(conceptsDir, file), "utf-8"));
      const edges = extractAllEdges(data, registerId, uriBase, urnMap);
      const relations = extractPartitiveRelations(data, registerId, uriBase, urnMap);
      warnBinaryPartitiveRedundancy(edges, relations, registerId);
      allEdges.push(...edges);
      allPartitiveRelations.push(...relations);
      allSourceRefs.push(...extractSourceRefs(data, registerId));
      for (const edge of edges) {
        if (edge.type === "domain" || edge.type === "section") {
          domainConceptCount.set(edge.target, (domainConceptCount.get(edge.target) || 0) + 1);
        }
      }
    } catch (e) {
      console.error(`  Error processing ${file}: ${e.message}`);
    }
    processed++;
    if (processed % 5e3 === 0) {
      console.log(`  ... ${processed}/${files.length}`);
    }
  }
  const seen = /* @__PURE__ */ new Set();
  const deduped = [];
  for (const edge of allEdges) {
    const key = `${edge.source}\u2192${edge.target}\u2192${edge.type}\u2192${edge.lang || ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(edge);
    }
  }
  const output = {
    registerId,
    edgeCount: deduped.length,
    edges: deduped
  };
  const outputPath = join(datasetDir, "edges.json");
  writeFileSync(outputPath, JSON.stringify(output));
  console.log(`  Written ${deduped.length} edges to edges.json (${(JSON.stringify(output).length / 1024).toFixed(1)} KB)`);
  const relationsOutput = {
    registerId,
    relationCount: allPartitiveRelations.length,
    relations: allPartitiveRelations
  };
  const relationsPath = join(datasetDir, "partitive_relations.json");
  writeFileSync(relationsPath, JSON.stringify(relationsOutput));
  console.log(`  Written ${allPartitiveRelations.length} partitive relations to partitive_relations.json (${(JSON.stringify(relationsOutput).length / 1024).toFixed(1)} KB)`);
  const relationGraph = buildRelationGraph(registerId, deduped, labels, flattenPartitiveEdges(allPartitiveRelations));
  const graphPath = join(datasetDir, "relation-graph.json");
  const graphContent = JSON.stringify(relationGraph);
  writeFileSync(graphPath, graphContent);
  console.log(`  Written ${relationGraph.nodeCount} nodes / ${relationGraph.edgeCount} edges to relation-graph.json (${(graphContent.length / 1024).toFixed(1)} KB)`);
  if (relationGraph.edgeCount === 0 && deduped.length > 0) {
    const projectedOut = summarizeProjectedOut(deduped);
    const breakdown = Object.entries(projectedOut).map(([type, n]) => `${n} ${type}`).join(", ");
    console.log(`  All ${deduped.length} edge(s) projected out of relation-graph (${breakdown}) \u2014 the register has no concept-to-concept relations, so an empty graph is expected.`);
  }
  const manifestSections = manifest.sections;
  if (manifestSections && manifestSections.length > 0) {
    let buildSectionNode2 = function(section, idx) {
      const sectionId = `section-${section.id}`;
      const domainUri = `${uriBase2}/${registerId}/domain/${sectionId}`;
      const domainLabel = section.names?.eng || section.id;
      const node = {
        uri: domainUri,
        id: sectionId,
        names: section.names || {},
        label: domainLabel,
        registerId,
        conceptCount: domainConceptCount.get(domainUri) || 0,
        order: idx
      };
      if (section.children && section.children.length > 0) {
        node.children = section.children.map(
          (child, childIdx) => buildSectionNode2(child, childIdx)
        );
      }
      return node;
    };
    var buildSectionNode = buildSectionNode2;
    const uriBase2 = manifest.uriBase;
    if (!uriBase2) throw new Error("build-edges: manifest.uriBase is required");
    const domainNodes = manifestSections.map(
      (section, idx) => buildSectionNode2(section, idx)
    );
    const domainOutput = { registerId, domainNodes };
    const domainPath = join(datasetDir, "domain-nodes.json");
    writeFileSync(domainPath, JSON.stringify(domainOutput));
    console.log(`  Written ${domainNodes.length} section-based domain nodes to domain-nodes.json`);
  } else {
    const domainEdgeMap = /* @__PURE__ */ new Map();
    for (const edge of deduped) {
      if (edge.type === "domain") {
        const existing = domainEdgeMap.get(edge.target);
        if (existing) {
          existing.labels.add(edge.label);
        } else {
          domainEdgeMap.set(edge.target, { uri: edge.target, labels: /* @__PURE__ */ new Set([edge.label]), registerId });
        }
      }
    }
    const domainNodes = [...domainEdgeMap.values()].map((d) => ({
      uri: d.uri,
      label: [...d.labels][0],
      registerId: d.registerId,
      conceptCount: domainConceptCount.get(d.uri) || 0
    })).sort((a, b) => b.conceptCount - a.conceptCount);
    const domainOutput = { registerId, domainNodes };
    const domainPath = join(datasetDir, "domain-nodes.json");
    writeFileSync(domainPath, JSON.stringify(domainOutput));
    console.log(`  Written ${domainNodes.length} edge-derived domain nodes to domain-nodes.json`);
  }
  return { edges: deduped, sourceRefs: allSourceRefs };
}
function main() {
  console.log("Building edge indexes...\n");
  if (!existsSync(DATA_DIR)) {
    console.log("No data directory found. Nothing to do.");
    process.exit(0);
  }
  const datasets = readdirSync(DATA_DIR).filter((f) => {
    try {
      return existsSync(join(DATA_DIR, f, "manifest.json"));
    } catch {
      return false;
    }
  });
  const urnMap = /* @__PURE__ */ new Map();
  const manifestCache = /* @__PURE__ */ new Map();
  for (const ds of datasets) {
    const manifestPath = join(DATA_DIR, ds, "manifest.json");
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf-8"));
      manifestCache.set(ds, manifest);
      if (manifest.datasetUri) {
        const base = manifest.datasetUri.endsWith("*") ? manifest.datasetUri.slice(0, -1) : manifest.datasetUri;
        if (base) urnMap.set(base, ds);
      }
      for (const alias of manifest.uriAliases ?? []) {
        const base = alias.endsWith("*") ? alias.slice(0, -1) : alias;
        if (base) urnMap.set(base, ds);
      }
      if (manifest.ref) {
        urnMap.set(manifest.ref, ds);
      }
    } catch {
    }
  }
  console.log(`URI resolution map: ${[...urnMap.entries()].map(([k, v]) => `${k}\u2192${v}`).join(", ")}
`);
  const relationLabels = loadRelationLabels(datasets, DATA_DIR);
  const allDatasetEdges = /* @__PURE__ */ new Map();
  const allSourceRefs = [];
  for (const ds of datasets) {
    const manifest = manifestCache.get(ds);
    if (!manifest) continue;
    try {
      console.log(`${manifest.title} (${ds}):`);
      const uriBase = manifest.uriBase;
      if (!uriBase) throw new Error("build-edges: manifest.uriBase is required");
      const result = buildEdgesForDataset(join(DATA_DIR, ds), ds, uriBase, urnMap, manifest, relationLabels);
      allDatasetEdges.set(ds, result.edges);
      allSourceRefs.push(...result.sourceRefs);
    } catch (e) {
      console.error(`Error reading manifest for ${ds}: ${e.message}`);
    }
    console.log();
  }
  const knownSourceStrings = /* @__PURE__ */ new Set();
  for (const [ds, manifest] of manifestCache) {
    if (manifest.ref) knownSourceStrings.add(manifest.ref);
    for (const alias of manifest.refAliases ?? []) {
      knownSourceStrings.add(alias);
    }
    if (manifest.datasetUri) {
      const base = manifest.datasetUri.endsWith("*") ? manifest.datasetUri.slice(0, -1) : manifest.datasetUri;
      knownSourceStrings.add(base);
    }
    for (const alias of manifest.uriAliases ?? []) {
      const base = alias.endsWith("*") ? alias.slice(0, -1) : alias;
      knownSourceStrings.add(base);
    }
  }
  const auditUnmatched = /* @__PURE__ */ new Map();
  for (const { source, registerId } of allSourceRefs) {
    if (knownSourceStrings.has(source)) continue;
    if (source.startsWith("urn:")) continue;
    if (!auditUnmatched.has(source)) {
      auditUnmatched.set(source, registerId);
    }
  }
  if (auditUnmatched.size > 0) {
    console.warn(`
\u26A0 ${auditUnmatched.size} source string(s) in concept data have no matching dataset ref:`);
    for (const [source, fromDataset] of auditUnmatched) {
      console.warn(`  "${source}" (from ${fromDataset})`);
    }
    console.warn("Add refAliases to the target dataset manifest, or fix source strings to use URNs.\n");
  }
  const datasetUriPrefixes = /* @__PURE__ */ new Map();
  for (const [ds, manifest] of manifestCache) {
    const uriBase = manifest.uriBase;
    if (!uriBase) throw new Error("build-edges: manifest.uriBase is required");
    datasetUriPrefixes.set(ds, `${uriBase}/${ds}/`);
  }
  const crossRefIndex = {};
  for (const ds of datasets) {
    crossRefIndex[ds] = [];
  }
  for (const [sourceDs, edges] of allDatasetEdges) {
    const targets = /* @__PURE__ */ new Set();
    for (const edge of edges) {
      for (const [targetDs, prefix] of datasetUriPrefixes) {
        if (targetDs !== sourceDs && edge.target.startsWith(prefix)) {
          targets.add(targetDs);
        }
      }
      for (const [targetDs, prefix] of datasetUriPrefixes) {
        if (targetDs !== sourceDs && edge.source.startsWith(prefix)) {
          targets.add(targetDs);
        }
      }
    }
    for (const targetDs of targets) {
      if (!crossRefIndex[targetDs].includes(sourceDs)) {
        crossRefIndex[targetDs].push(sourceDs);
      }
    }
  }
  const crossRefPath = join(DATA_DIR, "cross-ref-index.json");
  writeFileSync(crossRefPath, JSON.stringify(crossRefIndex));
  const refCount = Object.values(crossRefIndex).reduce((sum, arr) => sum + arr.length, 0);
  console.log(`Written cross-ref-index.json (${refCount} cross-references across ${datasets.length} datasets)`);
  console.log("Done.");
}
var isDirectInvocation = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isDirectInvocation) {
  main();
}
export {
  buildRelationGraph,
  flattenPartitiveEdges,
  loadRelationLabels,
  main,
  summarizeProjectedOut
};
