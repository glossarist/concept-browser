// scripts/lib/concept-uri.ts
function buildConceptUri(uriBase, registerId, conceptId) {
  return `${uriBase}/dataset/${registerId}/concept/${conceptId}`;
}

// scripts/bridge-to-astro.ts
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from "fs";
import { join } from "path";
var CWD = process.cwd();
var PUBLIC_DATA = join(CWD, "public", "data");
var PUBLIC_ROOT = join(CWD, "public");
var CONTENT_DIR = join(CWD, ".cb-content");
function readJson(p) {
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf-8"));
}
function writeJson(dir, name, data) {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), JSON.stringify(data, null, 2));
}
var registryPath = join(PUBLIC_ROOT, "datasets.json");
var siteConfigPath = join(PUBLIC_ROOT, "site-config.json");
var registry = readJson(registryPath) || [];
var siteConfig = readJson(siteConfigPath) || {};
console.log(`Bridging ${registry.length} datasets to content collections...`);
for (const reg of registry) {
  const id = reg.id;
  const manifestPath = join(PUBLIC_DATA, id, "manifest.json");
  const manifest = readJson(manifestPath);
  if (!manifest) {
    console.warn(`  Skipping ${id}: no manifest.json`);
    continue;
  }
  const summary = reg.summary || {};
  const entry = {
    id: manifest.id || id,
    title: summary.title || manifest.title || id,
    description: summary.description || manifest.description || "",
    uri: manifest.datasetUri || reg.datasetUri || "",
    uriBase: manifest.uriBase || reg.uriBase || "",
    year: manifest.year ?? summary.year ?? void 0,
    status: manifest.status || summary.status || "valid",
    ref: manifest.ref || reg.ref || void 0,
    refAliases: manifest.refAliases || reg.refAliases || void 0,
    owner: summary.owner || manifest.owner || "",
    languages: manifest.languages || summary.languages || ["eng"],
    conceptCount: manifest.conceptCount || summary.conceptCount || 0,
    color: summary.color || manifest.color || void 0,
    tags: summary.tags || manifest.tags || [],
    sections: manifest.sections || [],
    sourceRepo: manifest.sourceRepo || "",
    lastUpdated: manifest.lastUpdated || ""
  };
  Object.keys(entry).forEach((k) => entry[k] === void 0 && delete entry[k]);
  writeJson(join(CONTENT_DIR, "datasets"), `${id}.json`, entry);
  console.log(`  Dataset: ${id} (${entry.conceptCount} concepts)`);
  const indexPath = join(PUBLIC_DATA, id, "index.json");
  const index = readJson(indexPath);
  if (index && index.concepts) {
    for (const concept of index.concepts) {
      if (!concept) continue;
      const conceptEntry = {
        registerId: id,
        conceptId: concept.id,
        uri: buildConceptUri(entry.uriBase || "", id, concept.id),
        status: concept.status || "valid",
        designations: concept.designations || {},
        eng: concept.eng || concept.designations?.eng || "",
        groups: concept.groups || [],
        tags: []
      };
      const fullConceptPath = join(PUBLIC_DATA, id, "concepts", `${concept.id}.json`);
      const fullConcept = readJson(fullConceptPath);
      if (fullConcept) {
        const lc = fullConcept["gl:localizedConcept"] || fullConcept.localizedConcept || {};
        const localizations = {};
        for (const [lang, loc] of Object.entries(lc)) {
          localizations[lang] = {
            languageCode: loc["gl:languageCode"] || lang,
            terms: (loc["gl:designation"] || []).map((d) => ({ designation: d["gl:term"] || d.term || "", normativeStatus: d["gl:normativeStatus"] || d.normativeStatus })).filter((d) => d.designation),
            definitions: (loc["gl:definition"] || []).map((d) => ({ content: d["gl:content"] || d.content || "" })).filter((d) => d.content),
            notes: (loc["gl:notes"] || []).map((n) => ({ content: n["gl:content"] || n.content || "" })).filter((n) => n.content),
            examples: (loc["gl:examples"] || []).map((e) => ({ content: e["gl:content"] || e.content || "" })).filter((e) => e.content)
          };
        }
        conceptEntry.localizations = localizations;
        conceptEntry.languages = Object.keys(localizations);
      }
      writeJson(
        join(CONTENT_DIR, "concepts", id),
        `${concept.id}.json`,
        conceptEntry
      );
    }
    console.log(`    ${index.concepts.filter(Boolean).length} concepts bridged`);
  }
}
var groups = siteConfig.datasetGroups || [];
for (const g of groups) {
  const entry = {
    id: g.id,
    label: g.label || g.id,
    kind: g.kind || (g.series ? "lineage" : "default"),
    description: g.description || "",
    current: g.current || void 0,
    datasets: g.datasets || [],
    color: g.color || void 0
  };
  Object.keys(entry).forEach((k) => entry[k] === void 0 && delete entry[k]);
  writeJson(join(CONTENT_DIR, "groups"), `${g.id}.json`, entry);
  console.log(`  Group: ${g.id} (${entry.datasets.length} datasets)`);
}
var pagesDir = join(CWD, "public", "pages");
if (existsSync(pagesDir)) {
  mkdirSync(join(CONTENT_DIR, "pages"), { recursive: true });
  for (const file of readdirSync(pagesDir)) {
    if (!file.endsWith(".json")) continue;
    const page = readJson(join(pagesDir, file));
    if (!page) continue;
    const slug = file.replace(".json", "");
    const md = `---
title: "${page.title || slug}"
type: "page"
---

${page.html || ""}
`;
    writeFileSync(join(CONTENT_DIR, "pages", `${slug}.md`), md);
  }
  console.log("  Pages bridged from public/pages/");
}
console.log("Data bridge complete.");
