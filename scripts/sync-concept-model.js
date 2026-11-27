#!/usr/bin/env node

// scripts/sync-concept-model.ts
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
var ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
var OUT_DIR = resolve(ROOT, "data", "concept-model");
var REPO = "glossarist/concept-model";
function parseArgs(argv) {
  const out = { ref: null };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--ref") out.ref = argv[++i];
    else if (!a.startsWith("--")) out.ref = a;
  }
  return out;
}
function latestTag() {
  return execSync(`gh api repos/${REPO}/releases/latest --jq .tag_name`, { encoding: "utf8" }).trim();
}
function fetchFile(ref2, path) {
  const url = `https://raw.githubusercontent.com/${REPO}/${ref2}/${path}`;
  return execSync(`curl -fsSL ${url}`, { encoding: "utf8" });
}
var args = parseArgs(process.argv);
var ref = args.ref || latestTag();
if (!ref) {
  console.error("Could not determine concept-model ref to sync.");
  process.exit(1);
}
console.log(`Syncing from ${REPO}@${ref}`);
mkdirSync(resolve(OUT_DIR, "shapes"), { recursive: true });
function fetchAny(ref2, candidates) {
  for (const p of candidates) {
    try {
      return fetchFile(ref2, p);
    } catch (e) {
    }
  }
  throw new Error(`Could not fetch any of: ${candidates.join(", ")}`);
}
var targets = {
  "glossarist.context.jsonld": ["ontologies/glossarist.context.jsonld", "glossarist.context.jsonld"],
  "glossarist.ttl": ["ontologies/glossarist.ttl", "glossarist.ttl"],
  "prefixes.ttl": ["ontologies/prefixes.ttl"],
  "shapes/glossarist.shacl.ttl": ["ontologies/shapes/glossarist.shacl.ttl", "shapes/glossarist.shacl.ttl"]
};
var updated = 0;
for (const [outPath, candidates] of Object.entries(targets)) {
  const content = fetchAny(ref, candidates);
  writeFileSync(resolve(OUT_DIR, outPath), content);
  console.log(`  \u2713 ${outPath} (${content.length} bytes)`);
  updated++;
}
writeFileSync(
  resolve(OUT_DIR, "SOURCE.json"),
  JSON.stringify({ repo: REPO, ref, syncedAt: (/* @__PURE__ */ new Date()).toISOString() }, null, 2) + "\n"
);
console.log(`
Synced ${updated} file(s) from ${REPO}@${ref}.`);
console.log("Review the diff, then commit.");
