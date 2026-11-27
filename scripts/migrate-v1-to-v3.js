#!/usr/bin/env node

// scripts/migrate-v1-to-v3.ts
import fs from "fs";
import path from "path";
function isV1PartitiveRelation(rel) {
  return rel && Array.isArray(rel.parts);
}
function migrateRelation(rel) {
  if (!isV1PartitiveRelation(rel)) return null;
  return {
    comprehensive: rel.comprehensive,
    completeness: rel.enumeration === "open" ? "partial" : rel.enumeration === "closed" || rel.enumeration == null ? "complete" : rel.enumeration,
    partitives: (rel.parts ?? []).map((p) => ({
      ref: p,
      certainty: "confirmed"
    })),
    ...rel.content ? { content: rel.content } : {}
  };
}
function migrateConceptData(data) {
  if (!data?.partitive_relations?.length) return null;
  const migrated = data.partitive_relations.map(migrateRelation).filter((r) => r !== null);
  if (migrated.length === 0) return null;
  return { ...data, partitive_relations: migrated };
}
function isAlreadyMigrated(content) {
  return Boolean(content?.data?.partitive_relations?.some?.((rel) => Array.isArray(rel.partitives)));
}
function walkFiles(input) {
  const stat = fs.statSync(input);
  if (stat.isFile()) return [input];
  const out = [];
  for (const entry of fs.readdirSync(input, { withFileTypes: true })) {
    const full = path.join(input, entry.name);
    if (entry.isDirectory()) out.push(...walkFiles(full));
    else if (entry.isFile() && /\.(ya?ml)$/i.test(entry.name)) out.push(full);
  }
  return out;
}
async function loadYamlModule() {
  try {
    return await import("js-yaml");
  } catch {
    return null;
  }
}
function outputPath(input, file, outRoot) {
  const stat = fs.statSync(input);
  if (stat.isFile()) return outRoot;
  const rel = path.relative(input, file);
  return path.join(outRoot, rel);
}
async function migrateFile(input, file, options, yaml) {
  const raw = fs.readFileSync(file, "utf8");
  const parsed = yaml ? yaml.load(raw) : JSON.parse(raw);
  if (!parsed?.data) return { changed: false };
  if (isAlreadyMigrated(parsed)) return { changed: false, skipped: true };
  const migrated = migrateConceptData(parsed.data);
  if (!migrated) return { changed: false };
  parsed.data = { ...parsed.data, ...migrated };
  const out = outputPath(input, file, options.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const outText = yaml ? yaml.dump(parsed) : JSON.stringify(parsed, null, 2);
  if (!options.dryRun) fs.writeFileSync(out, outText);
  return { changed: true, out, in: file };
}
async function main() {
  const args = process.argv.slice(2);
  const opts = { in: null, out: null, dryRun: false };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--in") opts.in = args[++i];
    else if (a === "--out") opts.out = args[++i];
    else if (a === "--dry-run") opts.dryRun = true;
    else if (!opts.in) opts.in = a;
    else if (!opts.out) opts.out = a;
  }
  if (!opts.in) {
    console.error("Usage: node scripts/migrate-v1-to-v3.mjs --in <dir|file> [--out <dir|file>] [--dry-run]");
    process.exit(1);
  }
  if (!opts.out) opts.out = opts.dryRun ? opts.in : `${opts.in}.v3`;
  const yaml = await loadYamlModule();
  if (!yaml) {
    console.error("js-yaml is required; install via npm install js-yaml");
    process.exit(1);
  }
  const files = walkFiles(opts.in);
  let changed = 0, skipped = 0, total = 0;
  for (const f of files) {
    total++;
    const res = await migrateFile(opts.in, f, opts, yaml);
    if (res.changed) {
      changed++;
      console.log(`\u2713 ${res.in} \u2192 ${res.out}`);
    } else if (res.skipped) {
      skipped++;
    }
  }
  console.log(`
${changed} migrated, ${skipped} skipped (already v3), ${total - changed - skipped} unchanged.`);
  if (opts.dryRun) console.log("(dry-run \u2014 no files written)");
}
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
export {
  isAlreadyMigrated,
  isV1PartitiveRelation,
  migrateConceptData,
  migrateRelation
};
