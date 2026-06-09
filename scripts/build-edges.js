/**
 * Pre-computes cross-reference and domain edges for each dataset.
 * Reads all concept JSON files, extracts structured references and
 * authoritative sources (domains), and writes edges.json + domain-nodes.json.
 *
 * Usage: node scripts/build-edges.js
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
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

function extractSourceRefs(concept, registerId) {
  const refs = new Set();

  // Managed concept-level sources
  for (const src of concept['gl:source'] || []) {
    const origin = src['gl:origin'];
    if (origin) {
      const ref = origin['gl:ref'];
      if (ref?.['gl:source']) refs.add(ref['gl:source']);
    }
  }

  // Localized concept-level sources
  for (const lc of Object.values(concept['gl:localizedConcept'] || {})) {
    for (const src of lc['gl:source'] || []) {
      const origin = src['gl:origin'];
      if (origin) {
        const ref = origin['gl:ref'];
        if (ref?.['gl:source']) refs.add(ref['gl:source']);
      }
    }
  }

  return [...refs].map(source => ({ source, registerId }));
}

function extractReferences(concept, registerId) {
  const edges = [];
  const sourceUri = concept['@id'];
  for (const [lang, lc] of Object.entries(concept['gl:localizedConcept'] || {})) {
    if (lc['gl:references']) {
      for (const ref of lc['gl:references']) {
        if (ref['@id'] && ref['@id'] !== sourceUri) {
          edges.push({
            source: sourceUri,
            target: ref['@id'],
            type: 'references',
            label: ref['gl:term'] || undefined,
            register: registerId,
            lang,
          });
        }
      }
    }
  }
  return edges;
}

function extractDomains(concept, registerId, uriBase) {
  const base = uriBase || 'https://glossarist.org';
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
    const target = `${uriBase}/${reg}/concept/${id}`;
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
  const allSourceRefs = [];
  const domainConceptCount = new Map();
  let processed = 0;

  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(conceptsDir, file), 'utf-8'));
      const edges = extractAllEdges(data, registerId, uriBase, urnMap);
      allEdges.push(...edges);
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

  // Build domain-nodes.json from manifest sections (authoritative source)
  const manifestSections = manifest.sections;
  if (manifestSections && manifestSections.length > 0) {
    const uriBase = manifest.uriBase || 'https://glossarist.org';

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

// Build URN→datasetId map from all manifests
const urnMap = new Map();
const manifestCache = new Map();
for (const ds of datasets) {
  const manifestPath = join(DATA_DIR, ds, 'manifest.json');
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    manifestCache.set(ds, manifest);
    if (manifest.datasetUri) urnMap.set(manifest.datasetUri, ds);
    for (const alias of manifest.uriAliases ?? []) {
      const base = alias.endsWith('*') ? alias.slice(0, -1) : alias;
      if (base.startsWith('urn:')) urnMap.set(base, ds);
    }
  } catch {}
}
console.log(`URN resolution map: ${[...urnMap.entries()].map(([k,v]) => `${k}→${v}`).join(', ')}\n`);

const allDatasetEdges = new Map();
const allSourceRefs = [];

for (const ds of datasets) {
  const manifest = manifestCache.get(ds);
  if (!manifest) continue;
  try {
    console.log(`${manifest.title} (${ds}):`);
    const uriBase = manifest.uriBase || 'https://glossarist.org';
    const result = buildEdgesForDataset(join(DATA_DIR, ds), ds, uriBase, urnMap, manifest);
    allDatasetEdges.set(ds, result.edges);
    allSourceRefs.push(...result.sourceRefs);
  } catch (e) {
    console.error(`Error reading manifest for ${ds}: ${e.message}`);
  }
  console.log();
}

// Build source-refs index: maps every source string to its dataset ID.
// Uses manifest ref/refAliases as authoritative keys, augmented by
// actual source strings found in concept data.
const sourceRefMap = {};

// Seed from manifests (authoritative)
for (const [ds, manifest] of manifestCache) {
  if (manifest.ref) sourceRefMap[manifest.ref] = ds;
  for (const alias of manifest.refAliases ?? []) {
    sourceRefMap[alias] = ds;
  }
  if (manifest.datasetUri) sourceRefMap[manifest.datasetUri] = ds;
  for (const alias of manifest.uriAliases ?? []) {
    const base = alias.endsWith('*') ? alias.slice(0, -1) : alias;
    sourceRefMap[base] = ds;
  }
}

// Augment with actual source strings from concepts
for (const { source, registerId } of allSourceRefs) {
  if (!sourceRefMap[source]) {
    sourceRefMap[source] = registerId;
  }
}

const sourceRefPath = join(DATA_DIR, 'source-refs.json');
writeFileSync(sourceRefPath, JSON.stringify(sourceRefMap));
console.log(`Written source-refs.json (${Object.keys(sourceRefMap).length} source references across ${datasets.length} datasets)\n`);

// Build cross-reference index: for each dataset, which other datasets'
// edges.json contains edges targeting that dataset's URIs.
const datasetUriPrefixes = new Map();
for (const [ds, manifest] of manifestCache) {
  const uriBase = manifest.uriBase || 'https://glossarist.org';
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
