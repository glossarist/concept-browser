/**
 * Pre-computes cross-reference edges for each dataset.
 * Reads all concept JSON files, extracts structured and inline references,
 * and writes edges.json for each dataset.
 *
 * Usage: node scripts/build-edges.js
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = process.cwd();
const DATA_DIR = join(ROOT, 'public', 'data');

function extractEdgesFromConcept(concept, registerId) {
  const edges = [];
  const sourceUri = concept['@id'];

  for (const [_lang, lc] of Object.entries(concept['gl:localizedConcept'] || {})) {
    // Structured cross-references (gl:references array, pre-computed during data generation)
    if (lc['gl:references']) {
      for (const ref of lc['gl:references']) {
        if (ref['@id'] && ref['@id'] !== sourceUri) {
          edges.push({
            source: sourceUri,
            target: ref['@id'],
            type: 'references',
            label: ref['gl:term'] || undefined,
            register: registerId,
          });
        }
      }
    }
  }

  return edges;
}

function buildEdgesForDataset(datasetDir, registerId) {
  const conceptsDir = join(datasetDir, 'concepts');
  if (!existsSync(conceptsDir)) {
    console.log(`  Skipping ${registerId}: no concepts directory`);
    return;
  }

  const files = readdirSync(conceptsDir).filter(f => f.endsWith('.json'));
  console.log(`  Processing ${files.length} concepts...`);

  const allEdges = [];
  let processed = 0;

  for (const file of files) {
    try {
      const data = JSON.parse(readFileSync(join(conceptsDir, file), 'utf-8'));
      const edges = extractEdgesFromConcept(data, registerId);
      allEdges.push(...edges);
    } catch (e) {
      console.error(`  Error processing ${file}: ${e.message}`);
    }
    processed++;
    if (processed % 5000 === 0) {
      console.log(`  ... ${processed}/${files.length}`);
    }
  }

  // Deduplicate edges by source+target pair
  const seen = new Set();
  const deduped = [];
  for (const edge of allEdges) {
    const key = `${edge.source}→${edge.target}`;
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

for (const ds of datasets) {
  const manifestPath = join(DATA_DIR, ds, 'manifest.json');
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    console.log(`${manifest.title} (${ds}):`);
    buildEdgesForDataset(join(DATA_DIR, ds), ds);
  } catch (e) {
    console.error(`Error reading manifest for ${ds}: ${e.message}`);
  }
  console.log();
}

console.log('Done.');
