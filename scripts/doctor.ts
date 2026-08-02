#!/usr/bin/env node
// `concept-browser doctor` — environment diagnostic.
//
// Runs a series of independent checks (Node version, dependencies,
// datasets registered / fetched / generated, SHACL shapes, JSON-LD
// context) and prints a pass/fail summary. Exits non-zero if any
// check fails.
//
// See docs/adr/0005-shacl-validation-gate.md and
// TODO.streamline/15-tooling-and-developer-experience.md §O1.

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG_ROOT = resolve(__dirname, '..');

export const NODE_MIN_MAJOR = 18;

/**
 * @typedef {'pass'|'fail'|'warn'} CheckStatus
 * @typedef {{ id: string, label: string, status: CheckStatus, detail?: string, hint?: string }} CheckResult
 * @typedef {{ cwd: string, pkgRoot: string, datasetsYml?: any, datasetsYmlError?: string }} DoctorContext
 */

/**
 * Wrap a check so an unexpected throw becomes a fail result, and
 * preserve the check's `id` as the wrapper's `name` so callers can
 * reason about the registry without anonymous arrows.
 *
 * @param {string} id
 * @param {() => (Promise<CheckResult> | CheckResult)} check
 * @returns {(ctx: DoctorContext) => Promise<CheckResult>}
 */
function safe(id, check) {
  const wrapped = async (ctx) => {
    try {
      return await check(ctx);
    } catch (err) {
      return {
        id: 'unexpected',
        label: 'Unexpected error',
        status: 'fail',
        detail: err?.message ?? String(err),
      };
    }
  };
  Object.defineProperty(wrapped, 'name', { value: id });
  return wrapped;
}

function nodeVersionCheck() {
  const major = Number.parseInt(process.versions.node.split('.')[0], 10);
  return {
    id: 'node-version',
    label: `Node.js v${process.versions.node}`,
    status: major >= NODE_MIN_MAJOR ? 'pass' : 'fail',
    detail: major < NODE_MIN_MAJOR ? `requires >= v${NODE_MIN_MAJOR}` : undefined,
    hint: major < NODE_MIN_MAJOR ? 'upgrade via nvm or your package manager' : undefined,
  };
}

function packageDepsCheck(ctx) {
  const nm = resolve(ctx.pkgRoot, 'node_modules');
  if (!existsSync(nm)) {
    return {
      id: 'package-deps',
      label: 'Dependencies installed',
      status: 'fail',
      detail: 'node_modules missing',
      hint: 'run `npm install`',
    };
  }
  const required = ['vue', 'vue-router', 'pinia', 'vite', 'n3', 'glossarist', '@rdfjs/dataset'];
  const missing = required.filter((p) => !existsSync(join(nm, p)));
  if (missing.length) {
    return {
      id: 'package-deps',
      label: 'Dependencies installed',
      status: 'fail',
      detail: `missing: ${missing.join(', ')}`,
      hint: 'run `npm install`',
    };
  }
  return { id: 'package-deps', label: 'Dependencies installed', status: 'pass' };
}

function datasetsYmlCheck(ctx) {
  const path = resolve(ctx.cwd, 'datasets.yml');
  if (!existsSync(path)) {
    return {
      id: 'datasets-yml',
      label: 'datasets.yml present',
      status: 'warn',
      detail: 'file not found at project root',
      hint: 'datasets.yml registers every dataset the browser serves',
    };
  }
  if (ctx.datasetsYmlError) {
    return {
      id: 'datasets-yml',
      label: 'datasets.yml parses',
      status: 'fail',
      detail: ctx.datasetsYmlError,
      hint: 'fix the YAML syntax error',
    };
  }
  const datasets = ctx.datasetsYml?.datasets;
  if (!Array.isArray(datasets) || datasets.length === 0) {
    return {
      id: 'datasets-yml',
      label: 'datasets.yml lists datasets',
      status: 'warn',
      detail: '`datasets` key is empty or missing',
      hint: 'add at least one dataset entry; see docs/adding-a-dataset.md',
    };
  }
  return {
    id: 'datasets-yml',
    label: `datasets.yml lists ${datasets.length} dataset(s)`,
    status: 'pass',
  };
}

function datasetsFetchedCheck(ctx) {
  const datasets = ctx.datasetsYml?.datasets ?? [];
  if (!datasets.length) {
    return { id: 'datasets-fetched', label: 'Source datasets fetched', status: 'warn', detail: 'no datasets registered' };
  }
  const dotDatasets = resolve(ctx.cwd, '.datasets');
  const missing = datasets
    .filter((d) => !existsSync(join(dotDatasets, d.id, 'concepts')))
    .map((d) => d.id);
  if (missing.length) {
    return {
      id: 'datasets-fetched',
      label: 'Source datasets fetched',
      status: 'fail',
      detail: `.datasets/ missing: ${missing.join(', ')}`,
      hint: 'run `npm run fetch-datasets`',
    };
  }
  return { id: 'datasets-fetched', label: 'Source datasets fetched', status: 'pass' };
}

function datasetsGeneratedCheck(ctx) {
  const datasets = ctx.datasetsYml?.datasets ?? [];
  if (!datasets.length) {
    return { id: 'datasets-generated', label: 'Generated data present', status: 'warn', detail: 'no datasets registered' };
  }
  const publicData = resolve(ctx.cwd, 'public', 'data');
  const missing = datasets
    .filter((d) => !existsSync(join(publicData, d.id, 'manifest.json')))
    .map((d) => d.id);
  if (missing.length) {
    return {
      id: 'datasets-generated',
      label: 'Generated data present',
      status: 'fail',
      detail: `public/data/ missing manifest for: ${missing.join(', ')}`,
      hint: 'run `npm run generate-data`',
    };
  }
  return { id: 'datasets-generated', label: 'Generated data present', status: 'pass' };
}

