import { buildConceptUri } from './lib/concept-uri';

const VALID_COMPLETENESS = new Set(['complete', 'partial']);

function validateCompleteness(value) {
  if (value == null) return 'complete';
  if (!VALID_COMPLETENESS.has(value)) {
    throw new Error(
      `Invalid partitive relation completeness: "${value}". Allowed: complete, partial`,
    );
  }
  return value;
}

/**
 * Resolve a partitive member's multiplicity from JSON-LD.
 *
 * Reads gl:multiplicity first (v3 wire shape, ISO 704:2022). Falls back
 * to migrating from gl:certainty (v2 wire shape) for one release cycle
 * until upstream emits multiplicity natively.
 *
 *   confirmed → compulsory
 *   possible  → optional
 */
const VALID_PRESENCE = new Set(['required', 'optional']);
const VALID_COUNT = new Set(['exactly_one', 'at_least_one', 'multiple']);
const LEGACY_MULTIPLICITY_MAP = {
  compulsory:               { presence: 'required', count: 'exactly_one' },
  optional:                 { presence: 'optional', count: 'exactly_one' },
  compulsory_multiple:      { presence: 'required', count: 'multiple' },
  optional_multiple:        { presence: 'optional', count: 'multiple' },
  compulsory_at_least_one:  { presence: 'required', count: 'at_least_one' },
};

function resolvePresence(member) {
  const p = member['gl:presence'] ?? member.presence;
  if (p != null) {
    if (!VALID_PRESENCE.has(p)) throw new Error(`Invalid presence: "${p}"`);
    return p;
  }
  return migrateMultiplicity(member).presence;
}

function resolveCount(member) {
  const c = member['gl:count'] ?? member.count;
  if (c != null) {
    if (!VALID_COUNT.has(c)) throw new Error(`Invalid count: "${c}"`);
    return c;
  }
  return migrateMultiplicity(member).count;
}

function migrateMultiplicity(member) {
  const m = member['gl:multiplicity'] ?? member.multiplicity;
  if (m && LEGACY_MULTIPLICITY_MAP[m]) return LEGACY_MULTIPLICITY_MAP[m];
  const certainty = member['gl:certainty'] ?? member.certainty;
  if (certainty === 'possible') return { presence: 'optional', count: 'exactly_one' };
  return { presence: 'required', count: 'exactly_one' };
}

function resolveIsDelimiting(member) {
  return member['gl:isDelimiting'] === true || member.isDelimiting === true;
}

