/**
 * Data bridge: converts existing public/data/*.json into Astro
 * content collections at src/content/. Run before `astro build`.
 *
 * Reads: public/data/datasets.json, public/data/{id}/manifest.json,
 *        public/data/{id}/index.json
 * Writes: src/content/datasets/*.json, src/content/groups/*.json,
 *         src/content/concepts/{registerId}/{conceptId}.json
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC_DATA = join(ROOT, 'public', 'data');
const CONTENT_DIR = join(ROOT, 'src', 'content');

function readJson(p) {
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf-8'));
}

function writeJson(dir, name, data) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2));
}

// --- Datasets ---
const registryPath = join(PUBLIC_DATA, 'datasets.json');
const siteConfigPath = join(ROOT, 'public', 'site-config.json');
const registry = readJson(registryPath) || [];
const siteConfig = readJson(siteConfigPath) || {};

console.log(`Bridging ${registry.length} datasets to content collections...`);

for (const reg of registry) {
  const id = reg.id;
  const manifestPath = join(PUBLIC_DATA, id, 'manifest.json');
  const manifest = readJson(manifestPath);
  if (!manifest) {
    console.warn(`  Skipping ${id}: no manifest.json`);
    continue;
  }

  const summary = reg.summary || {};
  const entry = {
    id: manifest.id || id,
    title: summary.title || manifest.title || id,
    description: summary.description || manifest.description || '',
    uri: manifest.datasetUri || reg.datasetUri || '',
    uriBase: manifest.uriBase || reg.uriBase || '',
    year: manifest.year ?? summary.year ?? undefined,
    status: manifest.status || summary.status || 'valid',
    ref: manifest.ref || reg.ref || undefined,
    refAliases: manifest.refAliases || reg.refAliases || undefined,
    owner: summary.owner || manifest.owner || '',
    languages: manifest.languages || summary.languages || ['eng'],
    conceptCount: manifest.conceptCount || summary.conceptCount || 0,
    color: summary.color || manifest.color || undefined,
    tags: summary.tags || manifest.tags || [],
    sections: manifest.sections || [],
    sourceRepo: manifest.sourceRepo || '',
    lastUpdated: manifest.lastUpdated || '',
  };

  // Remove undefined values
  Object.keys(entry).forEach(k => entry[k] === undefined && delete entry[k]);

  writeJson(join(CONTENT_DIR, 'datasets'), `${id}.json`, entry);
  console.log(`  Dataset: ${id} (${entry.conceptCount} concepts)`);

  // --- Concepts for this dataset ---
  const indexPath = join(PUBLIC_DATA, id, 'index.json');
  const index = readJson(indexPath);
  if (index && index.concepts) {
    for (const concept of index.concepts) {
      if (!concept) continue;
      const conceptEntry = {
        registerId: id,
        conceptId: concept.id,
        uri: `${entry.uriBase || ''}/${id}/concept/${concept.id}`,
        status: concept.status || 'valid',
        designations: concept.designations || {},
        eng: concept.eng || concept.designations?.eng || '',
        groups: concept.groups || [],
        tags: [],
      };
      writeJson(
        join(CONTENT_DIR, 'concepts', id),
        `${concept.id}.json`,
        conceptEntry
      );
    }
    console.log(`    ${index.concepts.filter(Boolean).length} concepts bridged`);
  }
}

// --- Groups ---
const groups = siteConfig.datasetGroups || [];
for (const g of groups) {
  const entry = {
    id: g.id,
    label: g.label || g.id,
    kind: g.kind || (g.series ? 'lineage' : 'default'),
    description: g.description || '',
    current: g.current || undefined,
    datasets: g.datasets || [],
    color: g.color || undefined,
  };
  Object.keys(entry).forEach(k => entry[k] === undefined && delete entry[k]);
  writeJson(join(CONTENT_DIR, 'groups'), `${g.id}.json`, entry);
  console.log(`  Group: ${g.id} (${entry.datasets.length} datasets)`);
}

// --- Pages (from public/pages/*.json) ---
const pagesDir = join(ROOT, 'public', 'pages');
if (existsSync(pagesDir)) {
  for (const file of readdirSync(pagesDir)) {
    if (!file.endsWith('.json')) continue;
    const page = readJson(join(pagesDir, file));
    if (!page) continue;
    // Write as a minimal markdown file for the pages content collection
    const slug = file.replace('.json', '');
    const md = `---\ntitle: "${page.title || slug}"\ntype: "page"\n---\n\n${page.html || ''}\n`;
    writeFileSync(join(CONTENT_DIR, 'pages', `${slug}.md`), md);
  }
  console.log('  Pages bridged from public/pages/');
}

console.log('Data bridge complete.');
