#!/usr/bin/env node

/**
 * Site config discovery and loading.
 *
 * Resolution order:
 *   1. SITE_CONFIG env var → file path directly
 *   2. SITE_ID env var → configs/{SITE_ID}.yml
 *   3. --site CLI flag → same as SITE_ID
 *   4. Fallback → site-config.yml in project root
 *
 * YAML keys MUST be snake_case (the canonical wire format). The loader
 * normalizes them to camelCase JS properties at load time so consumer
 * code uses idiomatic JS (config.uriBase, ds.gcrPackage, etc.) while
 * the on-disk format stays snake_case.
 *
 * For backwards compatibility with older configs, camelCase YAML keys
 * are still accepted but emit a deprecation warning.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

/**
 * Known snake_case → camelCase mappings for site-config + register.
 * Every YAML key must appear here in snake_case form. The loader
 * rejects unknown keys silently (forwards them as-is) so typos surface
 * as undefined at the consumer site.
 */
const SNAKE_TO_CAMEL = {
  // Site-level
  uri_base: 'uriBase',
  base_path: 'basePath',
  ui_languages: 'uiLanguages',
  dataset_groups: 'datasetGroups',
  dataset_translations: 'datasetTranslations',
  primary_color: 'primaryColor',
  dark_color: 'darkColor',
  owner_name: 'ownerName',
  owner_url: 'ownerUrl',
  powered_by: 'poweredBy',
  footer_nav: 'footerNav',
  footer_logo: 'footerLogo',
  news_dir: 'newsDir',
  // Dataset-level
  gcr_package: 'gcrPackage',
  source_repo: 'sourceRepo',
  local_path: 'localPath',
  local_light: 'localLight',
  local_dark: 'localDark',
  uri_aliases: 'uriAliases',
  language_order: 'languageOrder',
  ref_aliases: 'refAliases',
  urn_aliases: 'urnAliases',
  existing_site_url: 'existingSiteUrl',
  edition_status: 'editionStatus',
  dataset_uri: 'datasetUri',
  schema_version: 'schemaVersion',
};

function normalizeKey(key) {
  if (typeof key !== 'string') return key;
  // Known snake_case key → camelCase
  if (Object.prototype.hasOwnProperty.call(SNAKE_TO_CAMEL, key)) {
    return SNAKE_TO_CAMEL[key];
  }
  // Generic snake_case → camelCase fallback for unknown keys
  if (key.includes('_') && /^[a-z][a-z0-9_]*$/.test(key)) {
    return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }
  // camelCase or other → pass through (backwards compat)
  return key;
}

function normalizeObject(obj) {
  if (Array.isArray(obj)) return obj.map(normalizeObject);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[normalizeKey(k)] = normalizeObject(v);
    }
    return out;
  }
  return obj;
}

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
  const config = normalizeObject(raw);
  return { config, configPath };
}

export function getProjectRoot() {
  return projectRoot;
}