function normalizeLocalizedString(content) {
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

function extractReferences(concept: Record<string, any>, registerId: string) {
  const edges: Record<string, any>[] = [];
  const sourceUri = concept['@id'];
  for (const [lang, lc] of Object.entries(concept['gl:localizedConcept'] || {}) as [string, any][]) {
    if (lc['gl:references']) {
      for (const ref of lc['gl:references'] as Record<string, any>[]) {
        if (ref['@id'] && ref['@id'] !== sourceUri) {
          const edge: Record<string, any> = {
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
    // Prefer gl:target — already resolved at generate-data build time
    // via refPrefixMap (maps dataset ref labels to dataset IDs).
    if (r['gl:target']) {
      edges.push({
        source: sourceUri,
        target: r['gl:target'],
        type: r['gl:relationshipType'] || 'references',
        label: r['gl:term'] || undefined,
        register: r['gl:target'].match(/\/([^/]+)\/concept\//)?.[1] || registerId,
      });
      continue;
    }
    // Fallback: resolve from gl:ref using urnMap
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
 * Extracts partitive relations from a concept's gl:partitiveRelations
 * array. Returns relation objects (NOT binary GraphEdges) so the UI
 * can render them with their full set-based semantics: comprehensive +
 * partitives (each with certainty), completeness, plurality, and
 * criterion.
 *
 * Relations are written to partitive_relations.json, keeping
 * edges.json binary-only.
 *
 * v2 shape per concept-model/TODO.partitive-relation-v2.
 */
function extractPartitiveRelations(concept, registerId, uriBase, urnMap) {
  const relations = [];
  const sourceUri = concept['@id'];
  for (const rel of concept['gl:partitiveRelations'] || []) {
    const compRef = rel['gl:comprehensive'];
    if (!compRef) continue;
    const comprehensive = resolveConceptUri(compRef, uriBase, urnMap);
    if (!comprehensive) continue;

    const partitives = (rel['gl:hasPartitive'] || [])
      .map(p => {
        const memberRef = p['gl:ref'] || p;
        const uri = resolveConceptUri(memberRef, uriBase, urnMap);
        if (!uri || uri === sourceUri) return null;
        return {
          uri,
          presence: resolvePresence(p),
          count: resolveCount(p),
          isDelimiting: resolveIsDelimiting(p),
        };
      })
      .filter(p => p !== null);

    if (partitives.length === 0) continue;

    relations.push({
      source: sourceUri,
      comprehensive,
      partitives,
      completeness: validateCompleteness(rel['gl:completeness']),
      criterion: normalizeLocalizedString(rel['gl:criterion']),
      register: registerId,
    });
  }
  return relations;
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

/**
 * Per concept-model TODO.partitive-relation-v2 item 14:
 * a PartitiveRelation A → {b, c, d} subsumes binary has_part edges
 * for the same pairs. Warn (don't fail) when both encodings exist.
 *
 * Binary edge types considered partitive: has_part, is_part_of,
 * broader_partitive, narrower_partitive.
 */
const BINARY_PARTITIVE_TYPES = new Set(['has_part', 'is_part_of', 'broader_partitive', 'narrower_partitive']);

function warnBinaryPartitiveRedundancy(edges, relations, registerId) {
  if (!relations?.length) return;
  const partitivePairs = new Set();
  for (const rel of relations) {
    for (const member of rel.partitives ?? []) {
      const memberUri = member.uri ?? member;
      partitivePairs.add(`${rel.comprehensive}|${memberUri}`);
      partitivePairs.add(`${memberUri}|${rel.comprehensive}`);
    }
  }
  const redundant = edges.filter(e =>
    BINARY_PARTITIVE_TYPES.has(e.type)
    && partitivePairs.has(`${e.source}|${e.target}`),
  );
  if (redundant.length > 0) {
    console.warn(
      `  ⚠ ${registerId}: ${redundant.length} binary has_part/is_part_of edge(s) duplicate a PartitiveRelation member — prefer the PartitiveRelation encoding (concept-model TODO item 14).`,
    );
  }
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
  const allPartitiveRelations = [];
  const allSourceRefs = [];
  const domainConceptCount = new Map();
  let processed = 0;

  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(conceptsDir, file), 'utf-8'));
      const edges = extractAllEdges(data, registerId, uriBase, urnMap);
      const relations = extractPartitiveRelations(data, registerId, uriBase, urnMap);
      warnBinaryPartitiveRedundancy(edges, relations, registerId);
      allEdges.push(...edges);
      allPartitiveRelations.push(...relations);
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

  // Write partitive_relations.json (parallel to edges.json) for one-to-many
  // partitive decompositions. See TODO.partitive-relation-v2.
  const relationsOutput = {
    registerId,
    relationCount: allPartitiveRelations.length,
    relations: allPartitiveRelations,
  };
  const relationsPath = join(datasetDir, 'partitive_relations.json');
  writeFileSync(relationsPath, JSON.stringify(relationsOutput));
  console.log(`  Written ${allPartitiveRelations.length} partitive relations to partitive_relations.json (${(JSON.stringify(relationsOutput).length / 1024).toFixed(1)} KB)`);

  // Build domain-nodes.json from manifest sections (authoritative source)
  const manifestSections = manifest.sections;
  if (manifestSections && manifestSections.length > 0) {
    const uriBase = manifest.uriBase;
    if (!uriBase) throw new Error('build-edges: manifest.uriBase is required');

    function buildSectionNode(section: Record<string, any>, idx: number): Record<string, any> {
      const sectionId = `section-${section.id}`;
      const domainUri = `${uriBase}/${registerId}/domain/${sectionId}`;
      const domainLabel = section.names?.eng || section.id;
      const node: Record<string, any> = {
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
    // Map the dataset's ref label (e.g. "CIE S 017:2020") to its dataset ID.
    // This enables cross-dataset resolution for gl:ref entries that use
    // source labels instead of URIs.
    if (manifest.ref) {
      urnMap.set(manifest.ref, ds);
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
const datasetUriPrefixes = new Map<string, string>();
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
  const targets = new Set<string>();
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
const refCount = Object.values(crossRefIndex).reduce((sum: number, arr: string[]) => sum + arr.length, 0);
console.log(`Written cross-ref-index.json (${refCount} cross-references across ${datasets.length} datasets)`);

console.log('Done.');
}

const isDirectInvocation = process.argv[1]
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isDirectInvocation) {
  main();
}
