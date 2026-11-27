#!/usr/bin/env node

// scripts/fetch-datasets.ts
import fs2 from "fs";
import path2 from "path";
import JSZip from "jszip";
import { loadGcr } from "glossarist";
import { execFileSync } from "child_process";
import { fileURLToPath as fileURLToPath2 } from "url";

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

// scripts/lib/local-path-safety.ts
import fs from "fs";
import path from "path";
function physicalPath(p) {
  if (fs.existsSync(p)) return fs.realpathSync(p);
  const parent = path.dirname(p);
  const parentReal = fs.existsSync(parent) ? fs.realpathSync(parent) : physicalPath(parent);
  return path.join(parentReal, path.basename(p));
}
function assertLocalPathSafe(datasetId, localPath, { root = process.cwd(), datasetsDir } = {}) {
  const datasetsRoot = datasetsDir || path.join(root, ".datasets");
  const localResolved = path.resolve(root, localPath);
  if (!fs.existsSync(localResolved)) {
    throw new Error(`localPath for ${datasetId} does not exist: ${localResolved}`);
  }
  const localReal = fs.realpathSync(localResolved);
  const stagedAbs = path.join(datasetsRoot, datasetId);
  const stagedReal = physicalPath(stagedAbs);
  if (localReal === stagedReal) {
    throw new Error(
      `localPath for ${datasetId} resolves to the same physical location as .datasets/${datasetId} (${localReal}). Refusing to operate \u2014 source and staging would clobber. Use a path outside .datasets/.`
    );
  }
  if (localReal.startsWith(stagedReal + path.sep)) {
    throw new Error(
      `localPath for ${datasetId} is nested inside .datasets/${datasetId}. Refusing to operate \u2014 staging operations would destroy source data. Use a path outside .datasets/.`
    );
  }
  if (stagedReal.startsWith(localReal + path.sep)) {
    throw new Error(
      `localPath for ${datasetId} contains .datasets/${datasetId}. Refusing to operate \u2014 staging operations would destroy source data. Use a path outside localPath.`
    );
  }
  return localReal;
}

