#!/usr/bin/env node
// SHACL validation gate for concept-browser's data pipeline.
//
// Walks `public/data/` (or any directory passed as argv[2]), parses every
// `.ttl` file, and validates it against the vendored SHACL shapes. Fails
// the build on any violation.
//
// Usage:
//   node scripts/validate-shacl.mjs                  # validates public/data
//   node scripts/validate-shacl.mjs path/to/dir      # validates a custom dir
//   SHAPES_PATH=/path/to/shapes.ttl node scripts/validate-shacl.mjs
//                                                     # uses a custom shapes file
//
// The shapes path defaults to the vendored file at
// `data/concept-model/shapes/glossarist.shacl.ttl` (synced from
// glossarist/concept-model via `npm run sync:model`). Pass --shapes <path>
// or set SHAPES_PATH to override.
//
// Delegates the actual validation to glossarist-js's validateShacl
// wrapper, which handles factory aggregation and shapes caching. The
// directory walk + CLI parsing stay here because they're build-pipeline
// specific.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser as N3Parser } from 'n3';
import rdfDataset from '@rdfjs/dataset';
import { validateShacl, quadsToDataset } from 'glossarist/rdf/shacl';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VENDORED_SHAPES = resolve(__dirname, '..', 'data', 'concept-model', 'shapes', 'glossarist.shacl.ttl');

const createDataset = rdfDataset.dataset.bind(rdfDataset);

function parseArgs(argv) {
  const out = { dataRoot: 'public/data', shapesPath: null };
  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--shapes') {
      out.shapesPath = argv[++i];
      if (!out.shapesPath) throw new Error('--shapes requires a path argument');
    } else if (arg === '--help' || arg === '-h') {
      console.log(USAGE);
      process.exit(0);
    } else {
      out.dataRoot = arg;
    }
  }
  if (process.env.SHAPES_PATH && !out.shapesPath) {
    out.shapesPath = process.env.SHAPES_PATH;
  }
  return out;
}

const USAGE = `Usage: validate-shacl.mjs [options] [data-root]

Options:
  --shapes <path>   Path to a SHACL shapes .ttl file (overrides the default
                    vendored shapes under data/concept-model/shapes/).
  --help, -h        Show this help.

Environment:
  SHAPES_PATH       Same as --shapes. Lower priority than the CLI flag.

Default data-root is public/data.
`;

function resolveShapesPath(cliPath) {
  if (cliPath) return cliPath;
  if (!statSync(VENDORED_SHAPES, { throwIfNoEntry: false })) {
    throw new Error(
      `Vendored SHACL shapes not found at ${VENDORED_SHAPES}.\n` +
      `Run \`npm run sync:model\` to fetch them from glossarist/concept-model, ` +
      `or pass --shapes <path>, or set SHAPES_PATH=<path>.`,
    );
  }
  return VENDORED_SHAPES;
}

function parseTurtle(text, baseIri) {
  const parser = new N3Parser({ baseIRI: baseIri });
  const out = createDataset();
  return new Promise((resolve, reject) => {
    parser.parse(text, (err, quad) => {
      if (err) reject(err);
      else if (quad) out.add(quad);
      else resolve(out);
    });
  });
}

function* walkTtl(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) yield* walkTtl(full);
    else if (extname(full) === '.ttl') yield full;
  }
}

function formatViolation(v) {
  const focus = v.focusNode?.value ?? '(unknown)';
  const shape = v.shape?.value ?? '(unknown)';
  const path = v.path?.value ?? '';
  const message = (v.message && v.message.length > 0)
    ? v.message.map(m => m.value).join('; ')
    : '(no message)';
  const pathPart = path ? `\n    path:    ${path}` : '';
  return `    shape:   ${shape}${pathPart}\n    node:    ${focus}\n    message: ${message}`;
}

async function main() {
  const args = parseArgs(process.argv);
  const shapesPath = resolveShapesPath(args.shapesPath);

  // Pre-parse the shapes file once so we can pass it explicitly via the
  // { shapes } option. glossarist-js caches by path internally, but
  // passing the dataset directly avoids a re-read of the file when the
  // same path is reused for every validation call.
  let shapesDataset;
  try {
    const shapesText = readFileSync(shapesPath, 'utf8');
    shapesDataset = await parseTurtle(shapesText, `file://${shapesPath}`);
  } catch (e) {
    console.error(`Failed to load SHACL shapes from ${shapesPath}: ${e.message}`);
    process.exit(2);
  }

  let statDir;
  try {
    statDir = statSync(args.dataRoot);
  } catch (e) {
    console.error(`Data root not found: ${args.dataRoot}`);
    process.exit(2);
  }
  if (!statDir.isDirectory()) {
    console.error(`Data root is not a directory: ${args.dataRoot}`);
    process.exit(2);
  }

  const files = [...walkTtl(args.dataRoot)];
  if (files.length === 0) {
    console.log(`No .ttl files under ${args.dataRoot} — SHACL gate skipped.`);
    return;
  }

  const violations = [];
  for (const path of files) {
    let graph;
    try {
      const text = readFileSync(path, 'utf8');
      graph = await parseTurtle(text, `file://${path}`);
    } catch (e) {
      violations.push({ path, parseError: e.message });
      continue;
    }
    const report = await validateShacl(graph, { shapes: shapesDataset });
    if (!report.conforms) {
      for (const v of report.results) {
        violations.push({ path, result: v });
      }
    }
  }

  if (violations.length === 0) {
    console.log(`SHACL validation passed — ${files.length} file(s) conform.`);
    return;
  }

  console.error(`SHACL validation FAILED — ${violations.length} violation(s) in ${files.length} file(s):\n`);
  let currentPath = null;
  for (const v of violations) {
    if (v.path !== currentPath) {
      currentPath = v.path;
      console.error(`\n  ${v.path}`);
    }
    if (v.parseError) {
      console.error(`    PARSE ERROR: ${v.parseError}`);
    } else {
      console.error(formatViolation(v.result));
    }
  }
  console.error('');
  process.exit(1);
}

main().catch((e) => {
  console.error(`validate-shacl: unexpected error: ${e.stack ?? e}`);
  process.exit(2);
});
