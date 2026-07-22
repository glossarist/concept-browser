function buildConceptUri(uriBase, registerId, conceptId) {
  return `${uriBase}/${registerId}/concept/${conceptId}`;
}

const VALID_MARKERS = new Set(['double', 'dashed']);

function validateHyperedgeMarkers(markers) {
  const out = [];
  for (const m of markers) {
    if (!VALID_MARKERS.has(m)) {
      throw new Error(`Invalid partitive hyperedge marker: "${m}". Allowed: double, dashed`);
    }
    out.push(m);
  }
  return out;
}

function normalizeHyperedgeContent(content) {
  if (content == null) return undefined;
  if (typeof content === 'string') return { default: content };
  return content;
}


/**
 * Pre-computes cross-reference and domain edges for each dataset.
 * Reads all concept JSON files, extracts structured references and
 * authoritative sources (domains), and writes edges.json + domain-nodes.json.
 *
 * Usage: node scripts/build-edges.js
 */
import { extractSourceRefs } from './extract-source-refs.js';
import { readFileSync, writeFileSync, readdirSync, existsSync, realpathSync } from 'fs';
import { join, dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';
import { Register } from 'glossarist';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'public', 'data');

// --- Normalization ---

function slugify(text) {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s/]+/g, '-');
}

// --- Extractors (open/closed: add new extractors to EXTRACTORS array) ---

function extractReferences(concept, registerId) {
  const edges = [];
  const sourceUri = concept['@id'];
  for (const [lang, lc] of Object.entries(concept['gl:localizedConcept'] || {})) {
    if (lc['gl:references']) {
      for (const ref of lc['gl:references']) {
        if (ref['@id'] && ref['@id'] !== sourceUri) {
          const edge = {
            source: sourceUri,
            target: ref['@id'],
            type: ref['@id'].startsWith('cite:') ? 'citation' : 'references',
            label: ref['gl:term'] || undefined,
            register: registerId,
            lang,
          };
          if (ref['gl:sourceId']) edge.sourceId = ref['gl:sourceId'];
          edges.push(edge);
        }
      }
    }
  }
  return edges;
}

function extractDomains(concept, registerId, uriBase) {
  if (!uriBase) throw new Error('build-edges: uriBase is required — set uriBase in site-config.yml');
  const base = uriBase;
  const edges = [];
  const sourceUri = concept['@id'];
  const seen = new Set();

  // v3 managed concept-level section/domain references
  const domains = concept['gl:domain'];
  if (Array.isArray(domains)) {
    for (const d of domains) {
      const conceptId = d['gl:conceptId'] || d.concept_id;
      if (conceptId) {
        const refType = d['gl:refType'] || d.ref_type || 'domain';
        const isSection = refType === 'section';
        const edgeType = isSection ? 'section' : 'domain';
        const domainUri = `${base}/${registerId}/domain/${conceptId}`;
        if (!seen.has(domainUri)) {
          seen.add(domainUri);
          edges.push({
            source: sourceUri,
            target: domainUri,
            type: edgeType,
            label: conceptId,
            register: registerId,
          });
        }
      }
    }
  }

  // Legacy: localized domain strings
  const lcs = concept['gl:localizedConcept'] || {};
  const langs = Object.keys(lcs);
  for (const lang of langs) {
    const domain = lcs[lang]['gl:domain'];
    if (domain && !seen.has(domain)) {
      seen.add(domain);
      edges.push({
        source: sourceUri,
        target: `${base}/${registerId}/domain/${slugify(domain)}`,
        type: 'domain',
        label: domain,
        register: registerId,
      });
    }
  }
  return edges;
}

function extractRelated(concept, registerId, uriBase, urnMap) {
  const edges = [];
  const sourceUri = concept['@id'];
  for (const r of concept['gl:related'] || []) {
    const ref = r['gl:ref'];
    if (!ref) continue;
    const source = ref['gl:source'] || ref['source'];
    const id = ref['gl:id'] || ref['id'];
    if (!source || !id) continue;
    const reg = urnMap.get(source) || source;
    const target = buildConceptUri(uriBase, reg, id);
    if (target === sourceUri) continue;
    edges.push({
      source: sourceUri,
      target,
      type: r['gl:relationshipType'] || 'references',
      label: r['gl:term'] || undefined,
      register: reg,
    });
  }
  return edges;
}

