#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const TARGET_DIRS = ["scripts", "cli"];
const JS_EXTENSIONS = new Set([".mjs", ".js", ".cjs"]);
const ALL_EXTENSIONS = new Set([".ts", ...JS_EXTENSIONS]);
const SKIP_DIRS = new Set(["__tests__", "node_modules"]);

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) continue;
    const full = path.join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      out.push(...walk(full));
    } else if (ALL_EXTENSIONS.has(path.extname(entry))) {
      out.push(full);
    }
  }
  return out;
}

export function checkAllScripts({ root = ROOT } = {}) {
  const files = [];
  for (const sub of TARGET_DIRS) {
    const dir = path.join(root, sub);
    try {
      statSync(dir);
    } catch {
      continue;
    }
    files.push(...walk(dir));
  }
  files.sort();

  const failures = [];

  // JS files: syntax-check with node --check
  for (const file of files.filter(f => JS_EXTENSIONS.has(path.extname(f)))) {
    const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
    if (result.status !== 0) {
      failures.push({ file: path.relative(root, file), stderr: result.stderr || "" });
    }
  }

  // TS files: type-check with tsc (authoritative for TypeScript)
  if (files.some(f => path.extname(f) === ".ts")) {
    const tsconfig = path.join(root, "tsconfig.scripts.json");
    const result = spawnSync("npx", ["tsc", "-p", tsconfig, "--noEmit"], {
      encoding: "utf8",
      cwd: root,
    });
    if (result.status !== 0) {
      failures.push({ file: "tsconfig.scripts.json (tsc)", stderr: result.stdout || result.stderr || "" });
    }
  }

  return { files, failures };
}

function main() {
  const { files, failures } = checkAllScripts();
  if (failures.length === 0) {
    process.stdout.write(`syntax OK: ${files.length} file(s) checked\n`);
    return;
  }
  process.stderr.write(`syntax check failed: ${failures.length} of ${files.length} file(s)\n\n`);
  for (const { file, stderr } of failures) {
    process.stderr.write(`--- ${file} ---\n${stderr}\n`);
  }
  process.exit(1);
}

const isDirectEntry = process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (isDirectEntry) {
  main();
}
