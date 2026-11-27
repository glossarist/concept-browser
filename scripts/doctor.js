#!/usr/bin/env node

// scripts/doctor.ts
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
var __dirname = dirname(fileURLToPath(import.meta.url));
var PKG_ROOT = resolve(__dirname, "..");
var NODE_MIN_MAJOR = 18;
function safe(id, check) {
  const wrapped = async (ctx) => {
    try {
      return await check(ctx);
    } catch (err) {
      return {
        id: "unexpected",
        label: "Unexpected error",
        status: "fail",
        detail: err?.message ?? String(err)
      };
    }
  };
  Object.defineProperty(wrapped, "name", { value: id });
  return wrapped;
}
function nodeVersionCheck() {
  const major = Number.parseInt(process.versions.node.split(".")[0], 10);
  return {
    id: "node-version",
    label: `Node.js v${process.versions.node}`,
    status: major >= NODE_MIN_MAJOR ? "pass" : "fail",
    detail: major < NODE_MIN_MAJOR ? `requires >= v${NODE_MIN_MAJOR}` : void 0,
    hint: major < NODE_MIN_MAJOR ? "upgrade via nvm or your package manager" : void 0
  };
}
function packageDepsCheck(ctx) {
  const roots = [resolve(ctx.cwd, "node_modules"), resolve(ctx.pkgRoot, "node_modules")];
  if (!roots.some((nm) => existsSync(nm))) {
    return {
      id: "package-deps",
      label: "Dependencies installed",
      status: "fail",
      detail: "node_modules missing",
      hint: "run `npm install`"
    };
  }
  const required = ["vue", "vue-router", "pinia", "vite", "n3", "glossarist", "@rdfjs/dataset"];
  const missing = required.filter((p) => !roots.some((nm) => existsSync(join(nm, p))));
  if (missing.length) {
    return {
      id: "package-deps",
      label: "Dependencies installed",
      status: "fail",
      detail: `missing: ${missing.join(", ")}`,
      hint: "run `npm install`"
    };
  }
  return { id: "package-deps", label: "Dependencies installed", status: "pass" };
}
function resolveDatasetRegistry(cwd, fileError = void 0) {
  if (fileError) return { registered: [], source: "datasets.yml", error: fileError };
  const ymlPath = resolve(cwd, "datasets.yml");
  if (existsSync(ymlPath)) {
    const list = normalizeRegistry(yaml.load(readFileSync(ymlPath, "utf8")));
    return { registered: list, source: "datasets.yml" };
  }
  const sitePath = resolve(cwd, "site-config.yml");
  if (existsSync(sitePath)) {
    try {
      const list = normalizeRegistry(yaml.load(readFileSync(sitePath, "utf8")));
      return { registered: list, source: "site-config.yml" };
    } catch (err) {
      return { registered: [], source: "site-config.yml", error: err.message };
    }
  }
  return { registered: [], source: null };
}
function normalizeRegistry(doc) {
  const datasets = doc?.datasets;
  if (!Array.isArray(datasets)) return [];
  return datasets.filter((d) => d && typeof d === "object" && d.id).map((d) => ({ id: String(d.id), localPath: d.local_path ?? d.localPath }));
}
function datasetsRegisteredCheck(ctx) {
  if (ctx.registry.error) {
    return {
      id: "datasets-registered",
      label: `${ctx.registry.source} parses`,
      status: "fail",
      detail: ctx.registry.error,
      hint: "fix the YAML syntax error"
    };
  }
  if (!ctx.registry.source) {
    return {
      id: "datasets-registered",
      label: "Dataset registry present",
      status: "warn",
      detail: "neither datasets.yml nor site-config.yml found at project root",
      hint: "datasets.yml / site-config.yml register every dataset the browser serves"
    };
  }
  if (ctx.registry.registered.length === 0) {
    return {
      id: "datasets-registered",
      label: "Dataset registry lists datasets",
      status: "warn",
      detail: `\`datasets\` key is empty or missing in ${ctx.registry.source}`,
      hint: "add at least one dataset entry; see docs/adding-a-dataset.md"
    };
  }
  return {
    id: "datasets-registered",
    label: `${ctx.registry.source} lists ${ctx.registry.registered.length} dataset(s)`,
    status: "pass"
  };
}
function datasetsFetchedCheck(ctx) {
  const datasets = ctx.registry.registered;
  if (!ctx.registry.source || !datasets.length) {
    return { id: "datasets-fetched", label: "Source datasets fetched", status: "warn", detail: "no datasets registered" };
  }
  const missing = datasets.filter((d) => {
    if (d.localPath) return !existsSync(resolve(ctx.cwd, d.localPath));
    return !existsSync(join(resolve(ctx.cwd, ".datasets"), d.id, "concepts"));
  }).map((d) => d.id);
  if (missing.length) {
    return {
      id: "datasets-fetched",
      label: "Source datasets fetched",
      status: "fail",
      detail: `dataset sources missing: ${missing.join(", ")}`,
      hint: "run `npm run fetch-datasets` (or check local_path entries in site-config.yml)"
    };
  }
  return { id: "datasets-fetched", label: "Source datasets fetched", status: "pass" };
}
function datasetsGeneratedCheck(ctx) {
  const datasets = ctx.registry.registered;
  if (!ctx.registry.source || !datasets.length) {
    return { id: "datasets-generated", label: "Generated data present", status: "warn", detail: "no datasets registered" };
  }
  const publicData = resolve(ctx.cwd, "public", "data");
  const missing = datasets.filter((d) => !existsSync(join(publicData, d.id, "manifest.json"))).map((d) => d.id);
  if (missing.length) {
    return {
      id: "datasets-generated",
      label: "Generated data present",
      status: "fail",
      detail: `public/data/ missing manifest for: ${missing.join(", ")}`,
      hint: "run `npm run generate-data`"
    };
  }
  return { id: "datasets-generated", label: "Generated data present", status: "pass" };
}
function publicDatasetsJsonCheck(ctx) {
  const path = resolve(ctx.cwd, "public", "datasets.json");
  if (!existsSync(path)) {
    return {
      id: "public-datasets-json",
      label: "public/datasets.json present",
      status: "fail",
      hint: "run `npm run generate-data`"
    };
  }
  try {
    const doc = JSON.parse(readFileSync(path, "utf8"));
    if (!Array.isArray(doc) || doc.length === 0) {
      return {
        id: "public-datasets-json",
        label: "public/datasets.json non-empty",
        status: "warn",
        detail: "datasets list is empty"
      };
    }
    return { id: "public-datasets-json", label: "public/datasets.json parses", status: "pass" };
  } catch (err) {
    return {
      id: "public-datasets-json",
      label: "public/datasets.json parses",
      status: "fail",
      detail: err.message
    };
  }
}
function shaclShapesCheck(ctx) {
  const shapesPath = resolve(ctx.pkgRoot, "data", "concept-model", "shapes", "glossarist.shacl.ttl");
  if (!existsSync(shapesPath)) {
    return {
      id: "shacl-shapes",
      label: "SHACL shapes present",
      status: "fail",
      hint: "run `npm run sync:model` to vendor shapes from concept-model"
    };
  }
  const ttl = readFileSync(shapesPath, "utf8");
  const looksLikeShapes = /sh:\s*(NodeShape|PropertyShape|targetClass)/.test(ttl) || /a\s+sh:NodeShape/.test(ttl);
  if (!looksLikeShapes) {
    return {
      id: "shacl-shapes",
      label: "SHACL shapes well-formed",
      status: "fail",
      detail: "file exists but does not declare any sh:NodeShape",
      hint: "re-sync from glossarist/concept-model"
    };
  }
  return { id: "shacl-shapes", label: "SHACL shapes present", status: "pass" };
}
function jsonldContextCheck(ctx) {
  const ctxPath = resolve(ctx.pkgRoot, "data", "concept-model", "glossarist.context.jsonld");
  if (!existsSync(ctxPath)) {
    return {
      id: "jsonld-context",
      label: "JSON-LD context present",
      status: "fail",
      hint: "run `npm run sync:model` to vendor the context"
    };
  }
  try {
    const doc = JSON.parse(readFileSync(ctxPath, "utf8"));
    if (!doc["@context"] || typeof doc["@context"] !== "object") {
      return {
        id: "jsonld-context",
        label: "JSON-LD context well-formed",
        status: "fail",
        detail: "missing or invalid @context key"
      };
    }
    return { id: "jsonld-context", label: "JSON-LD context present", status: "pass" };
  } catch (err) {
    return {
      id: "jsonld-context",
      label: "JSON-LD context parses",
      status: "fail",
      detail: err.message
    };
  }
}
var CHECKS = [
  safe("node-version", nodeVersionCheck),
  safe("package-deps", packageDepsCheck),
  safe("datasets-registered", datasetsRegisteredCheck),
  safe("datasets-fetched", datasetsFetchedCheck),
  safe("datasets-generated", datasetsGeneratedCheck),
  safe("public-datasets-json", publicDatasetsJsonCheck),
  safe("shacl-shapes", shaclShapesCheck),
  safe("jsonld-context", jsonldContextCheck)
];
async function runDoctor(cwd = process.cwd()) {
  const datasetsYmlPath = resolve(cwd, "datasets.yml");
  let datasetsYml;
  let datasetsYmlError;
  if (existsSync(datasetsYmlPath)) {
    try {
      datasetsYml = yaml.load(readFileSync(datasetsYmlPath, "utf8"));
    } catch (err) {
      datasetsYmlError = err.message;
    }
  }
  const ctx = {
    cwd,
    pkgRoot: PKG_ROOT,
    datasetsYml,
    datasetsYmlError,
    registry: resolveDatasetRegistry(cwd, datasetsYmlError)
  };
  const results = [];
  for (const check of CHECKS) {
    results.push(await check(ctx));
  }
  const failed = results.filter((r) => r.status === "fail").length;
  const exitCode = failed > 0 ? 1 : 0;
  return { results, exitCode };
}
var STATUS_GLYPH = { pass: "\u2713", fail: "\u2717", warn: "!" };
function formatResults(results) {
  const lines = [];
  for (const r of results) {
    lines.push(`${STATUS_GLYPH[r.status]} ${r.label}`);
    if (r.detail) lines.push(`    ${r.detail}`);
    if (r.hint) lines.push(`    \u2192 ${r.hint}`);
  }
  const pass = results.filter((r) => r.status === "pass").length;
  const fail = results.filter((r) => r.status === "fail").length;
  const warn = results.filter((r) => r.status === "warn").length;
  lines.push("");
  lines.push(`${pass} passed, ${fail} failed, ${warn} warnings (${results.length} total)`);
  return lines.join("\n");
}
async function main() {
  const { results, exitCode } = await runDoctor();
  console.log(formatResults(results));
  process.exit(exitCode);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
export {
  CHECKS,
  NODE_MIN_MAJOR,
  formatResults,
  main,
  resolveDatasetRegistry,
  runDoctor
};