function publicDatasetsJsonCheck(ctx) {
  const path = resolve(ctx.cwd, 'public', 'datasets.json');
  if (!existsSync(path)) {
    return {
      id: 'public-datasets-json',
      label: 'public/datasets.json present',
      status: 'fail',
      hint: 'run `npm run generate-data`',
    };
  }
  try {
    const doc = JSON.parse(readFileSync(path, 'utf8'));
    if (!Array.isArray(doc) || doc.length === 0) {
      return {
        id: 'public-datasets-json',
        label: 'public/datasets.json non-empty',
        status: 'warn',
        detail: 'datasets list is empty',
      };
    }
    return { id: 'public-datasets-json', label: 'public/datasets.json parses', status: 'pass' };
  } catch (err) {
    return {
      id: 'public-datasets-json',
      label: 'public/datasets.json parses',
      status: 'fail',
      detail: err.message,
    };
  }
}

function shaclShapesCheck(ctx) {
  const shapesPath = resolve(ctx.pkgRoot, 'data', 'concept-model', 'shapes', 'glossarist.shacl.ttl');
  if (!existsSync(shapesPath)) {
    return {
      id: 'shacl-shapes',
      label: 'SHACL shapes present',
      status: 'fail',
      hint: 'run `npm run sync:model` to vendor shapes from concept-model',
    };
  }
  const ttl = readFileSync(shapesPath, 'utf8');
  const looksLikeShapes = /sh:\s*(NodeShape|PropertyShape|targetClass)/.test(ttl) || /a\s+sh:NodeShape/.test(ttl);
  if (!looksLikeShapes) {
    return {
      id: 'shacl-shapes',
      label: 'SHACL shapes well-formed',
      status: 'fail',
      detail: 'file exists but does not declare any sh:NodeShape',
      hint: 're-sync from glossarist/concept-model',
    };
  }
  return { id: 'shacl-shapes', label: 'SHACL shapes present', status: 'pass' };
}

function jsonldContextCheck(ctx) {
  const ctxPath = resolve(ctx.pkgRoot, 'data', 'concept-model', 'glossarist.context.jsonld');
  if (!existsSync(ctxPath)) {
    return {
      id: 'jsonld-context',
      label: 'JSON-LD context present',
      status: 'fail',
      hint: 'run `npm run sync:model` to vendor the context',
    };
  }
  try {
    const doc = JSON.parse(readFileSync(ctxPath, 'utf8'));
    if (!doc['@context'] || typeof doc['@context'] !== 'object') {
      return {
        id: 'jsonld-context',
        label: 'JSON-LD context well-formed',
        status: 'fail',
        detail: 'missing or invalid @context key',
      };
    }
    return { id: 'jsonld-context', label: 'JSON-LD context present', status: 'pass' };
  } catch (err) {
    return {
      id: 'jsonld-context',
      label: 'JSON-LD context parses',
      status: 'fail',
      detail: err.message,
    };
  }
}

/** @type {Array<(ctx: DoctorContext) => (Promise<CheckResult> | CheckResult)>} */
export const CHECKS = [
  safe('node-version', nodeVersionCheck),
  safe('package-deps', packageDepsCheck),
  safe('datasets-yml', datasetsYmlCheck),
  safe('datasets-fetched', datasetsFetchedCheck),
  safe('datasets-generated', datasetsGeneratedCheck),
  safe('public-datasets-json', publicDatasetsJsonCheck),
  safe('shacl-shapes', shaclShapesCheck),
  safe('jsonld-context', jsonldContextCheck),
];

/**
 * @param {string} [cwd]
 * @returns {Promise<{ results: CheckResult[], exitCode: number }>}
 */
export async function runDoctor(cwd = process.cwd()) {
  const datasetsYmlPath = resolve(cwd, 'datasets.yml');
  let datasetsYml;
  let datasetsYmlError;
  if (existsSync(datasetsYmlPath)) {
    try {
      datasetsYml = yaml.load(readFileSync(datasetsYmlPath, 'utf8'));
    } catch (err) {
      datasetsYmlError = err.message;
    }
  }
  /** @type {DoctorContext} */
  const ctx = { cwd, pkgRoot: PKG_ROOT, datasetsYml, datasetsYmlError };

  const results = [];
  for (const check of CHECKS) {
    results.push(await check(ctx));
  }
  const failed = results.filter((r) => r.status === 'fail').length;
  const exitCode = failed > 0 ? 1 : 0;
  return { results, exitCode };
}

const STATUS_GLYPH = { pass: '✓', fail: '✗', warn: '!' };

/**
 * @param {CheckResult[]} results
 * @returns {string}
 */
export function formatResults(results) {
  const lines = [];
  for (const r of results) {
    lines.push(`${STATUS_GLYPH[r.status]} ${r.label}`);
    if (r.detail) lines.push(`    ${r.detail}`);
    if (r.hint) lines.push(`    → ${r.hint}`);
  }
  const pass = results.filter((r) => r.status === 'pass').length;
  const fail = results.filter((r) => r.status === 'fail').length;
  const warn = results.filter((r) => r.status === 'warn').length;
  lines.push('');
  lines.push(`${pass} passed, ${fail} failed, ${warn} warnings (${results.length} total)`);
  return lines.join('\n');
}

export async function main() {
  const { results, exitCode } = await runDoctor();
  console.log(formatResults(results));
  process.exit(exitCode);
}

// Run when invoked directly as a script.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
