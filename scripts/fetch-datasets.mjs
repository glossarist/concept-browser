#!/usr/bin/env node
/**
 * fetch-datasets.mjs — Load datasets from .gcr files or clone source repos.
 *
 * Reads datasets.yml, for each dataset:
 *   1. If .gcr/{id}.gcr exists, extract to .datasets/{id}/
 *   2. Else clone/update source repo into .datasets/{id}/
 *   3. Harmonize concept YAML files to canonical format (if from repo)
 *
 * Supports DATASET_SOURCE_{ID} env var to override with local path.
 * Supports GITHUB_TOKEN for private repos.
 *
 * Usage: node scripts/fetch-datasets.mjs
 */
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATASETS_DIR = path.join(ROOT, '.datasets');
const GCR_DIR = path.join(ROOT, '.gcr');

// --- Config loading ---
function loadConfig() {
  const configPath = path.join(ROOT, 'datasets.yml');
  if (!fs.existsSync(configPath)) {
    console.error('datasets.yml not found');
    process.exit(1);
  }
  return yaml.load(fs.readFileSync(configPath, 'utf8'));
}

// --- GCR download ---
async function downloadGcr(url, destPath) {
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  console.log(`  Downloading ${url}...`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  fs.writeFileSync(destPath, buf);
  console.log(`  Saved to ${destPath} (${(buf.length / 1024).toFixed(0)} KB)`);
}

// --- GCR extraction ---
async function extractGcr(gcrPath, targetDir) {
  // Use system unzip for speed (node built-in zip support is limited)
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  try {
    execSync(`unzip -o -q "${gcrPath}" -d "${targetDir}"`, { stdio: 'pipe' });
  } catch (e) {
    // Fallback: try python
    try {
      execSync(`python3 -c "import zipfile; zipfile.ZipFile('${gcrPath}').extractall('${targetDir}')"`, { stdio: 'pipe' });
    } catch (e2) {
      throw new Error(`Failed to extract ${gcrPath}: ${e.message}`);
    }
  }
  console.log(`  Extracted ${gcrPath} to ${targetDir}`);
}

// --- Git operations ---
function cloneOrUpdate(sourceRepo, targetDir) {
  const env = { ...process.env };
  if (env.GITHUB_TOKEN) {
    const authedUrl = sourceRepo.replace('https://', `https://x-access-token:${env.GITHUB_TOKEN}@`);
    sourceRepo = authedUrl;
  }

  if (fs.existsSync(path.join(targetDir, '.git'))) {
    console.log(`  Updating existing clone...`);
    try {
      execSync('git fetch origin', { cwd: targetDir, stdio: 'pipe', env });
      execSync('git reset --hard origin/HEAD', { cwd: targetDir, stdio: 'pipe', env });
      execSync('git clean -fd', { cwd: targetDir, stdio: 'pipe', env });
    } catch (e) {
      console.warn(`  git update failed, re-cloning: ${e.message}`);
      fs.rmSync(targetDir, { recursive: true, force: true });
      execSync(`git clone --depth 1 "${sourceRepo}" "${targetDir}"`, { stdio: 'pipe', env });
    }
  } else {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`  Cloning ${sourceRepo}...`);
    execSync(`git clone --depth 1 "${sourceRepo}" "${targetDir}"`, { stdio: 'pipe', env });
  }
}

// --- Harmonization (only for repo-sourced datasets) ---
function buildRefMaps(config) {
  const xref = config.crossReferences || {};
  return {
    refPrefixMap: xref.refPrefixMap || {},
    urnStandardMap: xref.urnStandardMap || {},
  };
}

function extractInlineRefs(localizedData, refPrefixMap, urnStandardMap) {
  const refs = [];
  const texts = [];

  if (localizedData.definition) {
    const defs = Array.isArray(localizedData.definition)
      ? localizedData.definition
      : [localizedData.definition];
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
    const datasetId = refPrefixMap['IEV'];
    if (datasetId) {
      refs.push({ id: `https://glossarist.org/${datasetId}/concept/${m[2]}`, term: m[1].trim() });
    }
  }

  const urnMatches = fullText.matchAll(/\{urn:iso:std:iso:(\d+):([^,}]+),([^}]+)\}/g);
  for (const m of urnMatches) {
    const datasetId = urnStandardMap[m[1]];
    if (datasetId) {
      refs.push({ id: `https://glossarist.org/${datasetId}/concept/${m[2]}`, term: m[3].trim() });
    }
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
    if (lc.date_accepted) {
      dates.push({ type: 'accepted', date: lc.date_accepted });
    }
    if (lc.date_amended) {
      dates.push({ type: 'amended', date: lc.date_amended });
    }
    if (dates.length > 0) {
      lc.dates = dates;
    }
  }

  if (lc.entry_status === 'Standard') {
    lc.entry_status = 'valid';
  }

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
      if (!existingIds.has(r.id)) {
        existing.push(r);
      }
    }
    lc.references = existing;
  }

  delete lc._revisions;

  return lc;
}

