#!/usr/bin/env node
/**
 * fetch-datasets.mjs — Load datasets from .gcr files or clone source repos.
 *
 * Reads site config (via load-site-config.mjs), for each dataset:
 *   1. If .gcr/{id}.gcr exists, extract to .datasets/{id}/
 *   2. Else download from gcrPackage URL and extract
 *   3. Else clone/update source repo into .datasets/{id}/
 *
 * After fetching, validates that all GCR dependencies are satisfiable
 * (either provided locally or routed externally).
 *
 * Supports DATASET_SOURCE_{ID} env var to override with local path.
 * Supports GITHUB_TOKEN for private repos.
 */
import fs from 'fs';
import path from 'path';
import { loadGcr } from 'glossarist';
import { execSync } from 'child_process';
import { loadSiteConfig } from './load-site-config.mjs';

const ROOT = process.cwd();
const DATASETS_DIR = path.join(ROOT, '.datasets');
const GCR_DIR = path.join(ROOT, '.gcr');

function matchUriPattern(uri, pattern) {
  if (!pattern.endsWith('*')) return uri === pattern;
  return uri.startsWith(pattern.slice(0, -1));
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
function extractGcr(gcrPath, targetDir) {
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  try {
    execSync(`unzip -o -q "${gcrPath}" -d "${targetDir}"`, { stdio: 'pipe' });
  } catch {
    try {
      execSync(`python3 -c "import zipfile; zipfile.ZipFile('${gcrPath}').extractall('${targetDir}')"`, { stdio: 'pipe' });
    } catch (e2) {
      throw new Error(`Failed to extract ${gcrPath}`);
    }
  }
  console.log(`  Extracted to ${targetDir}`);
}

// --- Read GCR metadata from ZIP without extraction ---
async function readGcrMetadata(gcrPath) {
  if (!fs.existsSync(gcrPath)) return null;
  try {
    const buf = fs.readFileSync(gcrPath);
    const pkg = await loadGcr(buf);
    const meta = await pkg.metadata();
    return meta ? meta.toJSON() : null;
  } catch {
    return null;
  }
}

// --- Dependency validation ---
function validateDependencies(config, gcrMetadata) {
  const errors = [];
  const allProvidedUris = [];
  for (const ds of config.datasets) {
    allProvidedUris.push(ds.uri);
    if (ds.uriAliases) allProvidedUris.push(...ds.uriAliases);
  }
  const routingUris = (config.routing || []).map(r => r.uri);

  for (const ds of config.datasets) {
    const meta = gcrMetadata[ds.id];
    if (!meta?.dependencies?.length) continue;

    for (const dep of meta.dependencies) {
      const depUri = dep.uri;
      const satisfied = [...allProvidedUris, ...routingUris].some(p => matchUriPattern(depUri, p));
      if (!satisfied) {
        errors.push(`GCR '${ds.id}' depends on '${depUri}' (${dep.refCount} refs) but no provider or route configured`);
      }
    }
  }
  return errors;
}

// --- Git operations ---
function cloneOrUpdate(sourceRepo, targetDir) {
  const env = { ...process.env };
  let repoUrl = sourceRepo;
  if (env.GITHUB_TOKEN) {
    repoUrl = sourceRepo.replace('https://', `https://x-access-token:${env.GITHUB_TOKEN}@`);
  }

  if (fs.existsSync(path.join(targetDir, '.git'))) {
    console.log(`  Updating existing clone...`);
    try {
      execSync('git fetch origin', { cwd: targetDir, stdio: 'pipe', env });
      execSync('git reset --hard origin/HEAD', { cwd: targetDir, stdio: 'pipe', env });
      execSync('git clean -fd', { cwd: targetDir, stdio: 'pipe', env });
    } catch {
      console.warn(`  git update failed, re-cloning`);
      fs.rmSync(targetDir, { recursive: true, force: true });
      execSync(`git clone --depth 1 "${repoUrl}" "${targetDir}"`, { stdio: 'pipe', env });
    }
  } else {
    fs.mkdirSync(targetDir, { recursive: true });
    console.log(`  Cloning ${sourceRepo}...`);
    execSync(`git clone --depth 1 "${repoUrl}" "${targetDir}"`, { stdio: 'pipe', env });
  }
}

// --- Main ---
console.log('Fetching glossarist datasets...\n');

const { config } = loadSiteConfig();
const gcrMetadata = {};

for (const ds of config.datasets) {
  console.log(`${ds.id}:`);

  const gcrPath = path.join(GCR_DIR, `${ds.id}.gcr`);
  const targetDir = path.join(DATASETS_DIR, ds.id);

  try {
    if (fs.existsSync(gcrPath)) {
      console.log(`  Using local .gcr/${ds.id}.gcr`);
      extractGcr(gcrPath, targetDir);
    } else if (ds.gcrPackage) {
      console.log(`  Using GCR package: ${ds.gcrPackage}`);
      try {
        await downloadGcr(ds.gcrPackage, gcrPath);
      } catch (e) {
        console.warn(`  GCR download failed: ${e.message}`);
        console.warn(`  Skipping ${ds.id}`);
        console.log();
        continue;
      }
      extractGcr(gcrPath, targetDir);
    } else {
      const envOverride = process.env[`DATASET_SOURCE_${ds.id.toUpperCase()}`] || ds.localPath;
      if (envOverride) {
        console.log(`  Using local path: ${envOverride}`);
        if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
        const localConcepts = path.join(envOverride, 'concepts');
        const targetConcepts = path.join(targetDir, 'concepts');
        if (fs.existsSync(localConcepts)) {
          if (fs.existsSync(targetConcepts)) fs.rmSync(targetConcepts, { recursive: true, force: true });
          execSync(`cp -r "${localConcepts}" "${targetConcepts}"`, { stdio: 'pipe' });
        }
        const registerYaml = path.join(envOverride, 'register.yaml');
        if (fs.existsSync(registerYaml)) {
          fs.copyFileSync(registerYaml, path.join(targetDir, 'register.yaml'));
        }
      } else if (ds.sourceRepo) {
        cloneOrUpdate(ds.sourceRepo, targetDir);
      } else {
        console.warn(`  No source configured, skipping`);
        console.log();
        continue;
      }
    }

    // Read metadata for dependency validation (from GCR ZIP, not extracted dir)
    const meta = await readGcrMetadata(gcrPath);
    if (meta) {
      gcrMetadata[ds.id] = meta;
      console.log(`  ${meta.concept_count || '?'} concepts, ${meta.uri_prefix || 'no uri'}`);
    }
  } catch (e) {
    console.warn(`  Failed: ${e.message}`);
    console.warn(`  Skipping ${ds.id}`);
  }
  console.log();
}

// Dependency validation
console.log('Validating dependencies...\n');
const errors = validateDependencies(config, gcrMetadata);
if (errors.length) {
  console.error('Dependency validation FAILED:');
  for (const err of errors) {
    console.error(`  ✗ ${err}`);
  }
  process.exit(1);
}
console.log('All dependencies satisfied.\n');

console.log('Done.');
