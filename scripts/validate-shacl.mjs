#!/usr/bin/env node
// SHACL validation gate for concept-browser's data pipeline.
//
// Walks `public/data/` (or any directory passed as argv[2]), parses every
// `.ttl` file, and validates it against the canonical SHACL shapes from
// `@glossarist/concept-model`. Fails the build on any violation.
//
// Usage:
//   node scripts/validate-shacl.mjs                  # validates public/data
//   node scripts/validate-shacl.mjs path/to/dir      # validates a custom dir
//   SHAPES_PATH=/path/to/shapes.ttl node scripts/validate-shacl.mjs
//                                                     # uses a custom shapes file
//
// The shapes path defaults to the file inside the installed
// `@glossarist/concept-model` package. If the package isn't installed
// (e.g. during early development before concept-model is published), set
// SHAPES_PATH explicitly or pass --shapes <path>.

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser as N3Parser, DataFactory } from 'n3';
import rdfDataset from '@rdfjs/dataset';
import ShaclValidator from 'rdf-validate-shacl';

const COMBINED_FACTORY = {
  namedNode: DataFactory.namedNode,
  blankNode: DataFactory.blankNode,
  literal: DataFactory.literal,
  defaultGraph: DataFactory.defaultGraph,
  quad: DataFactory.quad,
  fromTerm: DataFactory.fromTerm,
  fromQuad: DataFactory.fromQuad,
  dataset: rdfDataset.dataset.bind(rdfDataset),
};
const createDataset = COMBINED_FACTORY.dataset;
const ShaclValidatorCtor = ShaclValidator.default ?? ShaclValidator;

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
                    shapes from @glossarist/concept-model).
  --help, -h        Show this help.

Environment:
  SHAPES_PATH       Same as --shapes. Lower priority than the CLI flag.

Default data-root is public/data.
`;

async function resolveShapesPath(cliPath) {
  if (cliPath) return cliPath;
  try {
    const metaUrl = await import.meta.resolve('@glossarist/concept-model/ontologies/shapes/glossarist.shacl.ttl');
    return fileURLToPath(metaUrl);
  } catch (e) {
    throw new Error(
      `Could not resolve the SHACL shapes from @glossarist/concept-model.\n` +
      `Install the package, or pass --shapes <path>, or set SHAPES_PATH=<path>.\n` +
      `Underlying error: ${e.message}`,
    );
  }
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
  const shapesPath = await resolveShapesPath(args.shapesPath);

  let shapesDataset;
  try {
    const shapesText = readFileSync(shapesPath, 'utf8');
    shapesDataset = await parseTurtle(shapesText, `file://${shapesPath}`);
  } catch (e) {
    console.error(`Failed to load SHACL shapes from ${shapesPath}: ${e.message}`);
    process.exit(2);
  }

  const validator = new ShaclValidatorCtor(shapesDataset, { factory: COMBINED_FACTORY });

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
    const report = validator.validate(graph);
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