function harmonizeConcept(conceptYaml, refPrefixMap, urnStandardMap) {
  if (conceptYaml.termid != null) {
    conceptYaml.termid = String(conceptYaml.termid);
  }

  const langCodes = ['eng', 'ara', 'deu', 'fra', 'spa', 'ita', 'jpn', 'kor', 'pol', 'por', 'srp', 'swe', 'zho', 'rus', 'fin', 'dan', 'nld', 'msa', 'nob', 'nno'];
  for (const lang of langCodes) {
    if (conceptYaml[lang]) {
      conceptYaml[lang] = harmonizeLanguageBlock(conceptYaml[lang], refPrefixMap, urnStandardMap);
    }
  }

  return conceptYaml;
}

function harmonizeDataset(datasetDir, refPrefixMap, urnStandardMap) {
  const conceptsDir = path.join(datasetDir, 'concepts');
  if (!fs.existsSync(conceptsDir)) {
    console.warn(`  No concepts/ directory found`);
    return 0;
  }

  const files = fs.readdirSync(conceptsDir).filter(f => f.endsWith('.yaml'));
  console.log(`  Harmonizing ${files.length} concept files...`);

  let count = 0;
  let errors = 0;
  for (const file of files) {
    try {
      const filePath = path.join(conceptsDir, file);
      const content = fs.readFileSync(filePath, 'utf8');
      const concept = yaml.load(content);
      if (!concept || !concept.termid) continue;

      harmonizeConcept(concept, refPrefixMap, urnStandardMap);

      const yamlContent = yaml.dump(concept, {
        lineWidth: -1,
        noRefs: true,
        sortKeys: false,
        quotingType: '"',
        forceQuotes: false,
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
  return count;
}

// --- Main ---
console.log('Fetching glossarist datasets...\n');

const config = loadConfig();
const { refPrefixMap, urnStandardMap } = buildRefMaps(config);

for (const ds of config.datasets) {
  console.log(`${ds.id}:`);

  const gcrPath = path.join(GCR_DIR, `${ds.id}.gcr`);
  const targetDir = path.join(DATASETS_DIR, ds.id);

  // Check for local .gcr file first (fastest, no download)
  if (fs.existsSync(gcrPath)) {
    console.log(`  Using local .gcr/${ds.id}.gcr`);
    await extractGcr(gcrPath, targetDir);
    const conceptCount = fs.readdirSync(path.join(targetDir, 'concepts')).filter(f => f.endsWith('.yaml')).length;
    console.log(`  ${conceptCount} concepts (schema v1, already harmonized)`);
    console.log();
    continue;
  }

  // Download from gcrPackage URL if specified
  if (ds.gcrPackage) {
    console.log(`  Using GCR package: ${ds.gcrPackage}`);
    await downloadGcr(ds.gcrPackage, gcrPath);
    await extractGcr(gcrPath, targetDir);
    const conceptCount = fs.readdirSync(path.join(targetDir, 'concepts')).filter(f => f.endsWith('.yaml')).length;
    console.log(`  ${conceptCount} concepts (schema v1, already harmonized)`);
    console.log();
    continue;
  }

  // Check for local path override
  const envOverride = process.env[`DATASET_SOURCE_${ds.id.toUpperCase()}`];

  if (envOverride) {
    console.log(`  Using local path: ${envOverride}`);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const localConcepts = path.join(envOverride, 'concepts');
    const targetConcepts = path.join(targetDir, 'concepts');
    if (fs.existsSync(localConcepts)) {
      if (fs.existsSync(targetConcepts)) {
        fs.rmSync(targetConcepts, { recursive: true, force: true });
      }
      console.log(`  Copying concepts...`);
      execSync(`cp -r "${localConcepts}" "${targetConcepts}"`, { stdio: 'pipe' });
    }
    const registerYaml = path.join(envOverride, 'register.yaml');
    if (fs.existsSync(registerYaml)) {
      fs.copyFileSync(registerYaml, path.join(targetDir, 'register.yaml'));
    }
  } else if (ds.sourceRepo) {
    cloneOrUpdate(ds.sourceRepo, targetDir);
  } else {
    console.warn(`  No .gcr file, sourceRepo, or DATASET_SOURCE_${ds.id.toUpperCase()} env var, skipping`);
    continue;
  }

  // Harmonize concepts to canonical format (only for repo-sourced datasets)
  harmonizeDataset(targetDir, refPrefixMap, urnStandardMap);
  console.log();
}

console.log('Done.');