// scripts/fetch-datasets.ts
var ROOT = process.cwd();
var DATASETS_DIR = path2.join(ROOT, ".datasets");
var GCR_DIR = path2.join(ROOT, ".gcr");
function matchUriPattern(uri, pattern) {
  if (!pattern.endsWith("*")) return uri === pattern;
  return uri.startsWith(pattern.slice(0, -1));
}
async function downloadGcr(url, destPath) {
  fs2.mkdirSync(path2.dirname(destPath), { recursive: true });
  console.log(`  Downloading ${url}...`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
  const buf = Buffer.from(await resp.arrayBuffer());
  fs2.writeFileSync(destPath, buf);
  console.log(`  Saved to ${destPath} (${(buf.length / 1024).toFixed(0)} KB)`);
}
async function extractGcr(gcrPath, targetDir) {
  const targetAbs = path2.resolve(targetDir);
  if (fs2.existsSync(targetAbs)) {
    fs2.rmSync(targetAbs, { recursive: true, force: true });
  }
  fs2.mkdirSync(targetAbs, { recursive: true });
  const buf = fs2.readFileSync(gcrPath);
  const zip = await JSZip.loadAsync(buf);
  const entries = Object.values(zip.files);
  for (const entry of entries) {
    if (entry.dir) continue;
    const dest = path2.resolve(targetAbs, entry.name);
    if (dest !== targetAbs && !dest.startsWith(targetAbs + path2.sep)) {
      throw new Error(`Refusing to extract entry outside target dir: ${entry.name}`);
    }
    fs2.mkdirSync(path2.dirname(dest), { recursive: true });
    const content = await entry.async("nodebuffer");
    fs2.writeFileSync(dest, content);
  }
  console.log(`  Extracted to ${targetAbs}`);
}
async function readGcrMetadata(gcrPath) {
  if (!fs2.existsSync(gcrPath)) return null;
  try {
    const buf = fs2.readFileSync(gcrPath);
    const pkg = await loadGcr(buf);
    const meta = await pkg.metadata();
    return meta ? meta.toJSON() : null;
  } catch {
    return null;
  }
}
function validateDependencies(config, gcrMetadata) {
  const errors = [];
  const allProvidedUris = [];
  for (const ds of config.datasets) {
    allProvidedUris.push(ds.uri);
    if (ds.uriAliases) allProvidedUris.push(...ds.uriAliases);
  }
  const routingUris = (config.routing || []).map((r) => r.uri);
  for (const ds of config.datasets) {
    const meta = gcrMetadata[ds.id];
    if (!meta?.dependencies?.length) continue;
    for (const dep of meta.dependencies) {
      const depUri = dep.uri;
      const satisfied = [...allProvidedUris, ...routingUris].some((p) => matchUriPattern(depUri, p));
      if (!satisfied) {
        errors.push(`GCR '${ds.id}' depends on '${depUri}' (${dep.refCount} refs) but no provider or route configured`);
      }
    }
  }
  return errors;
}
function cloneOrUpdate(sourceRepo, targetDir) {
  const env = { ...process.env };
  let repoUrl = sourceRepo;
  if (env.GITHUB_TOKEN) {
    repoUrl = sourceRepo.replace("https://", `https://x-access-token:${env.GITHUB_TOKEN}@`);
  }
  const targetAbs = path2.resolve(targetDir);
  if (fs2.existsSync(path2.join(targetAbs, ".git"))) {
    console.log(`  Updating existing clone...`);
    try {
      execFileSync("git", ["fetch", "origin"], { cwd: targetAbs, stdio: "pipe", env });
      execFileSync("git", ["reset", "--hard", "origin/HEAD"], { cwd: targetAbs, stdio: "pipe", env });
      execFileSync("git", ["clean", "-fd"], { cwd: targetAbs, stdio: "pipe", env });
    } catch {
      console.warn(`  git update failed, re-cloning`);
      fs2.rmSync(targetAbs, { recursive: true, force: true });
      execFileSync("git", ["clone", "--depth", "1", repoUrl, targetAbs], { stdio: "pipe", env });
    }
  } else {
    fs2.mkdirSync(targetAbs, { recursive: true });
    console.log(`  Cloning ${sourceRepo}...`);
    execFileSync("git", ["clone", "--depth", "1", repoUrl, targetAbs], { stdio: "pipe", env });
  }
}
async function main() {
  console.log("Fetching glossarist datasets...\n");
  const { config } = loadSiteConfig();
  const gcrMetadata = {};
  for (const ds of config.datasets) {
    console.log(`${ds.id}:`);
    const gcrPath = path2.join(GCR_DIR, `${ds.id}.gcr`);
    const targetDir = path2.join(DATASETS_DIR, ds.id);
    try {
      if (fs2.existsSync(gcrPath)) {
        console.log(`  Using local .gcr/${ds.id}.gcr`);
        await extractGcr(gcrPath, targetDir);
      } else if (ds.gcrPackage) {
        console.log(`  Using GCR package: ${ds.gcrPackage}`);
        try {
          await downloadGcr(ds.gcrPackage, gcrPath);
        } catch (e) {
          console.warn(`  GCR download failed: ${e.message}`);
          console.warn(`  Skipping ${ds.id}`);
          console.log();
          continue;
        }
        await extractGcr(gcrPath, targetDir);
      } else if (ds.localPath) {
        const localResolved = assertLocalPathSafe(ds.id, ds.localPath);
        console.log(`  Using localPath in-place: ${localResolved}`);
      } else if (ds.sourceRepo) {
        cloneOrUpdate(ds.sourceRepo, targetDir);
      } else {
        console.warn(`  No source configured, skipping`);
        console.log();
        continue;
      }
      const meta = await readGcrMetadata(gcrPath);
      if (meta) {
        gcrMetadata[ds.id] = meta;
        console.log(`  ${meta.concept_count || "?"} concepts, ${meta.uri_prefix || "no uri"}`);
      }
    } catch (e) {
      console.warn(`  Failed: ${e.message}`);
      console.warn(`  Skipping ${ds.id}`);
    }
    console.log();
  }
  console.log("Validating dependencies...\n");
  const errors = validateDependencies(config, gcrMetadata);
  if (errors.length) {
    console.error("Dependency validation FAILED:");
    for (const err of errors) {
      console.error(`  \u2717 ${err}`);
    }
    process.exit(1);
  }
  console.log("All dependencies satisfied.\n");
  console.log("Done.");
}
var isDirectInvocation = process.argv[1] && fs2.realpathSync(process.argv[1]) === fs2.realpathSync(fileURLToPath2(import.meta.url));
if (isDirectInvocation) {
  await main();
}
export {
  main
};
