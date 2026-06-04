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
  const lcs = concept['gl:localizedConcept'] || {};
  const langs = Object.keys(lcs);
  const seen = new Set();
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

function buildEdgesForDataset(datasetDir, registerId, uriBase, urnMap) {
  const conceptsDir = join(datasetDir, 'concepts');
  if (!existsSync(conceptsDir)) {
    console.log(`  Skipping ${registerId}: no concepts directory`);
    return;
  }

  const files = readdirSync(conceptsDir).filter(f => f.endsWith('.json'));
  console.log(`  Processing ${files.length} concepts...`);

  const allEdges = [];
  const domainConceptCount = new Map();
  let processed = 0;

  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(conceptsDir, file), 'utf-8'));
      const edges = extractAllEdges(data, registerId, uriBase, urnMap);
      allEdges.push(...edges);

      for (const edge of edges) {
        if (edge.type === 'domain') {
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
  writeFileSync(outputPath, JSON.stringify(output, null, 2));
  console.log(`  Written ${deduped.length} edges to edges.json (${(JSON.stringify(output).length / 1024).toFixed(1)} KB)`);

  // Build domain-nodes.json
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
  writeFileSync(domainPath, JSON.stringify(domainOutput, null, 2));
  console.log(`  Written ${domainNodes.length} domain nodes to domain-nodes.json`);
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

for (const ds of datasets) {
  const manifest = manifestCache.get(ds);
  if (!manifest) continue;
  try {
    console.log(`${manifest.title} (${ds}):`);
    const uriBase = manifest.uriBase || 'https://glossarist.org';
    buildEdgesForDataset(join(DATA_DIR, ds), ds, uriBase, urnMap);
  } catch (e) {
    console.error(`Error reading manifest for ${ds}: ${e.message}`);
  }
  console.log();
}

console.log('Done.');
