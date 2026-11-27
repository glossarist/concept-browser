#!/usr/bin/env node

// scripts/normalize-yaml.ts
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, extname, dirname } from "node:path";
import { fileURLToPath } from "node:url";
var ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
var YAML_EXTS = /* @__PURE__ */ new Set([".yaml", ".yml"]);
var SKIP_DIRS = /* @__PURE__ */ new Set(["node_modules", ".git", "dist"]);
function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (YAML_EXTS.has(extname(entry))) {
      out.push(full);
    }
  }
  return out;
}
function normalizeYaml({ root = ROOT, check = false, paths = [] } = {}) {
  const searchDirs = paths.length > 0 ? paths.map((p) => join(root, p)) : [join(root, ".datasets")];
  const files = [];
  for (const dir of searchDirs) {
    try {
      statSync(dir);
    } catch {
      continue;
    }
    files.push(...walk(dir));
  }
  files.sort();
  let checked = 0;
  let nonNfc = 0;
  const fixed = [];
  for (const file of files) {
    const original = readFileSync(file, "utf8");
    checked++;
    if (!isNfc(original)) {
      nonNfc++;
      if (!check) {
        writeFileSync(file, original.normalize("NFC"), "utf8");
        fixed.push(relative(root, file));
      } else {
        fixed.push(relative(root, file));
      }
    }
  }
  return { checked, nonNfc, fixed, check };
}
function isNfc(s) {
  return s === s.normalize("NFC");
}
function main() {
  const args = process.argv.slice(2);
  const check = args.includes("--check");
  const paths = args.filter((a) => !a.startsWith("-") && a !== "normalize");
  const { checked, nonNfc, fixed } = normalizeYaml({ check, paths });
  if (check) {
    if (nonNfc === 0) {
      process.stdout.write(`NFC OK: ${checked} file(s) checked, all normalized
`);
      return;
    }
    process.stderr.write(`NFC check failed: ${nonNfc} of ${checked} file(s) are not NFC-normalized

`);
    for (const f of fixed) {
      process.stderr.write(`  ${f}
`);
    }
    process.exit(1);
  } else {
    if (nonNfc === 0) {
      process.stdout.write(`NFC OK: ${checked} file(s) checked, all already normalized
`);
      return;
    }
    process.stdout.write(`Normalized ${nonNfc} of ${checked} file(s)
`);
    for (const f of fixed) {
      process.stdout.write(`  ${f}
`);
    }
  }
}
var isDirectEntry = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isDirectEntry) {
  main();
}
export {
  normalizeYaml
};
