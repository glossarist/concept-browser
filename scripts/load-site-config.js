#!/usr/bin/env node

// scripts/load-site-config.ts
import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import yaml from "js-yaml";
var __dirname = dirname(fileURLToPath(import.meta.url));
var projectRoot = resolve(__dirname, "..");
var SNAKE_TO_CAMEL = {
  // Site-level
  uri_base: "uriBase",
  base_path: "basePath",
  ui_languages: "uiLanguages",
  dataset_groups: "datasetGroups",
  dataset_translations: "datasetTranslations",
  primary_color: "primaryColor",
  dark_color: "darkColor",
  owner_name: "ownerName",
  owner_url: "ownerUrl",
  powered_by: "poweredBy",
  footer_nav: "footerNav",
  footer_logo: "footerLogo",
  news_dir: "newsDir",
  bulk_exports: "bulkExports",
  // Dataset-level
  gcr_package: "gcrPackage",
  source_repo: "sourceRepo",
  local_path: "localPath",
  local_light: "localLight",
  local_dark: "localDark",
  uri_aliases: "uriAliases",
  language_order: "languageOrder",
  ref_aliases: "refAliases",
  urn_aliases: "urnAliases",
  existing_site_url: "existingSiteUrl",
  edition_status: "editionStatus",
  dataset_uri: "datasetUri",
  schema_version: "schemaVersion"
};
function normalizeKey(key) {
  if (typeof key !== "string") return key;
  if (Object.prototype.hasOwnProperty.call(SNAKE_TO_CAMEL, key)) {
    return SNAKE_TO_CAMEL[key];
  }
  if (key.includes("_") && /^[a-z][a-z0-9_]*$/.test(key)) {
    return key.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
  }
  return key;
}
function normalizeObject(obj) {
  if (Array.isArray(obj)) return obj.map(normalizeObject);
  if (obj && typeof obj === "object") {
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
  for (const dir of [process.cwd(), projectRoot]) {
    const p = resolve(dir, "site-config.yml");
    if (existsSync(p)) return p;
  }
  throw new Error("No site config found. Set SITE_CONFIG or create site-config.yml");
}
function loadSiteConfig(args = []) {
  const configPath = findConfigFile(args);
  const raw = yaml.load(readFileSync(configPath, "utf-8"));
  const config = normalizeObject(raw);
  return { config, configPath };
}
function getProjectRoot() {
  return projectRoot;
}
export {
  getProjectRoot,
  loadSiteConfig
};
