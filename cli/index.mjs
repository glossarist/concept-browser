#!/usr/bin/env node
// Thin ESM shim so `concept-browser` bin works from npm consumers that
// don't run TypeScript natively. The real logic lives in cli/index.ts.
// This shim uses tsx to load the .ts entry point at runtime.
// When TODO.typescript/03 is complete, this shim may be replaced by a
// compiled cli/index.js output.
import { fileURLToPath } from 'url';
import { resolve, dirname } from 'path';
import { spawnSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const entry = resolve(__dirname, 'index.ts');

const result = spawnSync(
  process.execPath,
  ['--import', 'tsx', entry, ...process.argv.slice(2)],
  { stdio: 'inherit', cwd: process.cwd() }
);

process.exit(result.status ?? 1);
