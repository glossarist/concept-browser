#!/usr/bin/env node
/**
 * package-dataset.mjs — Harmonize concepts and build a GCR package from a source directory.
 *
 * Used by glossary repo CI workflows to build and publish GCR packages.
 *
 * Usage:
 *   node scripts/package-dataset.mjs <source-dir> --id <dataset-id> -o <output.gcr>
 *
 * The source directory must contain:
 *   - concepts/*.yaml  (concept files in any geolexica-compatible format)
 *   - register.yaml    (optional, dataset metadata)
 */
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Parse args
const args = process.argv.slice(2);
let sourceDir = null;
let datasetId = null;
let outputPath = null;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--id' && args[i + 1]) datasetId = args[++i];
  else if (args[i] === '-o' && args[i + 1]) outputPath = args[++i];
  else if (!sourceDir && !args[i].startsWith('-')) sourceDir = args[i];
}

if (!sourceDir || !datasetId || !outputPath) {
  console.error('Usage: node scripts/package-dataset.mjs <source-dir> --id <dataset-id> -o <output.gcr>');
  process.exit(1);
}

sourceDir = path.resolve(sourceDir);
outputPath = path.resolve(outputPath);

const LANG_CODES = ['eng', 'ara', 'deu', 'fra', 'spa', 'ita', 'jpn', 'kor', 'pol', 'por', 'srp', 'swe', 'zho', 'rus', 'fin', 'dan', 'nld', 'msa', 'nob', 'nno'];

// --- Geolexica v2 converter (UUID-based multi-doc YAML → canonical concept YAML) ---
function convertGeolexicaV2(v2Dir, conceptsDir) {
  const files = fs.readdirSync(v2Dir).filter(f => f.endsWith('.yaml') && !f.startsWith('.'));
  console.log(`  Converting ${files.length} geolexica-v2 files...`);

  if (fs.existsSync(conceptsDir)) fs.rmSync(conceptsDir, { recursive: true, force: true });
  fs.mkdirSync(conceptsDir, { recursive: true });

  let count = 0, errors = 0;
  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(v2Dir, file), 'utf8');
      const docs = yaml.loadAll(content);
      if (!docs.length) continue;

      // First doc is the concept registry entry
      const registry = docs[0]?.data || docs[0];
      const termid = registry?.identifier;
      if (!termid) continue;

      const localizedConcepts = registry?.localized_concepts || {};
      const langMap = new Map(); // uuid → lang code

      for (const [lang, uuid] of Object.entries(localizedConcepts)) {
        langMap.set(uuid, lang);
      }

      // Build canonical concept
      const concept = { termid: String(termid) };

      // Subsequent docs are localized concepts
      for (let i = 1; i < docs.length; i++) {
        const doc = docs[i];
        if (!doc) continue;
        const data = doc.data || doc;
        const docId = doc.id || data.id;
        const lang = langMap.get(docId) || data.language_code;

        if (!lang || !LANG_CODES.includes(lang)) continue;

        const langBlock = {};
        if (data.terms) langBlock.terms = data.terms;
        if (data.definition) {
          langBlock.definition = Array.isArray(data.definition) ? data.definition : [{ content: data.definition }];
        }
        if (data.notes) langBlock.notes = data.notes;
        if (data.examples) langBlock.examples = data.examples;
        if (data.sources) langBlock.sources = data.sources;
        if (data.language_code) langBlock.language_code = data.language_code;
        if (data.entry_status) langBlock.entry_status = data.entry_status;
        if (data.dates) langBlock.dates = data.dates;
        if (data.date_accepted) langBlock.date_accepted = data.date_accepted;
        if (data.authoritative_source) langBlock.authoritative_source = data.authoritative_source;

        concept[lang] = langBlock;
      }

      // Derive term from preferred designation in eng
      if (!concept.term && concept.eng?.terms) {
        const pref = concept.eng.terms.find(t => t.normative_status === 'preferred' || t.type === 'expression');
        concept.term = pref?.designation || '';
      }

      const outPath = path.join(conceptsDir, `concept-${termid}.yaml`);
      fs.writeFileSync(outPath, `---\n${yaml.dump(concept, { lineWidth: -1, noRefs: true })}`);
      count++;
    } catch (e) {
      errors++;
      if (errors <= 5) console.warn(`  Error converting ${file}: ${e.message}`);
    }
  }
  if (errors > 5) console.warn(`  ... ${errors - 5} more errors`);
  console.log(`  Converted ${count} concepts (${errors} errors)`);
  return count;
}

