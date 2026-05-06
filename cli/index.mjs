#!/usr/bin/env node

/**
 * Glossarist Concept Browser CLI.
 *
 * Commands:
 *   fetch      Fetch/update datasets (from GCR packages or source repos)
 *   generate   Convert harmonized YAML concepts to JSON-LD static files
 *   edges      Build cross-reference edges from generated concept data
 *   build      Full pipeline: fetch + generate + edges + vite build
 *   site       Same as build (alias)
 *
 * Options:
 *   --site <id>  Site config to use (looks for site-config.yml in CWD)
 *
 * Environment:
 *   SITE_CONFIG          Path to site config file (overrides --site)
 *   SITE_ID              Site config ID (overrides --site)
 *   GITHUB_TOKEN         GitHub token for private repos
 *   DATASET_SOURCE_{ID}  Override dataset source with local path
 */

import { loadSiteConfig } from '../scripts/load-site-config.mjs';
import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');

const commands = {
  fetch: () => import('../scripts/fetch-datasets.mjs'),
  generate: () => import('../scripts/generate-data.mjs'),
  edges: () => import('../scripts/build-edges.js'),
};

function parseArgs(argv) {
  const positional = [];
  const named = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && i + 1 < argv.length) {
      named[argv[i].slice(2)] = argv[i + 1];
      i++;
    } else if (!argv[i].startsWith('-')) {
      positional.push(argv[i]);
    }
  }
  return { positional, named };
}

async function main() {
  const args = process.argv.slice(2);
  const { positional, named } = parseArgs(args);
  const cmd = positional[0];

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`concept-browser <command> [options]

Commands:
  fetch      Fetch/update datasets from GCR packages or source repos
  generate   Convert YAML concepts to JSON-LD static data
  edges      Build cross-reference edges from generated concepts
  build      Full pipeline (fetch + generate + edges + vite build)
  site       Same as build

Options:
  --site <id>  Site config ID (looks for site-config.yml in CWD)

Environment:
  SITE_CONFIG          Site config file path (highest priority)
  SITE_ID              Site config ID (same as --site)
  GITHUB_TOKEN         GitHub token for private repos
  DATASET_SOURCE_{ID}  Override dataset source with local path`);
    process.exit(cmd ? 0 : 1);
  }

  // Pre-load site config so scripts can use it
  if (!process.env.SITE_CONFIG && !process.env.SITE_ID && named.site) {
    process.env.SITE_ID = named.site;
  }
  loadSiteConfig(named.site ? [named.site] : []);

  if (cmd === 'build' || cmd === 'site') {
    for (const step of ['fetch', 'generate', 'edges']) {
      console.log(`\n=== ${step.toUpperCase()} ===\n`);
      await commands[step]();
    }

    // Run vite build using the package's vite.config.ts
    console.log(`\n=== BUILD SPA ===\n`);
    const viteConfig = resolve(pkgRoot, 'vite.config.ts');
    execSync(`npx vite build --config ${viteConfig}`, {
      stdio: 'inherit',
      env: { ...process.env },
    });

    // Run postbuild (404 page)
    try {
      const postbuild = resolve(pkgRoot, 'scripts', 'generate-404.js');
      execSync(`node ${postbuild}`, { stdio: 'inherit' });
    } catch {}

    return;
  }

  const runner = commands[cmd];
  if (!runner) {
    console.error(`Unknown command: ${cmd}`);
    console.error('Run `concept-browser help` for usage.');
    process.exit(1);
  }

  await runner();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
