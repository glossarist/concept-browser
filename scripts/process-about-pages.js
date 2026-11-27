#!/usr/bin/env node

// scripts/process-about-pages.ts
import { readFileSync as readFileSync2, writeFileSync, existsSync as existsSync2, mkdirSync, readdirSync, statSync, realpathSync } from "node:fs";
import { join, basename, extname, resolve as resolve2 } from "node:path";
import { cwd } from "node:process";
import { fileURLToPath as fileURLToPath2 } from "node:url";

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

// scripts/process-about-pages.ts
function loadSiteConfigForAbout() {
  try {
    const { config } = loadSiteConfig([]);
    return config;
  } catch {
    return null;
  }
}
function roots() {
  const ROOT = cwd();
  return {
    ROOT,
    PUBLIC_PAGES: join(ROOT, "public", "pages"),
    DATASETS_DIR: join(ROOT, ".datasets"),
    GROUPS_CONTENT_DIR: join(ROOT, "site-content", "groups")
  };
}
function renderMarkdown(text) {
  const lines = text.split("\n");
  const html = [];
  let inList = false;
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      continue;
    }
    if (/^#{1}\s/.test(trimmed)) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h1>${inline(trimmed.replace(/^#\s/, ""))}</h1>`);
    } else if (/^#{2}\s/.test(trimmed)) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h2>${inline(trimmed.replace(/^##\s/, ""))}</h2>`);
    } else if (/^#{3}\s/.test(trimmed)) {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<h3>${inline(trimmed.replace(/^###\s/, ""))}</h3>`);
    } else if (/^[-*]\s/.test(trimmed)) {
      if (!inList) {
        html.push("<ul>");
        inList = true;
      }
      html.push(`<li>${inline(trimmed.replace(/^[-*]\s/, ""))}</li>`);
    } else {
      if (inList) {
        html.push("</ul>");
        inList = false;
      }
      html.push(`<p>${inline(trimmed)}</p>`);
    }
  }
  if (inList) html.push("</ul>");
  return html.join("\n");
}
function inline(text) {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/\*(.+?)\*/g, "<em>$1</em>").replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>').replace(/`(.+?)`/g, "<code>$1</code>");
}
function processAboutDir(sourceDir, outputPrefix, publicPagesDir) {
  if (!existsSync2(sourceDir)) return 0;
  let count = 0;
  for (const file of readdirSync(sourceDir)) {
    const fullPath = join(sourceDir, file);
    if (!statSync(fullPath).isFile()) continue;
    const ext = extname(file);
    if (ext !== ".md" && ext !== ".adoc" && ext !== ".html") continue;
    const base = basename(file, ext);
    const langMatch = base.match(/^about\.(\w+)$/);
    const lang = langMatch ? langMatch[1] : "eng";
    const outputName = lang === "eng" ? `${outputPrefix}.json` : `${outputPrefix}.${lang}.json`;
    const raw = readFileSync2(fullPath, "utf8");
    let html;
    let title;
    if (ext === ".html") {
      html = raw;
      const titleMatch = raw.match(/<h1[^>]*>(.+?)<\/h1>/);
      title = titleMatch ? titleMatch[1] : "About";
    } else if (ext === ".md") {
      html = renderMarkdown(raw);
      const titleMatch = raw.match(/^#\s+(.+)$/m);
      title = titleMatch ? titleMatch[1] : "About";
    } else {
      html = `<p>${raw.split("\n").filter((l) => l.trim() && !l.startsWith("=")).join("</p>\n<p>")}</p>`;
      const titleMatch = raw.match(/^=\s+(.+)$/m);
      title = titleMatch ? titleMatch[1] : "About";
    }
    const output = { title, html };
    mkdirSync(publicPagesDir, { recursive: true });
    writeFileSync(join(publicPagesDir, outputName), JSON.stringify(output));
    count++;
    console.log(`  Compiled: ${file} \u2192 public/pages/${outputName}`);
  }
  return count;
}
function main() {
  const { ROOT, PUBLIC_PAGES, DATASETS_DIR, GROUPS_CONTENT_DIR } = roots();
  mkdirSync(PUBLIC_PAGES, { recursive: true });
  let total = 0;
  const siteConfig = loadSiteConfigForAbout();
  const localPathMap = /* @__PURE__ */ new Map();
  for (const ds of siteConfig?.datasets || []) {
    if (ds.id && ds.localPath) {
      localPathMap.set(ds.id, resolve2(ROOT, ds.localPath));
    }
  }
  const seenIds = /* @__PURE__ */ new Set();
  if (existsSync2(DATASETS_DIR)) {
    for (const dsId of readdirSync(DATASETS_DIR)) {
      seenIds.add(dsId);
      const aboutDir = join(DATASETS_DIR, dsId, "about");
      if (existsSync2(aboutDir) && statSync(aboutDir).isDirectory()) {
        console.log(`Processing dataset: ${dsId}`);
        total += processAboutDir(aboutDir, `dataset-${dsId}-about`, PUBLIC_PAGES);
      }
    }
  }
  for (const [dsId, dsPath] of localPathMap) {
    if (seenIds.has(dsId)) continue;
    const aboutDir = join(dsPath, "about");
    if (existsSync2(aboutDir) && statSync(aboutDir).isDirectory()) {
      console.log(`Processing dataset (localPath): ${dsId}`);
      total += processAboutDir(aboutDir, `dataset-${dsId}-about`, PUBLIC_PAGES);
    }
  }
  if (existsSync2(GROUPS_CONTENT_DIR)) {
    for (const groupId of readdirSync(GROUPS_CONTENT_DIR)) {
      const aboutDir = join(GROUPS_CONTENT_DIR, groupId, "about");
      if (existsSync2(aboutDir) && statSync(aboutDir).isDirectory()) {
        console.log(`Processing group: ${groupId}`);
        total += processAboutDir(aboutDir, `group-${groupId}-about`, PUBLIC_PAGES);
      }
    }
  }
  console.log(total > 0 ? `
Compiled ${total} about page(s).` : "\nNo about pages found.");
}
var isDirectInvocation = process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath2(import.meta.url));
if (isDirectInvocation) {
  main();
}
export {
  loadSiteConfigForAbout,
  main,
  processAboutDir,
  renderMarkdown,
  roots
};
