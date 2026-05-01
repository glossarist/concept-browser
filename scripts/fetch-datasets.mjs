#!/usr/bin/env node
/**
 * fetch-datasets.mjs — Load datasets from .gcr files or clone source repos.
 *
 * Reads datasets.yml, for each dataset:
 *   1. If .gcr/{id}.gcr exists, extract to .datasets/{id}/
 *   2. Else download from gcrPackage URL and extract
 *   3. Else clone/update source repo into .datasets/{id}/
 *
 * GCR packages are pre-harmonized by the glossarist Ruby gem.
 * Harmonization is NOT done here — it's the glossary repos' responsibility.
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
  if (fs.existsSync(targetDir)) {
    fs.rmSync(targetDir, { recursive: true, force: true });
  }
  fs.mkdirSync(targetDir, { recursive: true });

  try {
    execSync(`unzip -o -q "${gcrPath}" -d "${targetDir}"`, { stdio: 'pipe' });
  } catch (e) {
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

// --- Main ---
console.log('Fetching glossarist datasets...\n');

const config = loadConfig();

for (const ds of config.datasets) {
  console.log(`${ds.id}:`);

  const gcrPath = path.join(GCR_DIR, `${ds.id}.gcr`);
  const targetDir = path.join(DATASETS_DIR, ds.id);

  try {
    // Check for local .gcr file first (fastest, no download)
    if (fs.existsSync(gcrPath)) {
      console.log(`  Using local .gcr/${ds.id}.gcr`);
      await extractGcr(gcrPath, targetDir);
      const conceptCount = fs.readdirSync(path.join(targetDir, 'concepts')).filter(f => f.endsWith('.yaml')).length;
      console.log(`  ${conceptCount} concepts`);
      console.log();
      continue;
    }

    // Download from gcrPackage URL if specified
    if (ds.gcrPackage) {
      console.log(`  Using GCR package: ${ds.gcrPackage}`);
      try {
        await downloadGcr(ds.gcrPackage, gcrPath);
      } catch (e) {
        console.warn(`  GCR download failed: ${e.message}`);
        console.warn(`  Skipping ${ds.id}`);
        console.log();
        continue;
      }
      await extractGcr(gcrPath, targetDir);
      const conceptCount = fs.readdirSync(path.join(targetDir, 'concepts')).filter(f => f.endsWith('.yaml')).length;
      console.log(`  ${conceptCount} concepts`);
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
      console.log();
      continue;
    }

    // Note: harmonization is NOT done here. GCR packages are pre-harmonized.
    // If using repo source, concepts should already be in schema v1 format.
  } catch (e) {
    console.warn(`  Failed: ${e.message}`);
    console.warn(`  Skipping ${ds.id}`);
  }
  console.log();
}

console.log('Done.');