/**
 * Extracts partitive hyperedges from a concept's gl:partitiveHyperedges
 * array. Returns hyperedge objects (NOT binary GraphEdges) so the UI
 * can render them with their full set-based semantics: comprehensive +
 * parts together, enumeration completeness (open vs closed), and
 * diagram plurality markers (double / dashed).
 *
 * Hyperedges are written to a separate hyperedges.json file, keeping
 * edges.json binary-only.
 */
function extractPartitiveHyperedges(concept, registerId, uriBase, urnMap) {
  const hyperedges = [];
  const sourceUri = concept['@id'];
  for (const he of concept['gl:partitiveHyperedges'] || []) {
    const compRef = he['gl:comprehensive'];
    if (!compRef) continue;
    const comprehensive = resolveConceptUri(compRef, uriBase, urnMap);
    if (!comprehensive) continue;

    const parts = (he['gl:hasPart'] || [])
      .map(p => resolveConceptUri(p, uriBase, urnMap))
      .filter(p => p && p !== sourceUri);

    if (parts.length === 0) continue;

    hyperedges.push({
      source: sourceUri,
      comprehensive,
      parts,
      enumeration: he['gl:enumeration'] || 'closed',
      markers: validateHyperedgeMarkers(he['gl:hasPluralityMarker'] || []),
      label: normalizeHyperedgeContent(he['gl:content']),
      register: registerId,
    });
  }
  return hyperedges;
}

function resolveConceptUri(ref, uriBase, urnMap) {
  const source = ref['gl:source'] || ref['source'];
  const id = ref['gl:id'] || ref['id'];
  if (!source || !id) return null;
  const reg = urnMap.get(source) || source;
  return buildConceptUri(uriBase, reg, id);
}

const EXTRACTORS = [extractReferences, extractRelated, extractDomains];

function extractAllEdges(concept, registerId, uriBase, urnMap) {
  return EXTRACTORS.flatMap(fn => fn(concept, registerId, uriBase, urnMap));
}

// --- Build ---

