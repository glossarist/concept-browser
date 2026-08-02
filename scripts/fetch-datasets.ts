#!/usr/bin/env node
/**
 * fetch-datasets.mjs — Load datasets from .gcr files, local paths, or git repos.
 *
 * Reads site config (via load-site-config.mjs), for each dataset:
 *   1. If .gcr/{id}.gcr exists, extract to .datasets/{id}/
 *   2. Else download from gcrPackage URL and extract
 *   3. Else if localPath is set, use it in-place (NO copy, NO staging)
 *   4. Else clone/update source repo into .datasets/{id}/
 *
 * After fetching, validates that all GCR dependencies are satisfiable
 * (either provided locally or routed externally).
 *
 * No shell commands. All file ops use Node fs; ZIP uses JSZip; git uses
 * execFileSync with array args (no shell interpolation).
 */
import fs from 'fs';
import path from 'path';
import JSZip from 'jszip';
import { loadGcr } from 'glossarist';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { loadSiteConfig } from './load-site-config';
import { assertLocalPathSafe } from './lib/local-path-safety';const ROOT = process.cwd();
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

// --- GCR extraction (pure JSZip; no shell, cross-platform) ---
async function extractGcr(gcrPath, targetDir) {
  const targetAbs = path.resolve(targetDir);
  if (fs.existsSync(targetAbs)) {
    fs.rmSync(targetAbs, { recursive: true, force: true });
  }
  fs.mkdirSync(targetAbs, { recursive: true });

  const buf = fs.readFileSync(gcrPath);
  const zip = await JSZip.loadAsync(buf);
  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    // zip-slip guard: refuse entries that escape targetDir
    const dest = path.resolve(targetAbs, entry.name);
    if (dest !== targetAbs && !dest.startsWith(targetAbs + path.sep)) {
      throw new Error(`Refusing to extract entry outside target dir: ${entry.name}`);
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const content = await entry.async('nodebuffer');
    fs.writeFileSync(dest, content);
  }
  console.log(`  Extracted to ${targetAbs}`);
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

// --- Git operations (execFileSync with array args — no shell) ---
function cloneOrUpdate(sourceRepo, targetDir) {
  const env = { ...process.env };
  let repoUrl = sourceRepo;
  if (env.GITHUB_TOKEN) {
    repoUrl = sourceRepo.replace('https://', `https://x-access-token:${env.GITHUB_TOKEN}@`);
  }

  const targetAbs = path.resolve(targetDir);

  if (fs.existsSync(path.join(targetAbs, '.git'))) {
    console.log(`  Updating existing clone...`);
    try {
      execFileSync('git', ['fetch', 'origin'], { cwd: targetAbs, stdio: 'pipe', env });
      execFileSync('git', ['reset', '--hard', 'origin/HEAD'], { cwd: targetAbs, stdio: 'pipe', env });
      execFileSync('git', ['clean', '-fd'], { cwd: targetAbs, stdio: 'pipe', env });
    } catch {
      console.warn(`  git update failed, re-cloning`);
      fs.rmSync(targetAbs, { recursive: true, force: true });
      execFileSync('git', ['clone', '--depth', '1', repoUrl, targetAbs], { stdio: 'pipe', env });
    }
  } else {
    fs.mkdirSync(targetAbs, { recursive: true });
    console.log(`  Cloning ${sourceRepo}...`);
    execFileSync('git', ['clone', '--depth', '1', repoUrl, targetAbs], { stdio: 'pipe', env });
  }
}

// --- localPath safety check: see scripts/lib/local-path-safety.mjs ---

// --- Main ---
export async function main() {
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
        await extractGcr(gcrPath, targetDir);
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
        await extractGcr(gcrPath, targetDir);
      } else if (ds.localPath) {
        // localPath means "data is here, use in-place." No copy, no staging.
        // generate-data.mjs reads from localPath directly via datasetDir(ds).
        const localResolved = assertLocalPathSafe(ds.id, ds.localPath);
        console.log(`  Using localPath in-place: ${localResolved}`);
      } else if (ds.sourceRepo) {
        cloneOrUpdate(ds.sourceRepo, targetDir);
      } else {
        console.warn(`  No source configured, skipping`);
        console.log();
        continue;
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
}

const isDirectInvocation = process.argv[1]
  && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url));
if (isDirectInvocation) {
  await main();
}
