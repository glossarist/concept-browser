#!/usr/bin/env node
/**
 * build-gcr.mjs — Build a GCR package from a harmonized dataset directory.
 *
 * Usage:
 *   node scripts/build-gcr.mjs <dataset-dir> -o <output.gcr>
 *   node scripts/build-gcr.mjs --all          # build all from datasets.yml
 *
 * The input directory must contain:
 *   - concepts/*.yaml  (harmonized concept files)
 *   - register.yaml    (optional, dataset metadata)
 *
 * The output is a ZIP archive with:
 *   - metadata.yaml    (statistics + provenance)
 *   - register.yaml    (copied from source)
 *   - concepts/*.yaml   (harmonized concept files)
 */
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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

      const langCodes = ['eng', 'ara', 'deu', 'fra', 'spa', 'ita', 'jpn', 'kor', 'pol', 'por', 'srp', 'swe', 'zho', 'rus', 'fin', 'dan', 'nld', 'msa', 'nob', 'nno'];
      let hasDef = false;
      let hasSource = false;

      for (const lang of langCodes) {
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

function buildMetadata(opts, stats) {
  const meta = {
    title: opts.title || 'Untitled Dataset',
    description: opts.description || '',
    glossarist_version: 'browser-pipeline',
    created_at: new Date().toISOString(),
    created_by: 'glossarist-vocabulary-browser build-gcr',
    statistics: stats,
    schema_version: '1.0.0',
  };

  if (opts.owner) meta.owner = opts.owner;
  if (opts.homepage) meta.homepage = opts.homepage;
  if (opts.repository) meta.repository = opts.repository;
  if (opts.tags) meta.tags = opts.tags;

  return meta;
}

function buildGcr(datasetDir, outputPath, opts = {}) {
  const conceptsDir = path.join(datasetDir, 'concepts');
  if (!fs.existsSync(conceptsDir)) {
    throw new Error(`No concepts/ directory in ${datasetDir}`);
  }

  const registerYaml = path.join(datasetDir, 'register.yaml');
  const stagingDir = path.join(ROOT, '.gcr-staging', path.basename(outputPath, '.gcr'));

  // Prepare staging
  if (fs.existsSync(stagingDir)) fs.rmSync(stagingDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(stagingDir, 'concepts'), { recursive: true });

  // Collect stats
  const stats = collectStats(conceptsDir);
  console.log(`  ${stats.concept_count} concepts, ${stats.languages.length} languages`);

  // Write metadata.yaml
  const metadata = buildMetadata(opts, stats);
  fs.writeFileSync(
    path.join(stagingDir, 'metadata.yaml'),
    yaml.dump(metadata, { lineWidth: -1, noRefs: true })
  );

  // Copy register.yaml
  if (fs.existsSync(registerYaml)) {
    fs.copyFileSync(registerYaml, path.join(stagingDir, 'register.yaml'));
  }

  // Copy concept files
  const conceptFiles = fs.readdirSync(conceptsDir).filter(f => f.endsWith('.yaml'));
  for (const f of conceptFiles) {
    fs.copyFileSync(path.join(conceptsDir, f), path.join(stagingDir, 'concepts', f));
  }

  // Build ZIP
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
  if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

  execSync(`cd "${stagingDir}" && zip -r -q "${path.resolve(outputPath)}" .`, { stdio: 'pipe' });

  // Cleanup staging
  fs.rmSync(stagingDir, { recursive: true, force: true });

  const size = fs.statSync(outputPath).size;
  console.log(`  Built ${outputPath} (${(size / 1024).toFixed(0)} KB)`);
}

// --- CLI ---
const args = process.argv.slice(2);
const allMode = args.includes('--all');

if (allMode) {
  // Build all datasets from datasets.yml
  const configPath = path.join(ROOT, 'datasets.yml');
  const config = yaml.load(fs.readFileSync(configPath, 'utf8'));
  const datasetsDir = path.join(ROOT, '.datasets');
  const gcrDir = path.join(ROOT, '.gcr');

  for (const ds of config.datasets) {
    const datasetDir = path.join(datasetsDir, ds.id);
    const outputPath = path.join(gcrDir, `${ds.id}.gcr`);

    if (!fs.existsSync(path.join(datasetDir, 'concepts'))) {
      console.log(`${ds.id}: no concepts/ directory, skipping`);
      continue;
    }

    console.log(`${ds.id}:`);
    buildGcr(datasetDir, outputPath, {
      title: ds.title,
      description: ds.description,
      owner: ds.owner,
      homepage: ds.existingSiteUrl,
      repository: ds.sourceRepo,
      tags: ds.tags,
    });
  }
} else {
  // Build single dataset
  let datasetDir = null;
  let outputPath = null;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '-o' && args[i + 1]) {
      outputPath = args[++i];
    } else if (!datasetDir) {
      datasetDir = args[i];
    }
  }

  if (!datasetDir || !outputPath) {
    console.error('Usage: node scripts/build-gcr.mjs <dataset-dir> -o <output.gcr>');
    console.error('       node scripts/build-gcr.mjs --all');
    process.exit(1);
  }

  buildGcr(datasetDir, outputPath);
}

console.log('\nDone.');