// Determine concept source: geolexica-v2/, concepts/, or fail
const v2Dir = path.join(sourceDir, 'geolexica-v2');
let conceptsDir = path.join(sourceDir, 'concepts');
const hasConcepts = fs.existsSync(conceptsDir) && fs.readdirSync(conceptsDir).some(f => f.endsWith('.yaml'));

if (!hasConcepts && !fs.existsSync(v2Dir)) {
  console.error(`No concepts/ or geolexica-v2/ directory in ${sourceDir}`);
  process.exit(1);
}

if (!hasConcepts && fs.existsSync(v2Dir)) {
  console.log(`  No concepts/ found, using geolexica-v2/ format`);
  convertGeolexicaV2(v2Dir, conceptsDir);
}

// --- Cross-reference maps from datasets.yml ---
let refPrefixMap = {};
let urnStandardMap = {};
const configPath = path.join(ROOT, 'datasets.yml');
if (fs.existsSync(configPath)) {
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  const xref = config.crossReferences || {};
  refPrefixMap = xref.refPrefixMap || {};
  urnStandardMap = xref.urnStandardMap || {};
}

// --- Harmonization (mirrors fetch-datasets.mjs) ---
function extractInlineRefs(localizedData, refPrefixMap, urnStandardMap) {
  const refs = [];
  const texts = [];

  if (localizedData.definition) {
    const defs = Array.isArray(localizedData.definition) ? localizedData.definition : [localizedData.definition];
    for (const d of defs) {
      texts.push(typeof d === 'string' ? d : (d.content || ''));
    }
  }
  if (localizedData.notes) {
    for (const n of localizedData.notes) {
      texts.push(typeof n === 'string' ? n : (n.content || ''));
    }
  }
  if (localizedData.examples) {
    for (const e of localizedData.examples) {
      texts.push(typeof e === 'string' ? e : (e.content || ''));
    }
  }
  const fullText = texts.join(' ');

  const ievMatches = fullText.matchAll(/\{\{([^,}]+),\s*IEV:([^}]+)\}\}/g);
  for (const m of ievMatches) {
    const dsId = refPrefixMap['IEV'];
    if (dsId) refs.push({ id: `https://glossarist.org/${dsId}/concept/${m[2]}`, term: m[1].trim() });
  }

  const urnMatches = fullText.matchAll(/\{urn:iso:std:iso:(\d+):([^,}]+),([^}]+)\}/g);
  for (const m of urnMatches) {
    const dsId = urnStandardMap[m[1]];
    if (dsId) refs.push({ id: `https://glossarist.org/${dsId}/concept/${m[2]}`, term: m[3].trim() });
  }

  const seen = new Set();
  return refs.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

function harmonizeLanguageBlock(lc, refPrefixMap, urnStandardMap) {
  if (!lc || typeof lc !== 'object') return lc;

  if (lc.definition != null) {
    if (typeof lc.definition === 'string') {
      lc.definition = [{ content: lc.definition }];
    }
  }

  if (lc.authoritative_source && !lc.sources) {
    const src = lc.authoritative_source;
    lc.sources = [{
      type: 'authoritative',
      origin: {
        ...(src.ref ? { ref: src.ref } : {}),
        ...(src.clause ? { clause: src.clause } : {}),
        ...(src.link ? { link: src.link } : {}),
      },
    }];
    delete lc.authoritative_source;
  } else if (lc.authoritative_source) {
    delete lc.authoritative_source;
  }

  if (!lc.dates) {
    const dates = [];
    if (lc.date_accepted) dates.push({ type: 'accepted', date: lc.date_accepted });
    if (lc.date_amended) dates.push({ type: 'amended', date: lc.date_amended });
    if (dates.length > 0) lc.dates = dates;
  }

  if (lc.entry_status === 'Standard') lc.entry_status = 'valid';

  if (Array.isArray(lc.terms)) {
    for (const t of lc.terms) {
      if (t.abbrev === true) {
        t.type = 'abbreviation';
        delete t.abbrev;
      }
    }
  }

  const inlineRefs = extractInlineRefs(lc, refPrefixMap, urnStandardMap);
  if (inlineRefs.length > 0) {
    const existing = lc.references || [];
    const existingIds = new Set(existing.map(r => r.id));
    for (const r of inlineRefs) {
      if (!existingIds.has(r.id)) existing.push(r);
    }
    lc.references = existing;
  }

  delete lc._revisions;
  return lc;
}