function buildEdgesForDataset(datasetDir, registerId, uriBase, urnMap, manifest) {
  const conceptsDir = join(datasetDir, 'concepts');
  if (!existsSync(conceptsDir)) {
    console.log(`  Skipping ${registerId}: no concepts directory`);
    return { edges: [], sourceRefs: [] };
  }

  const files = readdirSync(conceptsDir).filter(f => f.endsWith('.json'));
  console.log(`  Processing ${files.length} concepts...`);

  const allEdges = [];
  const allHyperedges = [];
  const allSourceRefs = [];
  const domainConceptCount = new Map();
  let processed = 0;

  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(conceptsDir, file), 'utf-8'));
      const edges = extractAllEdges(data, registerId, uriBase, urnMap);
      allEdges.push(...edges);
      allHyperedges.push(...extractPartitiveHyperedges(data, registerId, uriBase, urnMap));
      allSourceRefs.push(...extractSourceRefs(data, registerId));

      for (const edge of edges) {
        if (edge.type === 'domain' || edge.type === 'section') {
          domainConceptCount.set(edge.target, (domainConceptCount.get(edge.target) || 0) + 1);
        }
      }
    } catch (e) {
      console.error(`  Error processing ${file}: ${e.message}`);
    }
    processed++;
    if (processed % 5000 === 0) {
      console.log(`  ... ${processed}/${files.length}`);
    }
  }

  // Deduplicate edges by source+target+type+lang
  const seen = new Set();
  const deduped = [];
  for (const edge of allEdges) {
    const key = `${edge.source}→${edge.target}→${edge.type}→${edge.lang || ''}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(edge);
    }
  }

  const output = {
    registerId,
    edgeCount: deduped.length,
    edges: deduped,
  };

  const outputPath = join(datasetDir, 'edges.json');
  writeFileSync(outputPath, JSON.stringify(output));
  console.log(`  Written ${deduped.length} edges to edges.json (${(JSON.stringify(output).length / 1024).toFixed(1)} KB)`);

  // Write hyperedges.json (parallel to edges.json) for one-to-many
  // partitive decompositions. See TODO.hyperedge/00-design-overview.md.
  const hyperedgesOutput = {
    registerId,
    hyperedgeCount: allHyperedges.length,
    hyperedges: allHyperedges,
  };
  const hyperedgesPath = join(datasetDir, 'hyperedges.json');
  writeFileSync(hyperedgesPath, JSON.stringify(hyperedgesOutput));
  console.log(`  Written ${allHyperedges.length} hyperedges to hyperedges.json (${(JSON.stringify(hyperedgesOutput).length / 1024).toFixed(1)} KB)`);

  // Build domain-nodes.json from manifest sections (authoritative source)
  const manifestSections = manifest.sections;
  if (manifestSections && manifestSections.length > 0) {
    const uriBase = manifest.uriBase;
    if (!uriBase) throw new Error('build-edges: manifest.uriBase is required');

    function buildSectionNode(section, idx) {
      const sectionId = `section-${section.id}`;
      const domainUri = `${uriBase}/${registerId}/domain/${sectionId}`;
      const domainLabel = section.names?.eng || section.id;
      const node = {
        uri: domainUri,
        id: sectionId,
        names: section.names || {},
        label: domainLabel,
        registerId,
        conceptCount: domainConceptCount.get(domainUri) || 0,
        order: idx,
      };
      if (section.children && section.children.length > 0) {
        node.children = section.children.map((child, childIdx) =>
          buildSectionNode(child, childIdx)
        );
      }
      return node;
    }

    const domainNodes = manifestSections.map((section, idx) =>
      buildSectionNode(section, idx)
    );

    const domainOutput = { registerId, domainNodes };
    const domainPath = join(datasetDir, 'domain-nodes.json');
    writeFileSync(domainPath, JSON.stringify(domainOutput));
    console.log(`  Written ${domainNodes.length} section-based domain nodes to domain-nodes.json`);
  } else {
    // Fallback: derive domain nodes from concept edges (legacy behavior)
    const domainEdgeMap = new Map();
    for (const edge of deduped) {
      if (edge.type === 'domain') {
        const existing = domainEdgeMap.get(edge.target);
        if (existing) {
          existing.labels.add(edge.label);
        } else {
          domainEdgeMap.set(edge.target, { uri: edge.target, labels: new Set([edge.label]), registerId });
        }
      }
    }

    const domainNodes = [...domainEdgeMap.values()].map(d => ({
      uri: d.uri,
      label: [...d.labels][0],
      registerId: d.registerId,
      conceptCount: domainConceptCount.get(d.uri) || 0,
    })).sort((a, b) => b.conceptCount - a.conceptCount);

    const domainOutput = { registerId, domainNodes };
    const domainPath = join(datasetDir, 'domain-nodes.json');
    writeFileSync(domainPath, JSON.stringify(domainOutput));
    console.log(`  Written ${domainNodes.length} edge-derived domain nodes to domain-nodes.json`);
  }

  return { edges: deduped, sourceRefs: allSourceRefs };
}

// Main
export function main() {
console.log('Building edge indexes...\n');

if (!existsSync(DATA_DIR)) {
  console.log('No data directory found. Nothing to do.');
  process.exit(0);
}

const datasets = readdirSync(DATA_DIR).filter(f => {
  try {
    return existsSync(join(DATA_DIR, f, 'manifest.json'));
  } catch {
    return false;
  }
});

// Build URI→datasetId prefix map from all manifests
const urnMap = new Map();
const manifestCache = new Map();
for (const ds of datasets) {
  const manifestPath = join(DATA_DIR, ds, 'manifest.json');
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    manifestCache.set(ds, manifest);
    if (manifest.datasetUri) {
      const base = manifest.datasetUri.endsWith('*') ? manifest.datasetUri.slice(0, -1) : manifest.datasetUri;
      if (base) urnMap.set(base, ds);
    }
    for (const alias of manifest.uriAliases ?? []) {
      const base = alias.endsWith('*') ? alias.slice(0, -1) : alias;
      if (base) urnMap.set(base, ds);
    }
  } catch {}
}
console.log(`URI resolution map: ${[...urnMap.entries()].map(([k,v]) => `${k}→${v}`).join(', ')}\n`);

const allDatasetEdges = new Map();
const allSourceRefs = [];

for (const ds of datasets) {
  const manifest = manifestCache.get(ds);
  if (!manifest) continue;
  try {
    console.log(`${manifest.title} (${ds}):`);
    const uriBase = manifest.uriBase;
    if (!uriBase) throw new Error('build-edges: manifest.uriBase is required');
    const result = buildEdgesForDataset(join(DATA_DIR, ds), ds, uriBase, urnMap, manifest);
    allDatasetEdges.set(ds, result.edges);
    allSourceRefs.push(...result.sourceRefs);
  } catch (e) {
    console.error(`Error reading manifest for ${ds}: ${e.message}`);
  }
  console.log();
}

// Audit — report concept source strings not covered by manifest refs.
// Bibliography mapping (ref → URN) is declared in register.yaml and flows
// through manifest.json to datasets.json at generate time. No separate
// source-refs file needed — the registry IS the single source of truth.

// Build a lookup of all known source strings from manifests
const knownSourceStrings = new Set();
for (const [ds, manifest] of manifestCache) {
  if (manifest.ref) knownSourceStrings.add(manifest.ref);
  for (const alias of manifest.refAliases ?? []) {
    knownSourceStrings.add(alias);
  }
  if (manifest.datasetUri) {
    const base = manifest.datasetUri.endsWith('*') ? manifest.datasetUri.slice(0, -1) : manifest.datasetUri;
    knownSourceStrings.add(base);
  }
  for (const alias of manifest.uriAliases ?? []) {
    const base = alias.endsWith('*') ? alias.slice(0, -1) : alias;
    knownSourceStrings.add(base);
  }
}

const auditUnmatched = new Map();
for (const { source, registerId } of allSourceRefs) {
  if (knownSourceStrings.has(source)) continue;
  // URN source strings resolve via URI routing — not a bibliography concern
  if (source.startsWith('urn:')) continue;
  if (!auditUnmatched.has(source)) {
    auditUnmatched.set(source, registerId);
  }
}

if (auditUnmatched.size > 0) {
  console.warn(`\n⚠ ${auditUnmatched.size} source string(s) in concept data have no matching dataset ref:`);
  for (const [source, fromDataset] of auditUnmatched) {
    console.warn(`  "${source}" (from ${fromDataset})`);
  }
  console.warn('Add refAliases to the target dataset manifest, or fix source strings to use URNs.\n');
}

// Build cross-reference index: for each dataset, which other datasets'
// edges.json contains edges targeting that dataset's URIs.
const datasetUriPrefixes = new Map();
for (const [ds, manifest] of manifestCache) {
  const uriBase = manifest.uriBase;
    if (!uriBase) throw new Error('build-edges: manifest.uriBase is required');
  datasetUriPrefixes.set(ds, `${uriBase}/${ds}/`);
}

const crossRefIndex = {};
for (const ds of datasets) {
  crossRefIndex[ds] = [];
}

for (const [sourceDs, edges] of allDatasetEdges) {
  const targets = new Set();
  for (const edge of edges) {
    for (const [targetDs, prefix] of datasetUriPrefixes) {
      if (targetDs !== sourceDs && edge.target.startsWith(prefix)) {
        targets.add(targetDs);
      }
    }
    // Also check source URIs targeting other datasets
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

const crossRefPath = join(DATA_DIR, 'cross-ref-index.json');
writeFileSync(crossRefPath, JSON.stringify(crossRefIndex));
const refCount = Object.values(crossRefIndex).reduce((sum, arr) => sum + arr.length, 0);
console.log(`Written cross-ref-index.json (${refCount} cross-references across ${datasets.length} datasets)`);

console.log('Done.');
}

const isDirectInvocation = process.argv[1]
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isDirectInvocation) {
  main();
}
