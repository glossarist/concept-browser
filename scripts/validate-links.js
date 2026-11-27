#!/usr/bin/env node

// scripts/validate-links.ts
import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { cwd } from "node:process";
var DATA_DIR = process.argv[2] ?? join(cwd(), "public", "data");
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (entry.endsWith(".json")) out.push(full);
  }
  return out;
}
function localPathForUri(uri, dataDir) {
  const match = uri.match(/\/([^/]+)\/concept\/([^/]+?)(?:\/|$)/);
  if (!match) return { exists: false, expected: "" };
  const [, datasetId, conceptId] = match;
  const decoded = decodeURIComponent(conceptId);
  const expected = join(dataDir, datasetId, "concepts", `${decoded}.json`);
  return { exists: existsSync(expected), expected };
}
function checkFile(file, dataDir) {
  const raw = readFileSync(file, "utf8");
  const json = JSON.parse(raw);
  const broken = [];
  function check(target, field) {
    if (!target || typeof target !== "string") return;
    if (!target.startsWith("http")) return;
    const { exists, expected } = localPathForUri(target, dataDir);
    if (!exists) {
      broken.push({
        file: file.replace(cwd() + "/", ""),
        line: 0,
        field,
        target,
        reason: expected ? `local target file missing: ${expected}` : "unparseable URI"
      });
    }
  }
  for (const r of json["gl:related"] ?? []) {
    check(r["gl:target"], "gl:related[].gl:target");
    check(r["@id"], "gl:related[].@id");
  }
  for (const lc of Object.values(json["gl:localizedConcept"] ?? {})) {
    for (const ref of lc["gl:references"] ?? []) {
      if (ref["@id"]) check(ref["@id"], "gl:references[].@id");
    }
  }
  for (const pr of json["gl:partitiveRelations"] ?? []) {
    check(pr["gl:comprehensive"]?.["@id"] ?? pr["gl:comprehensive"], "gl:partitiveRelations.gl:comprehensive");
    for (const m of pr["gl:hasPartitive"] ?? []) {
      check(m["gl:ref"]?.["@id"] ?? m["gl:ref"], "gl:partitiveRelations.gl:hasPartitive[].gl:ref");
    }
  }
  for (const gr of json["gl:genericRelations"] ?? []) {
    check(gr["gl:comprehensive"]?.["@id"] ?? gr["gl:comprehensive"], "gl:genericRelations.gl:comprehensive");
    for (const m of gr["gl:hasMember"] ?? []) {
      check(m["gl:ref"]?.["@id"] ?? m["gl:ref"], "gl:genericRelations.gl:hasMember[].gl:ref");
    }
  }
  const datasetDir = file.includes("/concepts/") ? dirname(dirname(file)) : "";
  const bibPath = datasetDir ? join(datasetDir, "bibliography.json") : "";
  let bibliography = null;
  if (bibPath && existsSync(bibPath)) {
    try {
      bibliography = JSON.parse(readFileSync(bibPath, "utf8"));
    } catch {
    }
  }
  const sourceIds = /* @__PURE__ */ new Set();
  const sourceRefKeys = /* @__PURE__ */ new Set();
  const allSourceArrays = [
    ...json["gl:sources"] ?? []
  ];
  for (const lc of Object.values(json["gl:localizedConcept"] ?? {})) {
    const lcSources = lc["gl:source"] ?? lc["gl:sources"];
    if (Array.isArray(lcSources)) allSourceArrays.push(...lcSources);
  }
  for (const s of allSourceArrays) {
    if (s["gl:id"]) sourceIds.add(s["gl:id"]);
    const origin = s["gl:origin"] ?? {};
    const ref = origin["gl:ref"] ?? {};
    if (ref["gl:source"] && ref["gl:id"]) {
      sourceRefKeys.add(`${ref["gl:source"]}:${ref["gl:id"]}`);
      sourceIds.add(ref["gl:id"]);
    }
  }
  const textChunks = [];
  for (const lc of Object.values(json["gl:localizedConcept"] ?? {})) {
    const lcObj = lc;
    for (const field of ["gl:definition", "gl:notes", "gl:examples", "gl:annotations"]) {
      for (const entry of lcObj[field] ?? []) {
        if (entry["gl:content"]) textChunks.push(entry["gl:content"]);
      }
    }
  }
  const fullText = textChunks.join("\n");
  for (const m of fullText.matchAll(/\{\{([^{}]+?)\}\}/g)) {
    const body = m[1].trim();
    const relFile = file.replace(cwd() + "/", "");
    const bibMatch = body.match(/^bib:(.+)$/i);
    if (bibMatch) {
      const rest = bibMatch[1];
      const commaIdx = rest.indexOf(",");
      const id = commaIdx > 0 ? rest.slice(0, commaIdx).trim() : rest.trim();
      if (sourceIds.has(id)) {
        broken.push({
          file: relFile,
          line: 0,
          field: "{{bib:...}}",
          target: id,
          reason: `"${id}" is a ConceptSource (concept), not a bibliography entry. Use {{cite:${id}}} instead. bib: is ONLY for pure bibliographic records (papers, external docs) that are NOT concepts in any dataset.`
        });
      } else if (bibliography) {
        const entries = bibliography.bibliography ?? bibliography;
        if (!entries[id] && !(Array.isArray(entries) && entries.some((e) => e.id === id))) {
          broken.push({
            file: relFile,
            line: 0,
            field: "{{bib:...}}",
            target: id,
            reason: `bibliography entry "${id}" not found in bibliography.json. If this is a concept, use {{cite:...}} or {{urn:...}} instead.`
          });
        }
      } else {
        broken.push({
          file: relFile,
          line: 0,
          field: "{{bib:...}}",
          target: id,
          reason: `no bibliography.json for this dataset. If "${id}" is a concept, use {{cite:...}} or {{urn:...}} instead.`
        });
      }
      continue;
    }
    const linkMatch = body.match(/^link:(.+)$/i);
    if (linkMatch) {
      const rest = linkMatch[1];
      const commaIdx = rest.indexOf(",");
      const url = commaIdx > 0 ? rest.slice(0, commaIdx).trim() : rest.trim();
      if (!/^https?:\/\//.test(url)) {
        broken.push({ file: relFile, line: 0, field: "{{link:...}}", target: url, reason: "link must be http: or https: URL" });
      }
      continue;
    }
    const imageMatch = body.match(/^image:(.+)$/i);
    if (imageMatch) {
      const rest = imageMatch[1];
      const commaIdx = rest.indexOf(",");
      const src = commaIdx > 0 ? rest.slice(0, commaIdx).trim() : rest.trim();
      if (!/^https?:\/\//.test(src) && !src.startsWith("data:")) {
        const imgPath = join(cwd(), "public", src.replace(/^\//, ""));
        if (!existsSync(imgPath)) {
          broken.push({ file: relFile, line: 0, field: "{{image:...}}", target: src, reason: `image file not found: public/${src.replace(/^\//, "")}` });
        }
      }
      continue;
    }
    const citeMatch = body.match(/^cite:(.+)$/i);
    if (citeMatch) {
      const rest = citeMatch[1];
      const commaIdx = rest.indexOf(",");
      const rawId = commaIdx > 0 ? rest.slice(0, commaIdx).trim() : rest.trim();
      const lastColon = rawId.lastIndexOf(":");
      const idPart = lastColon > 0 ? rawId.slice(lastColon + 1) : rawId;
      if (!sourceIds.has(rawId) && !sourceIds.has(idPart) && !sourceRefKeys.has(rawId)) {
        broken.push({ file: relFile, line: 0, field: "{{cite:...}}", target: rawId, reason: `source "${rawId}" not found in this concept's sources[]` });
      }
      continue;
    }
  }
  return broken;
}
function main() {
  if (!existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}
  Run after generate-data has produced public/data/`);
    process.exit(2);
  }
  const files = walk(DATA_DIR).filter((f) => f.includes("/concepts/") && f.endsWith(".json"));
  const broken = [];
  for (const file of files) {
    broken.push(...checkFile(file, DATA_DIR));
  }
  const seen = /* @__PURE__ */ new Set();
  const unique = broken.filter((b) => {
    const key = `${b.file}|${b.field}|${b.target}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (unique.length === 0) {
    const total = files.length;
    console.log(`All ${total} concept files have resolvable internal links.`);
    process.exit(0);
  }
  console.error(`Found ${unique.length} broken internal link(s) across ${files.length} concept files:
`);
  for (const b of unique) {
    console.error(`  ${b.file}`);
    console.error(`    field:   ${b.field}`);
    console.error(`    target:  ${b.target}`);
    console.error(`    reason:  ${b.reason}`);
    console.error("");
  }
  console.error("Build FAILED. Fix the broken links above (correct YAML refs) and re-run.");
  process.exit(1);
}
var isDirect = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isDirect) main();
export {
  checkFile,
  localPathForUri
};