function harmonizeConcept(concept) {
  if (concept.termid != null) concept.termid = String(concept.termid);
  for (const lang of LANG_CODES) {
    if (concept[lang]) concept[lang] = harmonizeLanguageBlock(concept[lang], refPrefixMap, urnStandardMap);
  }
  return concept;
}

// --- GCR build (mirrors build-gcr.mjs) ---
function collectStats(conceptsDir) {
  const files = fs.readdirSync(conceptsDir).filter(f => f.endsWith('.yaml'));
  const languages = new Set();
  let withDefs = 0;
  let withSources = 0;

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(conceptsDir, file), 'utf8');
      const concept = yaml.load(content);
      if (!concept) continue;
      let hasDef = false, hasSource = false;
      for (const lang of LANG_CODES) {
        const lc = concept[lang];
        if (!lc) continue;
        languages.add(lang);
        if (lc.definition?.length) hasDef = true;
        if (lc.sources?.length) hasSource = true;
      }
      if (hasDef) withDefs++;
      if (hasSource) withSources++;
    } catch {}
  }

  return {
    concept_count: files.length,
    languages: [...languages].sort(),
    concepts_with_definitions: withDefs,
    concepts_with_sources: withSources,
  };
}

// --- Main ---
console.log(`Packaging ${datasetId} from ${sourceDir}`);

const files = fs.readdirSync(conceptsDir).filter(f => f.endsWith('.yaml'));
console.log(`  Harmonizing ${files.length} concept files...`);

let count = 0, errors = 0;
for (const file of files) {
  try {
    const filePath = path.join(conceptsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    const concept = yaml.load(content);
    if (!concept || !concept.termid) continue;

    harmonizeConcept(concept);

    const yamlContent = yaml.dump(concept, {
      lineWidth: -1, noRefs: true, sortKeys: false,
      quotingType: '"', forceQuotes: false,
    });
    fs.writeFileSync(filePath, `---\n${yamlContent}`);
    count++;
  } catch (e) {
    errors++;
    if (errors <= 5) console.warn(`  Error harmonizing ${file}: ${e.message}`);
  }
}
if (errors > 5) console.warn(`  ... ${errors - 5} more errors`);
console.log(`  Harmonized ${count} concepts (${errors} errors)`);

// Build GCR
const stagingDir = path.join(ROOT, '.gcr-staging', datasetId);
if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
fs.mkdirSync(path.join(stagingDir, 'concepts'), { recursive: true });

const stats = collectStats(conceptsDir);
console.log(`  ${stats.concept_count} concepts, ${stats.languages.length} languages`);

// Load dataset metadata from datasets.yml
let dsMeta = {};
if (fs.existsSync(configPath)) {
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  dsMeta = config.datasets?.find(d => d.id === datasetId) || {};
}

const metadata = {
  title: dsMeta.title || datasetId,
  description: dsMeta.description || '',
  glossarist_version: 'browser-pipeline',
  created_at: new Date().toISOString(),
  created_by: 'glossarist-vocabulary-browser package-dataset',
  statistics: stats,
  schema_version: '1.0.0',
};
if (dsMeta.owner) metadata.owner = dsMeta.owner;
if (dsMeta.existingSiteUrl) metadata.homepage = dsMeta.existingSiteUrl;
if (dsMeta.sourceRepo) metadata.repository = dsMeta.sourceRepo;
if (dsMeta.tags) metadata.tags = dsMeta.tags;
if (dsMeta.color) { metadata.appearance = { color: dsMeta.color }; }

fs.writeFileSync(
  path.join(stagingDir, 'metadata.yaml'),
  yaml.dump(metadata, { lineWidth: -1, noRefs: true }),
);

const registerYaml = path.join(sourceDir, 'register.yaml');
if (fs.existsSync(registerYaml)) {
  fs.copyFileSync(registerYaml, path.join(stagingDir, 'register.yaml'));
}

const conceptFiles = fs.readdirSync(conceptsDir).filter(f => f.endsWith('.yaml'));
for (const f of conceptFiles) {
  fs.copyFileSync(path.join(conceptsDir, f), path.join(stagingDir, 'concepts', f));
}

const outputDir = path.dirname(outputPath);
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

execSync(`cd "${stagingDir}" && zip -r -q "${outputPath}" .`, { stdio: 'pipe' });
fs.rmSync(stagingDir, { recursive: true, force: true });

const size = fs.statSync(outputPath).size;
console.log(`  Built ${outputPath} (${(size / 1024).toFixed(0)} KB)`);
console.log('Done.');
