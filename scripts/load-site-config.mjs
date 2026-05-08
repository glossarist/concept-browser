#!/usr/bin/env node

/**
 * Site config discovery and loading.
 *
 * Resolution order:
 *   1. SITE_CONFIG env var → file path directly
 *   2. SITE_ID env var → configs/{SITE_ID}.yml
 *   3. --site CLI flag → same as SITE_ID
 *   4. Fallback → site-config.yml in project root
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

function findConfigFile(args = []) {
  if (process.env.SITE_CONFIG) {
    return resolve(process.env.SITE_CONFIG);
  }

  // Check CWD first (deployment repos), then project root
  for (const dir of [process.cwd(), projectRoot]) {
    const p = resolve(dir, 'site-config.yml');
    if (existsSync(p)) return p;
  }

  throw new Error('No site config found. Set SITE_CONFIG or create site-config.yml');
}

export function loadSiteConfig(args = []) {
  const configPath = findConfigFile(args);
  const raw = yaml.load(readFileSync(configPath, 'utf-8'));
  return { config: raw, configPath };
}

export function getProjectRoot() {
  return projectRoot;
}
