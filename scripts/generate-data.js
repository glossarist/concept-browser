// scripts/generate-data.ts
import fs2 from "fs";
import os from "os";
import path3 from "path";
import { Worker as WorkerThread } from "node:worker_threads";
import { createHash as createHash2 } from "node:crypto";
import yaml4 from "js-yaml";
import {
  naturalSort,
  Register,
  parseMentions,
  InvalidMentionError,
  parseConceptYaml,
  conceptToTurtle,
  conceptsToTbx,
  emitOutputSet
} from "glossarist";

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
  const config2 = normalizeObject(raw);
  return { config: config2, configPath };
}

// src/utils/source-standard.ts
function standardLabel(ref) {
  const parts = [ref?.source, ref?.id].map((part) => part?.trim().replace(/\s+/g, " ") ?? "").filter(Boolean);
  return parts.join(" ") || null;
}
function standardKey(ref) {
  return standardLabel(ref)?.toLowerCase() ?? null;
}
function collectStandardKeys(concept) {
  const sources = [
    ...concept.sources,
    ...concept.languages.flatMap((lang) => concept.localization(lang)?.sources ?? [])
  ];
  const keys = /* @__PURE__ */ new Set();
  for (const source of sources) {
    if (source.type !== "authoritative") continue;
    const key = standardKey(source.origin?.ref);
    if (key !== null) keys.add(key);
  }
  return [...keys];
}

// scripts/lib/concept-groups.ts
function getGroups(conceptYaml) {
  if (conceptYaml.eng && conceptYaml.eng.groups) return conceptYaml.eng.groups;
  if (conceptYaml._domains) {
    const sectionIds = conceptYaml._domains.filter((d) => d.ref_type === "section" && d.concept_id).map((d) => d.concept_id.replace(/^section-/, ""));
    if (sectionIds.length) return sectionIds;
  }
  const termid = String(conceptYaml.termid);
  if (/^\d{3}-/.test(termid)) return [termid.substring(0, 3)];
  if (/^\d+\.\d+\.\d+/.test(termid)) {
    const parts = termid.split(".");
    return [`${parts[0]}.${parts[1]}.${parts[2]}`];
  }
  return [];
}

// scripts/lib/build/non-verbal-consumer.ts
import { readFile, writeFile, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import yaml2 from "js-yaml";
var KIND_META = {
  figure: { dir: "figures", type: "Figure" },
  table: { dir: "tables", type: "Table" },
  formula: { dir: "formulas", type: "Formula" }
};
function yamlEntityToJsonLd(yaml5, kind) {
  const meta = KIND_META[kind];
  const doc = {
    "@type": `gl:${meta.type}`,
    "gl:id": yaml5.id
  };
  if (yaml5.identifier) doc["gl:identifier"] = yaml5.identifier;
  if (yaml5.caption) doc["gl:caption"] = yaml5.caption;
  if (yaml5.alt) doc["gl:altText"] = yaml5.alt;
  if (yaml5.description) doc["gl:description"] = yaml5.description;
  if (Array.isArray(yaml5.sources) && yaml5.sources.length) {
    doc["gl:source"] = yaml5.sources.map((s) => yamlSourceToJsonLd(s));
  }
  if (kind === "figure") {
    if (Array.isArray(yaml5.images)) {
      doc["gl:image"] = yaml5.images.map((img) => ({
        "gl:src": img.src,
        "gl:format": img.format,
        ...img.role ? { "gl:role": img.role } : {},
        ...img.width != null ? { "gl:width": img.width } : {},
        ...img.height != null ? { "gl:height": img.height } : {},
        ...img.scale != null ? { "gl:scale": img.scale } : {}
      }));
    }
    if (Array.isArray(yaml5.subfigures) && yaml5.subfigures.length) {
      doc["gl:subfigure"] = yaml5.subfigures.map((sub) => yamlEntityToJsonLd(sub, "figure"));
    }
  } else if (kind === "table") {
    if (yaml5.content) {
      const c = { ...yaml5.content };
      if (c.type) {
        c["gl:type"] = c.type;
        delete c.type;
      }
      doc["gl:content"] = c;
    }
    if (yaml5.format) doc["gl:format"] = yaml5.format;
  } else if (kind === "formula") {
    if (yaml5.expression) doc["gl:expression"] = yaml5.expression;
    if (yaml5.notation) doc["gl:notation"] = yaml5.notation;
  }
  return doc;
}
function yamlSourceToJsonLd(s) {
  const out = {};
  if (s.id) out["gl:id"] = s.id;
  if (s.type) out["gl:sourceType"] = s.type;
  if (s.status) out["gl:sourceStatus"] = s.status;
  if (s.modification) out["gl:modification"] = s.modification;
  if (s.origin) {
    const o = {};
    if (s.origin.ref) {
      o["gl:ref"] = typeof s.origin.ref === "string" ? s.origin.ref : {
        ...s.origin.ref.source ? { "gl:source": s.origin.ref.source } : {},
        ...s.origin.ref.id ? { "gl:id": s.origin.ref.id } : {},
        ...s.origin.ref.version ? { "gl:version": s.origin.ref.version } : {},
        ...s.origin.ref.text ? { "gl:text": s.origin.ref.text } : {}
      };
    }
    if (s.origin.locality) {
      const l = s.origin.locality;
      o["gl:locality"] = {
        ...l.type ? { "gl:localityType": l.type } : {},
        ...l.reference_from ? { "gl:referenceFrom": l.reference_from } : {},
        ...l.reference_to ? { "gl:referenceTo": l.reference_to } : {}
      };
    }
    if (s.origin.link) o["gl:link"] = s.origin.link;
    if (Object.keys(o).length) out["gl:origin"] = o;
  }
  return out;
}
async function readEntitiesForKind(sourceDir, kind) {
  const meta = KIND_META[kind];
  const dir = path.join(sourceDir, meta.dir);
  let files;
  try {
    files = await readdir(dir);
  } catch {
    return [];
  }
  const out = [];
  for (const file of files) {
    const full = path.join(dir, file);
    const st = await stat(full);
    if (!st.isFile()) continue;
    const ext = path.extname(file).toLowerCase();
    const id = path.basename(file, ext);
    if (ext === ".json") {
      try {
        const doc = JSON.parse(await readFile(full, "utf8"));
        out.push({ id, doc });
      } catch (e) {
        console.warn(`  Warning: failed to parse ${full}: ${e.message}`);
      }
    } else if (ext === ".yaml" || ext === ".yml") {
      try {
        const raw = yaml2.load(await readFile(full, "utf8"));
        if (!raw || typeof raw !== "object") continue;
        out.push({ id, doc: yamlEntityToJsonLd(raw, kind) });
      } catch (e) {
        console.warn(`  Warning: failed to parse ${full}: ${e.message}`);
      }
    }
  }
  return out;
}
async function consumeDatasetEntities(sourceRoot, destRoot) {
  const counts2 = { figures: 0, tables: 0, formulas: 0 };
  const warnings = [];
  for (
    const kind of
    /** @type {NonVerbalKind[]} */
    ["figure", "table", "formula"]
  ) {
    const meta = KIND_META[kind];
    const entities = await readEntitiesForKind(sourceRoot, kind);
    if (entities.length === 0) continue;
    const outDir = path.join(destRoot, meta.dir);
    await mkdir(outDir, { recursive: true });
    const index = {};
    for (const { id, doc } of entities) {
      const docId = doc["gl:id"] ?? doc["gloss:id"] ?? id;
      if (docId !== id) {
        warnings.push(`${meta.dir}/${id}: gl:id (${docId}) does not match filename`);
      }
      const dest = path.join(outDir, `${id}.json`);
      await writeFile(dest, JSON.stringify(doc, null, 2));
      index[id] = `${meta.dir}/${id}.json`;
      if (!doc[`gl:${kind === "figure" ? "altText" : ""}`] && kind === "figure") {
        warnings.push(`${meta.dir}/${id}: missing gl:altText (accessibility)`);
      }
      if (!doc["gl:caption"]) {
        warnings.push(`${meta.dir}/${id}: missing gl:caption`);
      }
    }
    const indexDest = path.join(destRoot, `${meta.dir}-index.json`);
    await writeFile(indexDest, JSON.stringify(index, null, 2));
    counts2[meta.dir] = entities.length;
  }
  return {
    figures: counts2.figures,
    tables: counts2.tables,
    formulas: counts2.formulas,
    warnings
  };
}

// scripts/lib/build/image-assets.ts
import { createHash } from "node:crypto";
import { readFile as readFile2, writeFile as writeFile2, mkdir as mkdir2, readdir as readdir2, stat as stat2, copyFile } from "node:fs/promises";
import path2 from "node:path";
var SUPPORTED_FORMATS = /* @__PURE__ */ new Set(["svg", "png", "jpg", "jpeg", "gif", "webp", "avif"]);
var MAGIC_BYTES = {
  png: [137, 80, 78, 71, 13, 10, 26, 10],
  jpg: [255, 216, 255],
  gif: [71, 73, 70, 56],
  webp: [82, 73, 70, 70]
  // "RIFF" — full match needs bytes 8-11 = "WEBP"
};
var FILENAME_RE = /^[a-z0-9._-]+$/i;
function detectFormat(buf, ext) {
  const e = ext.toLowerCase();
  if (e === "svg") return buf.includes("<svg") || buf.includes("<SVG") ? "svg" : null;
  if (e === "png" || e === "jpg" || e === "jpeg" || e === "gif" || e === "webp") {
    const png = MAGIC_BYTES.png;
    if (e === "png" && buf.length >= png.length && png.every((b, i) => buf[i] === b)) return "png";
    const jpg = MAGIC_BYTES.jpg;
    if ((e === "jpg" || e === "jpeg") && buf.length >= jpg.length && jpg.every((b, i) => buf[i] === b)) return "jpg";
    const gif = MAGIC_BYTES.gif;
    if (e === "gif" && buf.length >= gif.length && gif.every((b, i) => buf[i] === b)) return "gif";
    if (e === "webp" && buf.length >= 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "webp";
  }
  if (SUPPORTED_FORMATS.has(e)) return e;
  return null;
}
function readIntrinsicDimensions(buf, format) {
  if (format === "png" && buf.length >= 24) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (format === "jpg" || format === "jpeg") {
    return readJpegDimensions(buf);
  }
  return {};
}
function readJpegDimensions(buf) {
  let i = 2;
  while (i < buf.length - 9) {
    if (buf[i] !== 255) {
      i++;
      continue;
    }
    const marker = buf[i + 1];
    if (marker >= 192 && marker <= 207 && marker !== 196 && marker !== 200 && marker !== 204) {
      const height = buf.readUInt16BE(i + 5);
      const width = buf.readUInt16BE(i + 7);
      return { width, height };
    }
    const segLen = buf.readUInt16BE(i + 2);
    i += 2 + segLen;
  }
  return {};
}
function sanitizeImageFilename(name) {
  const lowered = name.toLowerCase();
  const sanitized = lowered.replace(/[^a-z0-9._-]/g, "-").replace(/-+/g, "-");
  return sanitized.replace(/^-+|-+$/g, "");
}
function sha256(buf) {
  return createHash("sha256").update(buf).digest("hex");
}
async function copyImageAssets(srcDir, destDir) {
  await mkdir2(destDir, { recursive: true });
  const entries = await readdir2(srcDir, { withFileTypes: true });
  const upstreamManifestPath = path2.join(srcDir, "manifest.json");
  let upstream = null;
  try {
    const st = await stat2(upstreamManifestPath);
    if (st.isFile()) {
      upstream = JSON.parse(await readFile2(upstreamManifestPath, "utf8"));
    }
  } catch {
  }
  const manifest = {};
  const skipped = [];
  let count = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    if (entry.name === "manifest.json") continue;
    const safeName = sanitizeImageFilename(entry.name);
    if (!FILENAME_RE.test(safeName)) {
      skipped.push(entry.name);
      continue;
    }
    const ext = path2.extname(safeName).slice(1);
    if (!ext || !SUPPORTED_FORMATS.has(ext)) {
      skipped.push(entry.name);
      continue;
    }
    const src = path2.join(srcDir, entry.name);
    const dest = path2.join(destDir, safeName);
    const buf = await readFile2(src);
    const format = detectFormat(buf, ext);
    if (!format) {
      skipped.push(`${entry.name} (format mismatch)`);
      continue;
    }
    await copyFile(src, dest);
    let entry_record;
    if (upstream && upstream[safeName]) {
      entry_record = { ...upstream[safeName], src: safeName, format };
    } else {
      const dims = readIntrinsicDimensions(buf, format);
      entry_record = {
        src: safeName,
        format,
        sha256: sha256(buf),
        bytes: buf.length,
        ...dims
      };
    }
    manifest[safeName] = entry_record;
    count++;
  }
  await mkdir2(destDir, { recursive: true });
  await writeFile2(
    path2.join(destDir, "..", "images-manifest.json"),
    JSON.stringify(manifest, null, 2)
  );
  return { count, manifest, skipped };
}

// scripts/lib/curation.ts
function collectCurationFlags(conceptYaml, languages) {
  const missingLanguages = [];
  let hasSources = Array.isArray(conceptYaml._sources) && conceptYaml._sources.length > 0;
  for (const lang of languages) {
    const lc = conceptYaml[lang];
    const terms = lc?.terms;
    const hasTerms = Array.isArray(terms) && terms.length > 0;
    if (!hasTerms) missingLanguages.push(lang);
    if (Array.isArray(lc?.sources) && lc.sources.length > 0) hasSources = true;
  }
  return { missingLanguages, noSources: !hasSources };
}
function buildCurationReport(registerId, conceptCount, languages, entries, unparseableFiles = []) {
  const validation = [];
  const missingTranslations = [];
  const noSources = [];
  for (const entry of entries) {
    if (entry.parseError) {
      validation.push({ id: entry.id, designation: entry.designation, reason: entry.parseError });
    }
    if (entry.flags.missingLanguages.length > 0) {
      missingTranslations.push({
        id: entry.id,
        designation: entry.designation,
        missing: entry.flags.missingLanguages
      });
    }
    if (entry.flags.noSources) {
      noSources.push({ id: entry.id, designation: entry.designation });
    }
  }
  for (const file of unparseableFiles) {
    validation.push({ id: file, designation: "", reason: "source file could not be parsed" });
  }
  const byId = (a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  return {
    registerId,
    conceptCount,
    languages,
    validation: { count: validation.length, items: validation.sort(byId) },
    missingTranslations: { count: missingTranslations.length, items: missingTranslations.sort(byId) },
    noSources: { count: noSources.length, items: noSources.sort(byId) }
  };
}

// scripts/lib/dataset-turtle.ts
import {
  datasetToQuads,
  collectQuads,
  writeTurtle,
  PREFIXES
} from "glossarist/rdf";
function writerPrefixes() {
  const out = {};
  for (const k of ["dcat", "skos", "dcterms", "prov", "rdf", "rdfs", "xsd"]) {
    if (PREFIXES[k]) out[k] = PREFIXES[k];
  }
  out.dcat ??= "http://www.w3.org/ns/dcat#";
  out.prov ??= "http://www.w3.org/ns/prov#";
  return out;
}
async function buildDatasetTurtle(input) {
  const quads = collectQuads(datasetToQuads(input));
  return writeTurtle(quads, { prefixes: writerPrefixes() });
}

// scripts/lib/build-activity-turtle.ts
import {
  buildActivityToQuads,
  collectQuads as collectQuads2,
  writeTurtle as writeTurtle2
} from "glossarist/rdf";
function writerPrefixes2() {
  return {
    prov: "http://www.w3.org/ns/prov#",
    dcterms: "http://purl.org/dc/terms/",
    foaf: "http://xmlns.com/foaf/0.1/",
    rdf: "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#",
    gloss: "https://www.glossarist.org/ontologies/"
  };
}
async function buildActivityTurtle(input) {
  const quads = collectQuads2(buildActivityToQuads(input));
  return writeTurtle2(quads, { prefixes: writerPrefixes2() });
}

// scripts/lib/vocab-turtle.ts
import { readFileSync as readFileSync2, existsSync as existsSync2 } from "node:fs";
import { join, dirname as dirname2 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
import {
  vocabularyToQuads,
  collectQuads as collectQuads3,
  writeTurtle as writeTurtle3,
  PREFIXES as PREFIXES2
} from "glossarist/rdf";
var __dirname2 = dirname2(fileURLToPath2(import.meta.url));
function findVocabPath() {
  const candidates = [
    join(__dirname2, "..", "..", "data", "glossarist-vocab.json"),
    join(__dirname2, "..", "data", "glossarist-vocab.json")
  ];
  for (const p of candidates) {
    if (existsSync2(p)) return p;
  }
  throw new Error(
    `glossarist-vocab.json not found. Tried:
${candidates.map((p) => "  " + p).join("\n")}`
  );
}
function loadVocab() {
  return JSON.parse(readFileSync2(findVocabPath(), "utf8"));
}
function writerPrefixes3() {
  const out = {};
  for (const [k, v] of Object.entries(PREFIXES2)) {
    out[k] = v;
  }
  return out;
}
async function buildVocabularyTurtle() {
  const vocab = loadVocab();
  const quads = collectQuads3(vocabularyToQuads(vocab.schemes));
  return writeTurtle3(quads, { prefixes: writerPrefixes3() });
}

// scripts/lib/agents-turtle.ts
import {
  agentsFromContributors,
  agentsToQuads,
  collectQuads as collectQuads4,
  writeTurtle as writeTurtle4
} from "glossarist/rdf";
function writerPrefixes4() {
  return {
    foaf: "http://xmlns.com/foaf/0.1/",
    prov: "http://www.w3.org/ns/prov#",
    dcterms: "http://purl.org/dc/terms/",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#"
  };
}
async function buildAgentsTurtle(contributors2, agentBase, orgBase) {
  if (!agentBase) throw new Error("buildAgentsTurtle requires agentBase");
  if (!orgBase) throw new Error("buildAgentsTurtle requires orgBase");
  const agents = agentsFromContributors(contributors2 ?? [], agentBase);
  const quads = collectQuads4(agentsToQuads(agents, { orgBase }));
  return writeTurtle4(quads, { prefixes: writerPrefixes4() });
}

// scripts/lib/version-turtle.ts
import {
  versionToQuads,
  versionHistoryToQuads,
  collectQuads as collectQuads5,
  writeTurtle as writeTurtle5
} from "glossarist/rdf";
function writerPrefixes5() {
  return {
    prov: "http://www.w3.org/ns/prov#",
    dcterms: "http://purl.org/dc/terms/",
    rdfs: "http://www.w3.org/2000/01/rdf-schema#",
    xsd: "http://www.w3.org/2001/XMLSchema#"
  };
}
async function buildVersionHistoryTurtle(input) {
  const quads = collectQuads5(versionHistoryToQuads(input));
  return writeTurtle5(quads, { prefixes: writerPrefixes5() });
}

// scripts/lib/bibliography-turtle.ts
import {
  bibliographyToQuads,
  normalizeBibliographyData,
  collectQuads as collectQuads6,
  writeTurtle as writeTurtle6
} from "glossarist/rdf";
function writerPrefixes6() {
  return {
    dcterms: "http://purl.org/dc/terms/",
    foaf: "http://xmlns.com/foaf/0.1/",
    gloss: "https://www.glossarist.org/ontologies/"
  };
}
async function buildBibliographyTurtle(register, bibliographyJson, baseUri) {
  if (!baseUri) throw new Error("buildBibliographyTurtle requires baseUri");
  const entries = normalizeBibliographyData(bibliographyJson);
  const quads = collectQuads6(bibliographyToQuads({ registerId: register, entries, baseUri }));
  return writeTurtle6(quads, { prefixes: writerPrefixes6() });
}

// scripts/lib/first-non-empty.ts
function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v == null) continue;
    if (Array.isArray(v) && v.length === 0) continue;
    if (typeof v === "string" && v === "") continue;
    return v;
  }
  return void 0;
}

// scripts/lib/bibliography.ts
function normalizeBibliography(raw) {
  if (Array.isArray(raw)) return { bibliography: raw };
  if (raw && Array.isArray(raw.bibliography)) return raw;
  return { bibliography: [] };
}

// scripts/lib/concept-uri.ts
function buildConceptUri(uriBase, registerId, conceptId) {
  return `${uriBase}/dataset/${registerId}/concept/${conceptId}`;
}
function buildConceptUriPrefix(uriBase, registerId) {
  return `${uriBase}/dataset/${registerId}/concept/`;
}
function buildSiteOrigin(domain, uriBase) {
  if (domain) {
    const trimmed = String(domain).trim().replace(/\/+$/, "");
    return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  }
  return uriBase.replace(/\/+$/, "");
}

// scripts/lib/harmonize-concept.ts
import fs from "fs";
import yaml3 from "js-yaml";
var LEGACY_MULTIPLICITY_MAP = {
  compulsory: { presence: "required", count: "exactly_one" },
  optional: { presence: "optional", count: "exactly_one" },
  compulsory_multiple: { presence: "required", count: "multiple" },
  optional_multiple: { presence: "optional", count: "multiple" },
  compulsory_at_least_one: { presence: "required", count: "at_least_one" }
};
var LEGACY_CERTAINTY_FROM_AXIS = {
  required: "confirmed",
  optional: "possible"
};
function splitMultiplicity(multiplicity) {
  return multiplicity in LEGACY_MULTIPLICITY_MAP ? LEGACY_MULTIPLICITY_MAP[multiplicity] : { presence: "required", count: "exactly_one" };
}
function loadConceptFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const docs = yaml3.loadAll(content, null, { schema: yaml3.DEFAULT_SCHEMA });
  if (docs.length === 1 && docs[0].termid !== void 0) {
    return docs[0];
  }
  if (docs.length >= 1 && docs[0].data && docs[0].data.identifier !== void 0) {
    const mc = docs[0];
    const result = { termid: String(mc.data.identifier) };
    if (mc.related) result._related = mc.related;
    if (mc.partitive_relations) result._partitiveRelations = mc.partitive_relations;
    if (mc.generic_relations) result._genericRelations = mc.generic_relations;
    if (mc.data.domains) result._domains = mc.data.domains;
    if (mc.dates) result._dates = mc.dates;
    if (mc.sources) result._sources = mc.sources;
    if (mc.status) result._status = mc.status;
    if (mc.schema_version) result._schemaVersion = mc.schema_version;
    if (mc.date_accepted) result._dateAccepted = mc.date_accepted;
    const MERGE_KEYS = [
      "terms",
      "definition",
      "notes",
      "annotations",
      "examples",
      "sources",
      "dates",
      "domain",
      "references",
      "entry_status",
      "classification",
      "review_type",
      "review_date",
      "review_decision_date",
      "review_decision_event",
      "review_status",
      "review_decision",
      "review_decision_notes",
      "lineage_source_similarity",
      "release",
      "script",
      "system"
    ];
    for (const doc of docs.slice(1)) {
      if (!doc) continue;
      const lang = doc.data?.language_code || doc.language_code;
      if (!lang) continue;
      const lcData = { ...doc.data || {} };
      delete lcData.language_code;
      for (const key of MERGE_KEYS) {
        if (doc[key] !== void 0 && lcData[key] === void 0) {
          lcData[key] = doc[key];
        }
      }
      result[lang] = lcData;
    }
    return result;
  }
  return docs[0];
}
function readYaml(filePath) {
  return yaml3.load(fs.readFileSync(filePath, "utf8"));
}
function stripHtml(s) {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

// scripts/lib/jsonld-emitter.ts
function resolveRefUri(term, refMaps2) {
  if (!refMaps2) return void 0;
  const lc = term.toLowerCase();
  if (refMaps2.urnMap?.[lc]) return refMaps2.urnMap[lc];
  if (refMaps2.designationMap?.[lc]) return refMaps2.designationMap[lc];
  if (refMaps2.numericMap?.[term]) return refMaps2.numericMap[term];
  return void 0;
}
function termToDesignation(term) {
  const typeMap = {
    expression: "gl:Expression",
    abbreviation: "gl:Abbreviation",
    symbol: "gl:Symbol",
    letter_symbol: "gl:LetterSymbol",
    "graphical symbol": "gl:GraphicalSymbol"
  };
  const doc = {
    "@type": typeMap[term.type] || "gl:Designation",
    "gl:normativeStatus": term.normative_status || "preferred",
    "gl:term": term.designation
  };
  if (term.grammar_info && term.grammar_info.length > 0) {
    doc["gl:grammarInfo"] = term.grammar_info.map((gi) => {
      const g = {};
      if (gi.gender) g["gl:gender"] = gi.gender;
      if (gi.number) g["gl:number"] = gi.number;
      if (gi.partOfSpeech) g["gl:partOfSpeech"] = gi.partOfSpeech;
      for (const pos of ["noun", "verb", "adj", "adverb", "preposition", "participle"]) {
        if (gi[pos]) g[`gl:${pos}`] = gi[pos];
      }
      return g;
    });
  }
  if (term.international !== void 0) doc["gl:international"] = term.international;
  if (term.absent !== void 0) doc["gl:absent"] = term.absent;
  if (term.geographical_area) doc["gl:geographicalArea"] = term.geographical_area;
  if (term.term_type) doc["gl:termType"] = term.term_type;
  if (term.prefix) doc["gl:prefix"] = term.prefix;
  if (term.usage_info) doc["gl:usageInfo"] = term.usage_info;
  if (term.field_of_application) doc["gl:fieldOfApplication"] = term.field_of_application;
  if (term.acronym !== void 0) doc["gl:acronym"] = term.acronym;
  if (term.initialism !== void 0) doc["gl:initialism"] = term.initialism;
  if (term.truncation !== void 0) doc["gl:truncation"] = term.truncation;
  if (term.text) doc["gl:text"] = term.text;
  if (term.image) doc["gl:image"] = term.image;
  if (term.related && term.related.length > 0) {
    doc["gl:related"] = term.related.map((r) => {
      const rel = {};
      if (r.type) rel["gl:relationshipType"] = r.type;
      if (r.target) {
        rel["gl:target"] = r.target;
      } else if (r.ref) {
        const ref = { "@type": "gl:ConceptRef" };
        if (r.ref.source) ref["gl:source"] = r.ref.source;
        if (r.ref.id) ref["gl:id"] = r.ref.id;
        if (r.ref.text) ref["gl:text"] = r.ref.text;
        rel["gl:ref"] = ref;
      }
      return rel;
    });
  }
  return doc;
}
function defsToJsonLd(defs) {
  if (!defs || !Array.isArray(defs)) return [];
  return defs.map((d) => ({ "@type": "gl:DetailedDefinition", "gl:content": d.content || "" })).filter((d) => d["gl:content"]);
}
function refToJsonLd(ref, typeName = "gl:Ref") {
  if (!ref) return void 0;
  if (ref.ellipsis === true) {
    return { "@type": typeName, "gl:ellipsis": true };
  }
  const refObj = { "@type": typeName };
  if (typeof ref === "string") {
    refObj["gl:source"] = ref;
  } else {
    if (ref.source) refObj["gl:source"] = ref.source;
    if (ref.id) refObj["gl:id"] = ref.id;
    if (ref.version) refObj["gl:version"] = ref.version;
    if (ref.text) refObj["gl:text"] = ref.text;
    if (ref.external === true) refObj["gl:external"] = true;
  }
  return refObj;
}
function localityToJsonLd(loc) {
  if (!loc) return void 0;
  const locObj = {};
  if (loc.type) locObj["gl:localityType"] = loc.type;
  if (loc.reference_from) locObj["gl:referenceFrom"] = loc.reference_from;
  if (loc.referenceFrom) locObj["gl:referenceFrom"] = loc.referenceFrom;
  if (loc.reference_to) locObj["gl:referenceTo"] = loc.reference_to;
  if (loc.referenceTo) locObj["gl:referenceTo"] = loc.referenceTo;
  return Object.keys(locObj).length > 0 ? locObj : void 0;
}
function citationToJsonLd(citation) {
  const obj = {};
  const ref = refToJsonLd(citation.ref);
  if (ref) obj["gl:ref"] = ref;
  const loc = localityToJsonLd(citation.locality);
  if (loc) obj["gl:locality"] = loc;
  if (citation.link) obj["gl:link"] = citation.link;
  return obj;
}
function sourcesToJsonLd(sources) {
  if (!sources || !Array.isArray(sources)) return [];
  return sources.map((s) => {
    const doc = { "@type": "gl:ConceptSource" };
    if (s.id) doc["gl:id"] = s.id;
    if (s.type) doc["gl:sourceType"] = s.type;
    if (s.status) doc["gl:sourceStatus"] = s.status;
    if (s.modification) doc["gl:modification"] = s.modification;
    if (s.origin) {
      const origin = { "@type": "gl:Citation" };
      const ref = refToJsonLd(s.origin.ref);
      if (ref) origin["gl:ref"] = ref;
      const loc = localityToJsonLd(s.origin.locality);
      if (loc) origin["gl:locality"] = loc;
      if (s.origin.link) origin["gl:link"] = s.origin.link;
      doc["gl:origin"] = origin;
    }
    if (s.sourced_from && s.sourced_from.length) {
      doc["gl:sourcedFrom"] = s.sourced_from.map((sf) => {
        const cite = { "@type": "gl:Citation" };
        const ref = refToJsonLd(sf.ref);
        if (ref) cite["gl:ref"] = ref;
        const loc = localityToJsonLd(sf.locality);
        if (loc) cite["gl:locality"] = loc;
        if (sf.link) cite["gl:link"] = sf.link;
        return cite;
      });
    }
    return doc;
  });
}
function refsToJsonLd(refs, refMaps2) {
  if (!refs || !Array.isArray(refs)) return [];
  return refs.map((r) => {
    if (r.id) {
      const ref = { "@id": r.id, "gl:term": r.term };
      if (r.sourceId) ref["gl:sourceId"] = r.sourceId;
      if (r.citation) ref["gl:citation"] = citationToJsonLd(r.citation);
      return ref;
    }
    if (r.term && refMaps2) {
      const uri = resolveRefUri(r.term, refMaps2);
      if (uri) return { "@id": uri, "gl:term": r.term };
    }
    return { "@id": r.id || r.term, "gl:term": r.term };
  }).filter((r) => r["@id"]);
}

// scripts/generate-data.ts
var __dirname3 = path3.dirname(new URL(import.meta.url).pathname);
var ROOT = process.cwd();
var PUBLIC = path3.join(ROOT, "public");
var DATA = path3.join(PUBLIC, "data");
function datasetDir(ds) {
  return ds.localPath ? path3.resolve(ROOT, ds.localPath) : path3.join(ROOT, ".datasets", ds.id);
}
var DS_PALETTE = [
  "#3366ff",
  "#0d9488",
  "#d97706",
  "#8b5cf6",
  "#ec4899",
  "#059669",
  "#dc2626",
  "#6366f1",
  "#0891b2",
  "#65a30d"
];
function writeJson(filePath, data) {
  fs2.mkdirSync(path3.dirname(filePath), { recursive: true });
  fs2.writeFileSync(filePath, JSON.stringify(data));
}
async function writeDatasetRdf(register, manifest, concepts, refMaps2, opts) {
  const uriBase = refMaps2?.uriBase;
  if (!uriBase) throw new Error("generate-data: uriBase is required \u2014 set uriBase in site-config.yml");
  const datasetIri = `${uriBase}/${register}/`;
  const topConceptUris = concepts.slice(0, 32).map((c) => buildConceptUri(uriBase, register, c.id));
  const sections = (manifest.sections ?? []).map((section) => {
    const sectionId = section.id ?? section.slug ?? section.title;
    return {
      collectionIri: `${uriBase}/${register}/section/${sectionId}`,
      title: section.title ?? section.name ?? sectionId,
      memberUris: (section.members ?? []).map((id) => buildConceptUri(uriBase, register, id))
    };
  });
  const distributions = [
    {
      id: `${register}-ttl`,
      title: "Turtle distribution",
      mediaType: "text/turtle",
      downloadUrl: `${uriBase}/data/${register}/${register}.ttl`
    },
    {
      id: `${register}-jsonld`,
      title: "JSON-LD distribution",
      mediaType: "application/ld+json",
      downloadUrl: `${uriBase}/data/${register}/${register}.jsonld`
    }
  ];
  const ttl = await buildDatasetTurtle({
    datasetIri,
    registerId: register,
    title: manifest.title ?? register,
    description: manifest.description,
    modified: manifest.lastUpdated ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    languages: opts.languages ?? ["eng"],
    distributions,
    topConceptUris,
    sections,
    sourceRepoUrl: manifest.sourceRepoUrl,
    publisherIri: manifest.publisher,
    contactIri: manifest.contactPoint
  });
  fs2.writeFileSync(path3.join(DATA, register, `${register}.ttl`), ttl);
}
async function writeBuildActivity(conceptCount, datasetRegisters, baseUri) {
  const runId = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? "1"}` : `local-${(/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-")}`;
  const startedAt = process.env.BUILD_STARTED_AT ?? new Date(Date.now() - 6e4).toISOString();
  const endedAt = (/* @__PURE__ */ new Date()).toISOString();
  const gitSha = process.env.GITHUB_SHA ?? null;
  const gitBranch = process.env.GITHUB_REF_NAME ?? null;
  const pkgVersion = JSON.parse(fs2.readFileSync(path3.join(__dirname3, "..", "package.json"), "utf8")).version;
  const agentIri = process.env.CI_BOT_AGENT_IRI ?? null;
  const ttl = await buildActivityTurtle({
    runId,
    startedAt,
    endedAt,
    gitSha,
    gitBranch,
    toolId: "concept-browser",
    toolVersion: pkgVersion,
    datasetRegisters,
    conceptCount,
    associatedAgentIri: agentIri,
    baseUri
  });
  const activityDir = path3.join(DATA, "activity");
  fs2.mkdirSync(activityDir, { recursive: true });
  fs2.writeFileSync(path3.join(activityDir, `${runId}.ttl`), ttl);
  console.log(`Emitted build activity record: data/activity/${runId}.ttl`);
}
function buildPatternIndex(datasets, registerCache2) {
  const entries = [];
  for (const ds of datasets) {
    const reg = registerCache2[ds.id] || null;
    const patterns = /* @__PURE__ */ new Set();
    if (ds.uri) patterns.add(ds.uri);
    for (const alias of ds.uriAliases || []) patterns.add(alias);
    if (reg) {
      if (reg.urn && typeof reg.urn === "string" && reg.urn.endsWith("*")) patterns.add(reg.urn);
      for (const alias of reg.urnAliases || []) patterns.add(alias);
    }
    for (const pattern of patterns) {
      if (typeof pattern !== "string" || !pattern.endsWith("*")) continue;
      const prefix = pattern.slice(0, -1);
      if (prefix) entries.push({ prefix, datasetId: ds.id });
    }
  }
  entries.sort((a, b) => b.prefix.length - a.prefix.length);
  function resolve2(uri) {
    for (const { prefix, datasetId } of entries) {
      if (uri.startsWith(prefix)) {
        return { datasetId, conceptId: uri.slice(prefix.length) };
      }
    }
    return null;
  }
  return { resolve: resolve2, entries };
}
function buildRefMaps(config2, registerCache2) {
  const refPrefixMap = {};
  const patternIndex = buildPatternIndex(config2.datasets, registerCache2);
  for (const ds of config2.datasets) {
    if (ds.ref) refPrefixMap[ds.ref] = ds.id;
  }
  for (const route of config2.routing || []) {
    if (route.uri && route.uri.includes("iec") && route.uri.includes("60050")) {
      const mapped = route.targetDataset;
      if (mapped) refPrefixMap["IEV"] = mapped;
    }
  }
  const xref = config2.crossReferences || {};
  if (xref.refPrefixMap) Object.assign(refPrefixMap, xref.refPrefixMap);
  const uriBase = config2.uriBase;
  if (!uriBase) throw new Error("site-config.yml: uriBase is required");
  const siteOrigin = buildSiteOrigin(config2.domain, uriBase);
  return { patternIndex, refPrefixMap, uriBase, siteOrigin, register: null };
}
function resolveIevRef(display, term, refPrefixMap, uriBase) {
  if (!display.startsWith("IEV:")) return null;
  const datasetId = refPrefixMap["IEV"];
  if (!datasetId) return null;
  return { id: buildConceptUri(uriBase, datasetId, display.slice(4)), term };
}
function resolvePatternRef(identifier, display, refPrefixMap, patternIndex, uriBase) {
  const r = patternIndex.resolve(identifier);
  if (!r) return null;
  return { id: buildConceptUri(uriBase, r.datasetId, r.conceptId), term: display };
}
function collectTextContent(localizedData) {
  const texts = [];
  const textFields = ["definition", "notes", "examples"];
  for (const field of textFields) {
    const items = localizedData[field];
    if (!items) continue;
    const arr = Array.isArray(items) ? items : [items];
    for (const item of arr) {
      texts.push(typeof item === "string" ? item : item.content || "");
    }
  }
  return texts.join(" ");
}
function extractInlineRefs(localizedData, refMaps2, conceptSources = []) {
  const refs = [];
  const { refPrefixMap, patternIndex, uriBase } = refMaps2;
  const fullText = collectTextContent(localizedData);
  const allSources = [...localizedData.sources || [], ...conceptSources];
  for (const m of fullText.matchAll(/\{([^,}]+),([^,}]+)(?:,([^}]+))?\}/g)) {
    const identifier = m[1].trim();
    const display = m[2].trim();
    const altDisplay = (m[3] || "").trim();
    if (!identifier || !display) continue;
    const iev = resolveIevRef(display, identifier, refPrefixMap, uriBase);
    if (iev) {
      refs.push(iev);
      continue;
    }
    const pattern = resolvePatternRef(identifier, altDisplay || display, refPrefixMap, patternIndex, uriBase);
    if (pattern) {
      refs.push(pattern);
    }
  }
  for (const m of fullText.matchAll(/\{\{([^{}]+?)\}\}/g)) {
    const body = m[1];
    if (/^(bib|link|image):/i.test(body)) continue;
    let segments;
    try {
      segments = parseMentions(`{{${body}}}`);
    } catch (e) {
      if (e instanceof InvalidMentionError) {
        console.warn(`  Invalid mention: {{${body}}} \u2014 ${e.reason}`);
        continue;
      }
      throw e;
    }
    for (const seg of segments) {
      if (seg.kind === "text") continue;
      if (seg.kind === "bib" || seg.kind === "link" || seg.kind === "image") continue;
      if (seg.kind === "concept" || seg.kind === "cite") {
        const target = seg.target;
        if (target.type === "dataset_qualified" && target.dataset && target.id) {
          const dsId = refMaps2.refPrefixMap[target.dataset];
          if (dsId) {
            refs.push({ id: buildConceptUri(refMaps2.uriBase, dsId, target.id), term: seg.label ?? `${target.dataset}:${target.id}` });
          }
        } else if (target.type === "urn" && target.urn) {
          const pattern = refMaps2.patternIndex.resolve(target.urn);
          if (pattern) {
            refs.push({ id: buildConceptUri(refMaps2.uriBase, pattern.datasetId, pattern.conceptId), term: seg.label ?? target.urn });
          }
        } else if (target.type === "entity_id" && target.id) {
          refs.push({ id: buildConceptUri(refMaps2.uriBase, refMaps2.register, target.id), term: seg.label ?? target.id });
        }
      }
    }
  }
  const seen = /* @__PURE__ */ new Set();
  return refs.filter((r) => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}
var LANG_CODES = ["eng", "ara", "deu", "fra", "spa", "ita", "jpn", "kor", "pol", "por", "srp", "swe", "zho", "rus", "fin", "dan", "nld", "msa", "nob", "nno", "zho"];
function yamlToJsonLd(conceptYaml, register, refMaps2) {
  const termid = String(conceptYaml.termid);
  const base = refMaps2.uriBase;
  const doc = {
    "@context": "https://glossarist.org/ns/context.jsonld",
    "@id": buildConceptUri(base, register, termid),
    "@type": "gl:Concept",
    "gl:identifier": termid
  };
  const localizations = {};
  for (const lang of LANG_CODES) {
    const lc = conceptYaml[lang];
    if (!lc) continue;
    const lDoc = {
      "@id": `${base}/${register}/concept/${termid}/${lang}`,
      "@type": "gl:LocalizedConcept",
      "gl:languageCode": lang
    };
    if (lc.entry_status) lDoc["gl:entryStatus"] = lc.entry_status;
    if (lc.classification) lDoc["gl:classification"] = lc.classification;
    if (lc.review_type) lDoc["gl:reviewType"] = lc.review_type;
    if (lc.script) lDoc["gl:script"] = lc.script;
    if (lc.system) lDoc["gl:system"] = lc.system;
    if (lc.terms && lc.terms.length > 0) lDoc["gl:designation"] = lc.terms.map(termToDesignation);
    if (lc.definition) lDoc["gl:definition"] = defsToJsonLd(lc.definition);
    if (lc.notes && lc.notes.length > 0) lDoc["gl:notes"] = defsToJsonLd(lc.notes);
    if (lc.annotations && lc.annotations.length > 0) lDoc["gl:annotations"] = defsToJsonLd(lc.annotations);
    if (lc.examples && lc.examples.length > 0) lDoc["gl:examples"] = defsToJsonLd(lc.examples);
    if (lc.sources && lc.sources.length > 0) lDoc["gl:source"] = sourcesToJsonLd(lc.sources);
    if (lc.lineage_source_similarity !== void 0) lDoc["gl:lineageSourceSimilarity"] = lc.lineage_source_similarity;
    if (lc.release) lDoc["gl:release"] = lc.release;
    if (lc.review_date) lDoc["gl:reviewDate"] = lc.review_date;
    if (lc.review_decision_date) lDoc["gl:reviewDecisionDate"] = lc.review_decision_date;
    if (lc.review_decision_event) lDoc["gl:reviewDecisionEvent"] = lc.review_decision_event;
    if (lc.review_status) lDoc["gl:reviewStatus"] = lc.review_status;
    if (lc.review_decision) lDoc["gl:reviewDecision"] = lc.review_decision;
    if (lc.review_decision_notes) lDoc["gl:reviewDecisionNotes"] = lc.review_decision_notes;
    if (lc.domain) lDoc["gl:domain"] = lc.domain;
    if (lc.dates && lc.dates.length > 0) {
      lDoc["gl:dates"] = lc.dates.map((d) => ({
        "gl:dateType": d.type,
        "gl:date": d.date
      }));
    }
    if (lc.references && lc.references.length > 0) {
      lDoc["gl:references"] = refsToJsonLd(lc.references, refMaps2);
    } else if (refMaps2) {
      const inlineRefs = extractInlineRefs(lc, refMaps2, conceptYaml._sources);
      if (inlineRefs.length > 0) {
        lDoc["gl:references"] = refsToJsonLd(inlineRefs, refMaps2);
      }
    }
    localizations[lang] = lDoc;
  }
  if (Object.keys(localizations).length > 0) {
    doc["gl:localizedConcept"] = localizations;
  }
  if (conceptYaml._status) doc["gl:status"] = conceptYaml._status;
  if (conceptYaml._schemaVersion) doc["gl:schemaVersion"] = conceptYaml._schemaVersion;
  if (conceptYaml._dateAccepted) doc["gl:dateAccepted"] = conceptYaml._dateAccepted;
  if (conceptYaml._dates && conceptYaml._dates.length > 0) {
    doc["gl:dates"] = conceptYaml._dates.map((d) => ({
      "gl:dateType": d.type,
      "gl:date": d.date
    }));
  }
  if (conceptYaml._sources && conceptYaml._sources.length > 0) {
    doc["gl:source"] = sourcesToJsonLd(conceptYaml._sources);
  }
  if (conceptYaml._domains && conceptYaml._domains.length > 0) {
    doc["gl:domain"] = conceptYaml._domains.map((d) => {
      const domain = { "@type": "gl:ConceptReference" };
      if (d.concept_id) domain["gl:conceptId"] = d.concept_id;
      if (d.source) domain["gl:source"] = d.source;
      if (d.urn) domain["gl:urn"] = d.urn;
      if (d.ref_type) domain["gl:refType"] = d.ref_type;
      return domain;
    });
  }
  if (conceptYaml._related && conceptYaml._related.length > 0) {
    doc["gl:related"] = conceptYaml._related.map((r) => {
      const rel = { "@type": "gl:RelatedConcept" };
      if (r.type) rel["gl:relationshipType"] = r.type;
      if (r.content) rel["gl:content"] = r.content;
      if (r.ref) {
        const ref = {};
        if (r.ref.source) ref["gl:source"] = r.ref.source;
        if (r.ref.id) ref["gl:id"] = r.ref.id;
        if (r.ref.text) ref["gl:text"] = r.ref.text;
        rel["gl:ref"] = ref;
        if (r.ref.source && r.ref.id && refMaps2?.refPrefixMap?.[r.ref.source]) {
          const datasetId = refMaps2.refPrefixMap[r.ref.source];
          rel["gl:target"] = buildConceptUri(refMaps2.uriBase, datasetId, r.ref.id);
        }
      }
      if (r.target) {
        rel["gl:target"] = r.target;
      }
      return rel;
    });
  }
  if (conceptYaml._partitiveRelations?.length > 0) {
    doc["gl:partitiveRelations"] = conceptYaml._partitiveRelations.map((rel) => {
      const out = { "@type": "gl:PartitiveRelation" };
      if (rel.comprehensive) {
        out["gl:comprehensive"] = refToJsonLd(rel.comprehensive, "gl:ConceptRef");
      }
      if (Array.isArray(rel.partitives) && rel.partitives.length > 0) {
        out["gl:hasPartitive"] = rel.partitives.map((member) => {
          const m = { "@type": "gl:PartitiveMember" };
          if (member.ref) {
            m["gl:ref"] = refToJsonLd(member.ref, "gl:ConceptRef");
          } else {
            m["gl:ref"] = refToJsonLd(member, "gl:ConceptRef");
          }
          const presence = member.presence ?? splitMultiplicity(member.multiplicity ?? "").presence;
          const count = member.count ?? splitMultiplicity(member.multiplicity ?? "").count;
          m["gl:presence"] = presence;
          m["gl:count"] = count;
          if (member.is_delimiting === true || member.isDelimiting === true) {
            m["gl:isDelimiting"] = true;
          }
          if (member.multiplicity) m["gl:multiplicity"] = member.multiplicity;
          const legacyCertainty = member.certainty ?? LEGACY_CERTAINTY_FROM_AXIS[presence];
          if (legacyCertainty) m["gl:certainty"] = legacyCertainty;
          return m;
        });
      }
      if (rel.completeness) {
        out["gl:completeness"] = rel.completeness;
      }
      if (rel.plurality) {
        const pl = { "@type": "gl:TypeSharedPlurality" };
        pl["gl:isShared"] = rel.plurality.is_shared ?? rel.plurality.isShared ?? false;
        if (rel.plurality.is_uncertain ?? rel.plurality.isUncertain) {
          pl["gl:isUncertain"] = rel.plurality.is_uncertain ?? rel.plurality.isUncertain;
        }
        if (rel.plurality.shared_type ?? rel.plurality.sharedType) {
          pl["gl:sharedType"] = refToJsonLd(
            rel.plurality.shared_type ?? rel.plurality.sharedType,
            "gl:ConceptRef"
          );
        }
        out["gl:hasPlurality"] = pl;
      }
      if (rel.criterion) {
        out["gl:criterion"] = typeof rel.criterion === "string" ? { default: rel.criterion } : rel.criterion;
      }
      return out;
    });
  }
  if (conceptYaml._genericRelations?.length > 0) {
    doc["gl:genericRelations"] = conceptYaml._genericRelations.map((rel) => {
      const out = { "@type": "gl:GenericRelation" };
      if (rel.comprehensive) {
        out["gl:comprehensive"] = refToJsonLd(rel.comprehensive, "gl:ConceptRef");
      }
      if (Array.isArray(rel.members) && rel.members.length > 0) {
        out["gl:hasGeneric"] = rel.members.map((member) => {
          const m = { "@type": "gl:GenericMember" };
          if (member.ref) {
            m["gl:ref"] = refToJsonLd(member.ref, "gl:ConceptRef");
          } else {
            m["gl:ref"] = refToJsonLd(member, "gl:ConceptRef");
          }
          const presence = member.presence ?? splitMultiplicity(member.multiplicity ?? "").presence;
          const count = member.count ?? splitMultiplicity(member.multiplicity ?? "").count;
          m["gl:presence"] = presence;
          m["gl:count"] = count;
          if (member.delimiting_characteristic || member.delimitingCharacteristic) {
            const dc = member.delimiting_characteristic ?? member.delimitingCharacteristic;
            m["gl:delimitingCharacteristic"] = typeof dc === "string" ? { default: dc } : dc;
          }
          if (member.multiplicity) m["gl:multiplicity"] = member.multiplicity;
          const legacyCertainty = member.certainty ?? LEGACY_CERTAINTY_FROM_AXIS[presence];
          if (legacyCertainty) m["gl:certainty"] = legacyCertainty;
          return m;
        });
      }
      if (rel.completeness) {
        out["gl:completeness"] = rel.completeness;
      }
      if (rel.criterion) {
        out["gl:criterion"] = typeof rel.criterion === "string" ? { default: rel.criterion } : rel.criterion;
      }
      return out;
    });
  }
  return doc;
}
function getPrimaryDesignation(conceptYaml) {
  const descs = {};
  for (const lang of LANG_CODES) {
    const lc = conceptYaml[lang];
    if (lc && lc.terms && lc.terms.length > 0) {
      const preferredExpr = lc.terms.find((t) => t.normative_status === "preferred" && t.type === "expression");
      const preferred = preferredExpr || lc.terms.find((t) => t.normative_status === "preferred") || lc.terms[0];
      descs[lang] = preferred.designation;
    }
  }
  return descs;
}
async function inlineEmission(job, register, uriBase) {
  try {
    const outputs = await emitOutputSet([job.conceptInstance], {
      registerId: register,
      uriBase,
      formats: ["jsonld"]
    });
    return {
      termid: job.termid,
      ttl: conceptToTurtle(job.conceptInstance, { uriBase, registerId: register }),
      jsonld: outputs.jsonld,
      tbx: conceptsToTbx([job.conceptInstance], { registerId: register }) || null
    };
  } catch (e) {
    return { termid: job.termid, error: String(e && e.message || e) };
  }
}
function createEmissionPool(register, uriBase) {
  const configured = Number(process.env.GCB_WORKERS);
  if (Number.isFinite(configured) && configured <= 0) return null;
  const size = Number.isFinite(configured) ? configured : Math.max(1, Math.min(4, (os.availableParallelism ? os.availableParallelism() : os.cpus().length) - 1));
  const workerPath = path3.join(__dirname3, "lib", "workers", "emit-concept-worker.mjs");
  let pool;
  try {
    pool = Array.from({ length: size }, () => new WorkerThread(workerPath, { workerData: { registerId: register, uriBase } }));
  } catch {
    return null;
  }
  const active = /* @__PURE__ */ new Map();
  const pending = [];
  const idle = /* @__PURE__ */ new Set();
  function dispatch() {
    while (pending.length > 0) {
      const worker = idle.values().next();
      if (worker.done) return;
      idle.delete(worker.value);
      const entry = pending.shift();
      active.set(worker.value, entry);
      worker.value.postMessage({ termid: entry.job.termid, sourceText: entry.job.sourceText });
    }
  }
  for (const worker of pool) {
    idle.add(worker);
    worker.on("message", (msg) => {
      const entry = active.get(worker);
      active.delete(worker);
      idle.add(worker);
      entry?.resolve(msg);
      dispatch();
    });
    const fail = (err) => {
      const entry = active.get(worker);
      active.delete(worker);
      idle.delete(worker);
      pool = pool.filter((w) => w !== worker);
      entry?.reject(err);
      dispatch();
    };
    worker.on("error", fail);
    worker.on("exit", () => fail(new Error("emission worker exited")));
  }
  return {
    emit(job) {
      return new Promise((resolve2, reject) => {
        pending.push({ job, resolve: resolve2, reject });
        dispatch();
      });
    },
    async close() {
      await Promise.allSettled(pool.map((w) => w.terminate()));
    }
  };
}
async function processDataset(dir, register, opts) {
  const files = fs2.readdirSync(dir).filter((f) => f.endsWith(".yaml")).sort((a, b) => naturalSort(a.replace(".yaml", ""), b.replace(".yaml", "")));
  console.log(`Processing ${register}: ${files.length} files`);
  const conceptsDir = path3.join(DATA, register, "concepts");
  fs2.mkdirSync(conceptsDir, { recursive: true });
  const EMISSION_CACHE_VERSION = 1;
  const EMISSION_EXTENSIONS = ["json", "ttl", "jsonld", "tbx", "yaml"];
  const cacheDir = path3.join(ROOT, ".gcb-cache");
  const cachePath = path3.join(cacheDir, `${register}.json`);
  const emissionCache = {
    version: EMISSION_CACHE_VERSION,
    files: {}
  };
  try {
    const loaded = JSON.parse(fs2.readFileSync(cachePath, "utf8"));
    if (loaded?.version === EMISSION_CACHE_VERSION && loaded.files) emissionCache.files = loaded.files;
  } catch {
  }
  const concepts = [];
  const conceptInstances = [];
  const langTermCounts = {};
  const langDefCounts = {};
  const availableFormats = ["ttl", "jsonld", "yaml", "tbx", "csv"];
  const producedOutputs = /* @__PURE__ */ new Set();
  const emissionCacheFiles = {};
  const designationLookup = /* @__PURE__ */ new Map();
  for (const file of files) {
    try {
      const conceptYaml = loadConceptFile(path3.join(dir, file));
      if (!conceptYaml?.termid) continue;
      const termid = String(conceptYaml.termid);
      for (const lang of Object.keys(conceptYaml)) {
        const lc = conceptYaml[lang];
        if (!lc || typeof lc !== "object" || !Array.isArray(lc.terms)) continue;
        for (const term of lc.terms) {
          const designation = term.designation;
          if (typeof designation === "string" && designation && !designationLookup.has(designation.toLowerCase())) {
            designationLookup.set(designation.toLowerCase(), termid);
          }
        }
      }
    } catch {
    }
  }
  const dsRefMaps = { ...refMaps, register, designationLookup };
  const stats = {
    sourceMap: /* @__PURE__ */ new Map(),
    relTypeCounts: {},
    partitiveRelations: {
      count: 0,
      byCompleteness: { complete: 0, partial: 0 },
      byPresence: { required: 0, optional: 0 },
      byCount: { exactly_one: 0, at_least_one: 0, multiple: 0 },
      delimitingMembers: 0,
      withCriterion: 0,
      withoutCriterion: 0,
      withPlurality: 0
    }
  };
  const standards = /* @__PURE__ */ new Map();
  const STATS_PROCESSORS = [
    function collectStandards(cy, termid) {
      const concept = {
        sources: cy._sources || [],
        languages: Object.keys(cy).filter((lang) => !lang.startsWith("_") && cy[lang] && typeof cy[lang] === "object" && !Array.isArray(cy[lang])),
        localization: (lang) => cy[lang]
      };
      const sources = [
        ...concept.sources,
        ...concept.languages.flatMap((lang) => concept.localization(lang).sources || [])
      ];
      for (const key of collectStandardKeys(concept)) {
        if (!standards.has(key)) {
          const source = sources.find((source2) => source2.type === "authoritative" && standardKey(source2.origin?.ref) === key);
          standards.set(key, { label: standardLabel(source.origin.ref), conceptIds: [] });
        }
        standards.get(key).conceptIds.push(termid);
      }
    },
    function collectSources(cy, termid, s) {
      const refs = /* @__PURE__ */ new Set();
      const allSources = [
        ...cy._sources || [],
        ...opts.languages.flatMap((l) => cy[l]?.sources || [])
      ];
      for (const src of allSources) {
        const ref = src.origin?.ref?.source || src.origin?.ref?.id || "Unknown";
        refs.add(ref);
        if (!s.sourceMap.has(ref)) s.sourceMap.set(ref, { ref, types: /* @__PURE__ */ new Set(), conceptIds: [] });
        if (src.type) s.sourceMap.get(ref).types.add(src.type);
      }
      for (const ref of refs) s.sourceMap.get(ref)?.conceptIds.push(termid);
    },
    function countRelationships(cy, _termid, s) {
      for (const r of cy._related || []) {
        const type = r.type || "unknown";
        s.relTypeCounts[type] = (s.relTypeCounts[type] || 0) + 1;
      }
    },
    function countPartitiveRelations(cy, _termid, s) {
      for (const rel of cy._partitiveRelations || []) {
        s.partitiveRelations.count += 1;
        const completeness = rel.completeness || "complete";
        s.partitiveRelations.byCompleteness[completeness] = (s.partitiveRelations.byCompleteness[completeness] || 0) + 1;
        const partitives = rel.partitives || [];
        for (const member of partitives) {
          const axes = splitMultiplicity(member.multiplicity ?? "");
          const presence = member.presence ?? axes.presence;
          const count = member.count ?? axes.count;
          s.partitiveRelations.byPresence[presence] = (s.partitiveRelations.byPresence[presence] || 0) + 1;
          s.partitiveRelations.byCount[count] = (s.partitiveRelations.byCount[count] || 0) + 1;
          if (member.is_delimiting === true || member.isDelimiting === true) {
            s.partitiveRelations.delimitingMembers += 1;
          }
        }
        if (rel.criterion) {
          s.partitiveRelations.withCriterion += 1;
        } else {
          s.partitiveRelations.withoutCriterion += 1;
        }
        if (rel.plurality) {
          s.partitiveRelations.withPlurality += 1;
        }
      }
    },
    function countLanguages(cy, _termid, _s) {
      for (const lang of opts.languages) {
        const lc = cy[lang];
        if (lc) {
          if (lc.terms?.length > 0) langTermCounts[lang] = (langTermCounts[lang] || 0) + 1;
          if (lc.definition && (Array.isArray(lc.definition) ? lc.definition.some((d) => d.content) : lc.definition)) {
            langDefCounts[lang] = (langDefCounts[lang] || 0) + 1;
          }
        }
      }
    }
  ];
  const loopStart = Date.now();
  const emissionJobs = [];
  const curationEntries = [];
  const unparseableFiles = [];
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (i > 0 && i % 250 === 0) console.log(`  ${i}/${files.length} concepts`);
    try {
      const filePath = path3.join(dir, file);
      const sourceText = fs2.readFileSync(filePath, "utf8");
      const sourceHash = createHash2("sha256").update(sourceText).digest("hex");
      const conceptYaml = loadConceptFile(filePath);
      if (!conceptYaml || !conceptYaml.termid) {
        unparseableFiles.push(file);
        continue;
      }
      const termid = String(conceptYaml.termid);
      const cached = emissionCache.files[file];
      const unchanged = cached?.hash === sourceHash && EMISSION_EXTENSIONS.every((ext) => fs2.existsSync(path3.join(conceptsDir, `${termid}.${ext}`)));
      let conceptInstance = null;
      let canonicalParseError;
      try {
        conceptInstance = parseConceptYaml(sourceText, termid);
      } catch (e) {
        canonicalParseError = e.message;
        console.warn(`  ${termid}: canonical parse failed (${e.message}); skipping glossarist exports`);
      }
      if (conceptInstance) conceptInstances.push(conceptInstance);
      if (!unchanged) {
        const jsonld = yamlToJsonLd(conceptYaml, register, dsRefMaps);
        writeJson(path3.join(conceptsDir, `${termid}.json`), jsonld);
        fs2.copyFileSync(filePath, path3.join(conceptsDir, `${termid}.yaml`));
        if (conceptInstance) {
          emissionJobs.push({ file, termid, sourceText, sourceHash, conceptInstance });
        }
      } else {
        emissionCacheFiles[file] = { hash: sourceHash, termid };
      }
      producedOutputs.add(`${termid}.json`);
      producedOutputs.add(`${termid}.yaml`);
      if (conceptInstance) {
        producedOutputs.add(`${termid}.ttl`);
        producedOutputs.add(`${termid}.jsonld`);
        producedOutputs.add(`${termid}.tbx`);
      }
      const primaryDesignations = getPrimaryDesignation(conceptYaml);
      concepts.push({
        id: termid,
        designations: primaryDesignations,
        groups: getGroups(conceptYaml),
        status: conceptYaml.eng?.entry_status || "valid"
      });
      const curationDesignations = primaryDesignations;
      curationEntries.push({
        id: termid,
        designation: stripHtml(
          String(curationDesignations.eng || Object.values(curationDesignations).find(Boolean) || "")
        ),
        flags: collectCurationFlags(conceptYaml, opts.languages),
        ...canonicalParseError ? { parseError: canonicalParseError } : {}
      });
      for (const processor of STATS_PROCESSORS) {
        processor(conceptYaml, termid, stats);
      }
    } catch (e) {
      console.warn(`  Skipping ${file}: ${e.message}`);
      unparseableFiles.push(file);
    }
  }
  if (emissionJobs.length > 0) {
    const jobsByTermid = new Map(emissionJobs.map((j) => [j.termid, j]));
    const pool = createEmissionPool(register, refMaps.uriBase);
    const emissionStart = Date.now();
    try {
      const results = await Promise.all(emissionJobs.map((job) => {
        if (!pool) return inlineEmission(job, register, refMaps.uriBase);
        return pool.emit(job).catch(() => inlineEmission(job, register, refMaps.uriBase));
      }));
      for (const result of results) {
        if (result.error) {
          console.warn(`  ${result.termid}: canonical parse failed (${result.error}); skipping glossarist exports`);
          const job2 = jobsByTermid.get(result.termid);
          if (job2) delete emissionCacheFiles[job2.file];
          for (const ext of ["ttl", "jsonld", "tbx"]) producedOutputs.delete(`${result.termid}.${ext}`);
          continue;
        }
        fs2.writeFileSync(path3.join(conceptsDir, `${result.termid}.ttl`), result.ttl);
        fs2.writeFileSync(path3.join(conceptsDir, `${result.termid}.jsonld`), result.jsonld);
        if (result.tbx) fs2.writeFileSync(path3.join(conceptsDir, `${result.termid}.tbx`), result.tbx);
        const job = jobsByTermid.get(result.termid);
        if (job) emissionCacheFiles[job.file] = { hash: job.sourceHash, termid: job.termid };
      }
      console.log(`  Interchange exports: ${((Date.now() - emissionStart) / 1e3).toFixed(1)}s (${emissionJobs.length} concepts, ${pool ? "parallel" : "inline"})`);
    } finally {
      if (pool) await pool.close();
    }
  }
  for (const entry of fs2.readdirSync(conceptsDir)) {
    if (!producedOutputs.has(entry)) fs2.unlinkSync(path3.join(conceptsDir, entry));
  }
  fs2.mkdirSync(cacheDir, { recursive: true });
  fs2.writeFileSync(cachePath, JSON.stringify({ version: EMISSION_CACHE_VERSION, files: emissionCacheFiles }));
  console.log(`  Per-concept emissions: ${((Date.now() - loopStart) / 1e3).toFixed(1)}s`);
  const aggregateStart = Date.now();
  const aggregate = await emitOutputSet(conceptInstances, {
    registerId: register,
    uriBase: refMaps.uriBase,
    formats: ["csv", "jsonld"],
    languageOrder: opts.languageOrder || opts.languages,
    conceptUriPrefix: buildConceptUriPrefix(refMaps.siteOrigin, register)
  });
  console.log(`  Aggregate csv+jsonld: ${((Date.now() - aggregateStart) / 1e3).toFixed(1)}s`);
  fs2.writeFileSync(path3.join(DATA, register, `${register}.csv`), aggregate.csv);
  fs2.writeFileSync(path3.join(DATA, register, `${register}.jsonld`), aggregate.jsonld);
  const CHUNK_SIZE = 500;
  const chunks = [];
  for (let i = 0; i < concepts.length; i += CHUNK_SIZE) {
    const chunk = concepts.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE);
    const chunkFile = `index-${String(chunkIndex).padStart(4, "0")}.json`;
    const chunkData = {
      registerId: register,
      chunkIndex,
      concepts: chunk
    };
    const chunkContent = JSON.stringify(chunkData);
    const chunkPath = path3.join(DATA, register, "chunks", chunkFile);
    fs2.mkdirSync(path3.dirname(chunkPath), { recursive: true });
    fs2.writeFileSync(chunkPath, chunkContent);
    const hash = createHash2("sha256").update(chunkContent).digest("hex").slice(0, 12);
    chunks.push({ file: chunkFile, count: chunk.length, hash });
  }
  const summary = concepts.map((c) => ({
    id: c.id,
    designations: c.designations,
    eng: c.designations.eng || Object.values(c.designations)[0] || "",
    status: c.status,
    groups: c.groups || []
  }));
  const plainSummary = summary.map((c) => {
    const designations = {};
    for (const [lang, term] of Object.entries(c.designations)) {
      if (term) designations[lang] = stripHtml(String(term));
    }
    return {
      ...c,
      designations,
      eng: stripHtml(String(c.eng))
    };
  });
  const graphNodeEntries = concepts.map((c) => {
    const cleanDesignations = {};
    for (const [l, t] of Object.entries(c.designations)) {
      if (t) cleanDesignations[l] = stripHtml(String(t));
    }
    return [c.id, cleanDesignations, c.status];
  });
  fs2.mkdirSync(path3.join(DATA, register), { recursive: true });
  fs2.writeFileSync(
    path3.join(DATA, register, "graph-nodes.json"),
    JSON.stringify({
      uriPrefix: buildConceptUriPrefix(refMaps.uriBase, register),
      registerId: register,
      nodes: graphNodeEntries
    })
  );
  writeJson(path3.join(DATA, register, "index.json"), {
    registerId: register,
    schemaVersion: "1.0.0",
    conceptCount: concepts.length,
    chunkSize: CHUNK_SIZE,
    chunks,
    concepts: plainSummary
  });
  writeJson(path3.join(DATA, register, "index-meta.json"), {
    registerId: register,
    schemaVersion: "1.0.0",
    conceptCount: concepts.length,
    chunkSize: CHUNK_SIZE,
    chunks
  });
  const langStats = {};
  for (const lang of opts.languages) {
    langStats[lang] = {
      terms: langTermCounts[lang] || 0,
      definitions: langDefCounts[lang] || 0
    };
  }
  const BULK_FORMAT_BY_EXT = {
    ".ttl": "turtle",
    ".jsonld": "jsonld",
    ".xml": "tbx",
    ".jsonl": "jsonl",
    ".yaml": "yaml",
    ".csv": "csv"
  };
  const bulkFormats = [];
  const addBulkFormat = (file) => {
    const dest = path3.join(DATA, register, file);
    if (!fs2.existsSync(dest) || bulkFormats.some((f) => f.file === file)) return;
    const formatName = BULK_FORMAT_BY_EXT[path3.extname(file)] || path3.extname(file).slice(1);
    bulkFormats.push({ file, format: formatName, size: fs2.statSync(dest).size });
  };
  for (const file of [`${register}.csv`, `${register}.jsonld`]) addBulkFormat(file);
  const sourceRoot = path3.dirname(dir);
  const compiledDir = path3.join(sourceRoot, "compiled");
  if (fs2.existsSync(compiledDir)) {
    let copied = 0;
    for (const file of fs2.readdirSync(compiledDir)) {
      fs2.copyFileSync(path3.join(compiledDir, file), path3.join(DATA, register, file));
      addBulkFormat(file);
      copied += 1;
    }
    if (copied) console.log(`  Copied ${copied} bulk format files from compiled/`);
  }
  const sourceStats = Array.from(stats.sourceMap.values()).map((s) => ({
    ref: s.ref,
    types: Array.from(s.types),
    conceptCount: s.conceptIds.length,
    conceptIds: s.conceptIds
  })).sort((a, b) => b.conceptCount - a.conceptCount);
  const totalRelationships = Object.values(stats.relTypeCounts).reduce((a, b) => a + b, 0);
  writeJson(path3.join(DATA, register, "standards.json"), Object.fromEntries(standards));
  writeJson(path3.join(DATA, register, "stats.json"), {
    sourceCount: sourceStats.length,
    sources: sourceStats,
    relationshipCount: totalRelationships,
    relationshipTypes: stats.relTypeCounts,
    partitiveRelations: stats.partitiveRelations
  });
  const curationReport = buildCurationReport(
    register,
    concepts.length,
    opts.languages,
    curationEntries,
    unparseableFiles
  );
  writeJson(path3.join(DATA, register, "curation.json"), curationReport);
  console.log(
    `  Curation queues: ${curationReport.validation.count} invalid, ${curationReport.missingTranslations.count} missing translations, ${curationReport.noSources.count} without sources`
  );
  const manifest = {
    id: register,
    datasetUri: opts.datasetUri,
    uriAliases: opts.uriAliases,
    title: opts.title,
    description: opts.description,
    owner: opts.owner,
    baseUrl: `/data/${register}`,
    languages: opts.languages,
    conceptCount: concepts.length,
    sourceCount: sourceStats.length,
    relationshipCount: totalRelationships,
    conceptUrlTemplate: "{baseUrl}/concepts/{conceptId}.json",
    indexUrl: "{baseUrl}/index.json",
    contextUrl: "https://glossarist.org/ns/context.jsonld",
    uriBase: refMaps.uriBase,
    status: "valid",
    schemaVersion: "1.0.0",
    tags: opts.tags,
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
    sourceRepo: opts.sourceRepo,
    chunkSize: CHUNK_SIZE,
    color: opts.color,
    year: opts.year ?? void 0,
    languageStats: langStats,
    availableFormats,
    hasBibliography: opts.hasBibliography,
    hasImages: opts.hasImages
  };
  if (opts.languageOrder) manifest.languageOrder = opts.languageOrder;
  if (opts.ref) manifest.ref = opts.ref;
  if (opts.refAliases) manifest.refAliases = opts.refAliases;
  if (opts.status) manifest.editionStatus = opts.status;
  if (opts.ordering) manifest.ordering = opts.ordering;
  if (opts.sections && opts.sections.length > 0) manifest.sections = opts.sections;
  const rdfStart = Date.now();
  await writeDatasetRdf(register, manifest, concepts, refMaps, opts);
  console.log(`  Dataset RDF: ${((Date.now() - rdfStart) / 1e3).toFixed(1)}s`);
  addBulkFormat(`${register}.ttl`);
  manifest.bulkFormats = opts.bulkExports?.length ? bulkFormats.filter((f) => opts.bulkExports.includes(f.format)) : bulkFormats;
  writeJson(path3.join(DATA, register, "manifest.json"), manifest);
  const bibPath = path3.join(sourceRoot, "bibliography.yaml");
  if (fs2.existsSync(bibPath)) {
    const rawBib = readYaml(bibPath);
    const bibData = normalizeBibliography(rawBib);
    writeJson(path3.join(DATA, register, "bibliography.json"), bibData);
    const bibCount = bibData.bibliography.length;
    console.log(`  Copied bibliography (${bibCount} entries)`);
  } else {
    writeJson(path3.join(DATA, register, "bibliography.json"), { bibliography: [] });
    console.log(`  Emitted empty bibliography.json (no source bibliography.yaml)`);
  }
  const imagesSrcDir = path3.join(sourceRoot, "images");
  if (fs2.existsSync(imagesSrcDir) && fs2.statSync(imagesSrcDir).isDirectory()) {
    const imagesDestDir = path3.join(DATA, register, "images");
    const result = await copyImageAssets(imagesSrcDir, imagesDestDir);
    console.log(`  Copied ${result.count} images (skipped ${result.skipped.length})`);
    for (const w of result.skipped) {
      console.warn(`    Warning: skipped image ${w}`);
    }
  }
  const nvResult = await consumeDatasetEntities(sourceRoot, path3.join(DATA, register));
  const nvTotal = nvResult.figures + nvResult.tables + nvResult.formulas;
  if (nvTotal > 0) {
    console.log(`  Consumed ${nvResult.figures} figures, ${nvResult.tables} tables, ${nvResult.formulas} formulas`);
    for (const w of nvResult.warnings) {
      console.warn(`    Warning: ${w}`);
    }
  }
  console.log(`  Generated ${concepts.length} concepts, manifest, ${chunks.length} index chunks`);
  return concepts.length;
}
var PKG_VERSION = (() => {
  try {
    return JSON.parse(fs2.readFileSync(path3.join(__dirname3, "..", "package.json"), "utf8")).version ?? "unknown";
  } catch {
    return "unknown";
  }
})();
console.log(`Generating Glossarist vocabulary browser data (concept-browser v${PKG_VERSION})...
`);
var { config } = loadSiteConfig();
var counts = {};
var registry = [];
var registerCache = {};
for (const ds of config.datasets) {
  const dsDir = datasetDir(ds);
  const registerYamlPath = path3.join(dsDir, "register.yaml");
  if (fs2.existsSync(registerYamlPath)) {
    try {
      const raw = yaml4.load(fs2.readFileSync(registerYamlPath, "utf8"));
      registerCache[ds.id] = Register.fromJSON(raw);
    } catch (e) {
      console.warn(`  Warning: failed to parse register.yaml for ${ds.id}: ${e.message}`);
    }
  }
}
var refMaps = buildRefMaps(config, registerCache);
var bulkExports = (config.bulkExports || []).map((f) => f === "ttl" ? "turtle" : f);
for (let i = 0; i < config.datasets.length; i++) {
  const ds = config.datasets[i];
  const dir = path3.join(datasetDir(ds), "concepts");
  if (!fs2.existsSync(dir)) {
    console.warn(`Skipping ${ds.id}: source directory not found (${dir})`);
    console.warn(`  Run: npm run fetch-datasets`);
    continue;
  }
  const reg = registerCache[ds.id] || null;
  const dsLanguages = firstNonEmpty(reg?.languages, ds.languages, ["eng"]);
  const defaultLang = dsLanguages[0] || "eng";
  const regDesc = reg?.description;
  const dsDesc = ds.description;
  const resolvedDescription = typeof regDesc === "object" && Object.keys(regDesc).length > 0 ? regDesc[defaultLang] || Object.values(regDesc)[0] || "" : dsDesc || "";
  const resolvedTitle = reg?.displayName(defaultLang) ?? ds.title ?? reg?.ref ?? ds.id;
  counts[ds.id] = await processDataset(dir, ds.id, {
    title: resolvedTitle,
    description: resolvedDescription,
    owner: firstNonEmpty(reg?.owner, ds.owner),
    languages: dsLanguages,
    sourceRepo: firstNonEmpty(reg?.sourceRepo, ds.sourceRepo),
    languageOrder: firstNonEmpty(reg?.languageOrder, ds.languageOrder),
    ref: firstNonEmpty(reg?.ref, ds.ref),
    refAliases: firstNonEmpty(reg?.refAliases, ds.refAliases),
    year: reg?.year ?? null,
    tags: firstNonEmpty(reg?.tags, ds.tags),
    color: ds.color || DS_PALETTE[i % DS_PALETTE.length],
    datasetUri: firstNonEmpty(reg?.urn, ds.uri),
    uriAliases: firstNonEmpty(reg?.urnAliases, ds.uriAliases),
    status: firstNonEmpty(reg?.status, ds.editionStatus),
    ordering: reg?.ordering || null,
    sections: reg?.sections ? reg.sections.map((s) => s.toJSON()) : [],
    hasBibliography: fs2.existsSync(path3.join(datasetDir(ds), "bibliography.yaml")),
    hasImages: fs2.existsSync(path3.join(datasetDir(ds), "images")),
    bulkExports
  });
  const resolvedOwner = firstNonEmpty(reg?.owner, ds.owner) ?? "";
  const resolvedTags = firstNonEmpty(reg?.tags, ds.tags) ?? [];
  const resolvedDatasetUri = firstNonEmpty(reg?.urn, ds.uri);
  const resolvedUriAliases = firstNonEmpty(reg?.urnAliases, ds.uriAliases);
  const resolvedRef = firstNonEmpty(reg?.ref, ds.ref);
  const resolvedRefAliases = firstNonEmpty(reg?.refAliases, ds.refAliases);
  registry.push({
    id: ds.id,
    manifestUrl: `/data/${ds.id}/manifest.json`,
    summary: {
      title: resolvedTitle,
      description: resolvedDescription,
      conceptCount: counts[ds.id] || 0,
      languages: dsLanguages,
      owner: resolvedOwner,
      tags: resolvedTags,
      color: ds.color || DS_PALETTE[i % DS_PALETTE.length],
      year: reg?.year ?? void 0
    },
    datasetUri: resolvedDatasetUri,
    uriBase: config.uriBase || void 0,
    uriAliases: resolvedUriAliases,
    ref: resolvedRef,
    refAliases: resolvedRefAliases
  });
}
writeJson(path3.join(PUBLIC, "datasets.json"), registry);
var configuredIds = new Set(config.datasets.map((d) => d.id));
if (fs2.existsSync(DATA)) {
  for (const entry of fs2.readdirSync(DATA)) {
    const stalePath = path3.join(DATA, entry);
    if (!configuredIds.has(entry) && fs2.statSync(stalePath).isDirectory()) {
      fs2.rmSync(stalePath, { recursive: true, force: true });
      console.log(`  Removed stale data directory: ${entry}`);
    }
  }
}
writeJson(path3.join(PUBLIC, "routing.json"), config.routing || []);
console.log("Generated routing.json");
async function processLogo(logoConfig, filename) {
  if (!logoConfig) return;
  const destDir = path3.join(PUBLIC, "logos");
  fs2.mkdirSync(destDir, { recursive: true });
  const destPath = path3.join(destDir, filename);
  if (logoConfig.localPath) {
    const src = path3.resolve(process.cwd(), logoConfig.localPath);
    if (fs2.existsSync(src)) {
      fs2.copyFileSync(src, destPath);
      console.log(`  Copied logo: ${src} \u2192 ${destPath}`);
      return;
    }
    console.warn(`  Logo not found at: ${src}`);
  }
  if (logoConfig.remoteUrl) {
    try {
      console.log(`  Downloading logo: ${logoConfig.remoteUrl}`);
      const resp = await fetch(logoConfig.remoteUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      fs2.writeFileSync(destPath, buf);
      console.log(`  Saved logo: ${destPath}`);
    } catch (e) {
      console.warn(`  Logo download failed: ${e.message}`);
    }
  }
}
await processLogo(config.branding?.logo, `${config.id}-logo.svg`);
await processLogo(config.branding?.footerLogo, `${config.id}-footer-logo.svg`);
if (config.branding?.logo?.localLight) {
  await processLogo({ localPath: config.branding.logo.localLight }, `${config.id}-logo-light.svg`);
}
if (config.branding?.logo?.localDark) {
  await processLogo({ localPath: config.branding.logo.localDark }, `${config.id}-logo-dark.svg`);
}
function processNewsPage(config2, page) {
  const newsDir = page.source ? path3.resolve(process.cwd(), page.source) : config2.newsDir ? path3.resolve(process.cwd(), config2.newsDir) : null;
  if (!newsDir || !fs2.existsSync(newsDir)) {
    if (newsDir) console.warn(`News directory not found: ${newsDir}`);
    return;
  }
  const index = [];
  const newsOutDir = path3.join(PUBLIC, "news");
  fs2.mkdirSync(newsOutDir, { recursive: true });
  const postFiles = fs2.readdirSync(newsDir).filter((f) => f.endsWith(".adoc") || f.endsWith(".md")).sort().reverse();
  for (const file of postFiles) {
    const content = fs2.readFileSync(path3.join(newsDir, file), "utf8");
    const frontmatter = {};
    const bodyLines = [];
    let inFm = false;
    const lines = content.split("\n");
    if (lines[0] === "---") {
      inFm = true;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === "---") {
          inFm = false;
          continue;
        }
        if (inFm) {
          const m = lines[i].match(/^(\w[\w\s]*):\s*(.*)/);
          if (m) frontmatter[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
        } else {
          bodyLines.push(lines[i]);
        }
      }
    } else {
      bodyLines.push(...lines);
    }
    const slug = file.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.(adoc|md)$/, "");
    const body = bodyLines.join("\n").trim();
    const ext = path3.extname(file);
    const destFile = path3.join(newsOutDir, `${slug}${ext}`);
    fs2.copyFileSync(path3.join(newsDir, file), destFile);
    index.push({
      slug,
      title: frontmatter.title || slug,
      date: frontmatter.date || "",
      categories: frontmatter.categories ? frontmatter.categories.split(",").map((s) => s.trim()) : [],
      file: `/news/${slug}${ext}`,
      excerpt: body.split("\n").find((l) => l.trim())?.slice(0, 200) || ""
    });
  }
  writeJson(path3.join(PUBLIC, "news.json"), index);
  console.log(`Generated news index: ${index.length} posts, ${postFiles.length} files copied to public/news/`);
}
function convertAsciiDocTables(text) {
  return text.replace(/\n?\|===\n([\s\S]*?)\n\|===/g, (_, body) => {
    const rows = body.split("\n").filter((line) => line.trim() !== "");
    if (!rows.length) return "";
    const parsedRows = rows.map((row) => {
      const cellText = row.replace(/^\s*\|/, "").trim();
      return cellText.split(/\s*\|\s*/).map((c) => c.trim()).filter((c) => c !== "");
    }).filter((r) => r.length > 0);
    if (!parsedRows.length) return "";
    const maxCols = Math.max(...parsedRows.map((r) => r.length));
    const normalized = parsedRows.map((r) => {
      while (r.length < maxCols) r.push("");
      return r;
    });
    const thead = "<thead><tr>" + normalized[0].map((c) => `<th>${c}</th>`).join("") + "</tr></thead>";
    const tbody = "<tbody>" + normalized.slice(1).map(
      (r) => "<tr>" + r.map((c) => `<td>${c}</td>`).join("") + "</tr>"
    ).join("") + "</tbody>";
    return `<table class="asciidoc-table">${thead}${tbody}</table>`;
  });
}
function renderMarkdown(input) {
  let text = convertAsciiDocTables(input);
  const HTML_PASS_THROUGH = /<span\s+class="math-pending"[^>]*>[^<]*<\/span>/g;
  const htmlPlaceholders = [];
  text = text.replace(HTML_PASS_THROUGH, (match) => {
    const idx = htmlPlaceholders.length;
    htmlPlaceholders.push(match);
    return `\0HTML${idx}\0`;
  });
  const INLINE_PATTERNS = [
    [/\*\*(.+?)\*\*/g, (m) => `<strong>${m[1]}</strong>`],
    [/(?<!\*)\*([^*]+?)\*(?!\*)/g, (m) => `<em>${m[1]}</em>`],
    [/`([^`]+?)`/g, (m) => `<code>${m[1]}</code>`],
    [/\[([^\]]+)\]\(([^)]+)\)/g, (m) => `<a href="${m[2]}" target="_blank">${m[1]}</a>`]
  ];
  function renderInline(text2) {
    for (const [re, fn] of INLINE_PATTERNS) {
      text2 = text2.replace(re, (...args) => fn(args));
    }
    return text2;
  }
  function escapeHtml(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  const blocks = [];
  const lines = input.split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith("```")) {
      const lang = line.trim().slice(3);
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ""}>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
      continue;
    }
    const hm = line.match(/^(#{1,4})\s+(.+)/);
    if (hm) {
      blocks.push(`<h${hm[1].length + 1}>${renderInline(hm[2])}</h${hm[1].length + 1}>`);
      i++;
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      blocks.push("<hr>");
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*]\s+/, ""))}</li>`);
        i++;
      }
      blocks.push(`<ul>${items.join("")}</ul>`);
      continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+\.\s+/, ""))}</li>`);
        i++;
      }
      blocks.push(`<ol>${items.join("")}</ol>`);
      continue;
    }
    if (/^>\s?/.test(line)) {
      const ql = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        ql.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(`<blockquote>${renderInline(ql.join(" "))}</blockquote>`);
      continue;
    }
    if (/^\|(.+)\|$/.test(line) && i + 1 < lines.length && /^\|[-:| ]+\|$/.test(lines[i + 1])) {
      const headerCells = line.split("|").map((c) => c.trim()).filter(Boolean);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|(.+)\|$/.test(lines[i])) {
        rows.push(lines[i].split("|").map((c) => c.trim()).filter(Boolean));
        i++;
      }
      const thCells = headerCells.map((c) => `<th>${renderInline(c)}</th>`).join("");
      const trRows = rows.map((r) => `<tr>${r.map((c) => `<td>${renderInline(c)}</td>`).join("")}</tr>`).join("");
      blocks.push(`<table><thead><tr>${thCells}</tr></thead><tbody>${trRows}</tbody></table>`);
      continue;
    }
    if (!line.trim()) {
      i++;
      continue;
    }
    const pl = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,4}\s/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^>\s?/.test(lines[i]) && !lines[i].trimStart().startsWith("```")) {
      pl.push(lines[i]);
      i++;
    }
    if (pl.length) blocks.push(`<p>${renderInline(pl.join(" "))}</p>`);
  }
  const result = blocks.join("\n").replace(/ HTML(\d+) /g, (_, idx) => htmlPlaceholders[parseInt(idx)]);
  return result;
}
function processContentPage(config2, page) {
  if (!page.source) {
    console.warn(`  Skipping content page '${page.route}': no source file`);
    return;
  }
  const srcPath = path3.resolve(ROOT, page.source);
  if (!fs2.existsSync(srcPath)) {
    console.warn(`  Skipping content page '${page.route}': source not found (${srcPath})`);
    return;
  }
  const raw = fs2.readFileSync(srcPath, "utf8");
  const ext = path3.extname(srcPath).toLowerCase();
  let html;
  if (ext === ".html" || ext === ".htm") {
    html = raw;
  } else {
    const stripped = stripFrontmatter(raw);
    html = renderMarkdown(stripped);
  }
  const pagesDir = path3.join(PUBLIC, "pages");
  fs2.mkdirSync(pagesDir, { recursive: true });
  writeJson(path3.join(pagesDir, `${page.route}.json`), { title: page.title, html });
  console.log(`  Generated content page: ${page.route} (${ext})`);
  if (page.translations) {
    for (const [lang, tr] of Object.entries(page.translations)) {
      const { source, title: trTitle } = tr;
      if (!source) continue;
      const trSrcPath = path3.resolve(ROOT, source);
      if (!fs2.existsSync(trSrcPath)) {
        console.warn(`  Skipping '${page.route}' translation '${lang}': source not found (${trSrcPath})`);
        continue;
      }
      const trRaw = fs2.readFileSync(trSrcPath, "utf8");
      const trExt = path3.extname(trSrcPath).toLowerCase();
      let trHtml;
      if (trExt === ".html" || trExt === ".htm") {
        trHtml = trRaw;
      } else {
        trHtml = renderMarkdown(stripFrontmatter(trRaw));
      }
      writeJson(path3.join(pagesDir, `${page.route}.${lang}.json`), { title: trTitle || page.title, html: trHtml });
      console.log(`  Generated localized page: ${page.route}.${lang} (${trExt})`);
    }
  }
}
function stripFrontmatter(text) {
  const lines = text.split("\n");
  if (lines[0] !== "---") return text;
  let end = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      end = i;
      break;
    }
  }
  if (end < 0) return text;
  return lines.slice(end + 1).join("\n").trim();
}
var pageProcessors = {
  news: processNewsPage,
  page: processContentPage,
  about: processContentPage
};
function synthesizePages(config2) {
  const pages = [];
  if (config2.newsDir) pages.push({ type: "news", route: "news", title: "News", icon: "newspaper" });
  return pages;
}
function processPages(config2) {
  const pages = config2.pages || synthesizePages(config2);
  for (const page of pages) {
    const processor = pageProcessors[page.type];
    if (processor) processor(config2, page);
  }
  return pages;
}
var processedPages = processPages(config);
var _pagesDir = path3.join(PUBLIC, "pages");
for (const ds of config.datasets || []) {
  if (!ds.localPath) continue;
  const dsDir = path3.resolve(ROOT, ds.localPath);
  const defaultLang = (ds.languages || ["eng"])[0];
  const route = `${ds.id}-about`;
  const dsTranslations = ds.translations || {};
  const defaultSrc = [
    path3.join(dsDir, `about-${defaultLang}.md`),
    path3.join(dsDir, "about.md")
  ].find((p) => fs2.existsSync(p));
  if (defaultSrc) {
    const raw = fs2.readFileSync(defaultSrc, "utf8");
    const html = renderMarkdown(stripFrontmatter(raw));
    writeJson(path3.join(_pagesDir, `${route}.json`), { title: "About", html });
    console.log(`  Auto-generated dataset about page: ${route} (from ${path3.basename(defaultSrc)})`);
  }
  const uiLangs = (config.uiLanguages || []).map((l) => l.code).filter((l) => l !== defaultLang);
  for (const lang of uiLangs) {
    const trAboutSrc = path3.join(dsDir, `about-${lang}.md`);
    if (!fs2.existsSync(trAboutSrc)) continue;
    const trRaw = fs2.readFileSync(trAboutSrc, "utf8");
    const trHtml = renderMarkdown(stripFrontmatter(trRaw));
    const trTitle = dsTranslations[lang]?.title ? `About ${dsTranslations[lang].title}` : "About";
    writeJson(path3.join(_pagesDir, `${route}.${lang}.json`), { title: trTitle, html: trHtml });
    console.log(`  Auto-generated dataset about page: ${route}.${lang}`);
  }
}
var siteBranding = { ...config.branding };
var basePathPrefix = process.env.BASE_PATH?.replace(/\/+$/, "") || "";
for (const key of ["logo", "footerLogo"]) {
  const suffix = key === "logo" ? "logo.svg" : "footer-logo.svg";
  if (siteBranding[key]) {
    const updated = { ...siteBranding[key], path: `${basePathPrefix}/logos/${config.id}-${suffix}` };
    if (siteBranding[key].localLight) updated.light = `${basePathPrefix}/logos/${config.id}-${suffix.replace(".svg", "-light.svg")}`;
    if (siteBranding[key].localDark) updated.dark = `${basePathPrefix}/logos/${config.id}-${suffix.replace(".svg", "-dark.svg")}`;
    delete updated.localPath;
    delete updated.remoteUrl;
    delete updated.localLight;
    delete updated.localDark;
    siteBranding[key] = updated;
  }
}
var datasetTranslations = {};
for (const d of config.datasets) {
  const reg = registerCache[d.id];
  const translations = { ...d.translations };
  if (reg?.description && typeof reg.description === "object") {
    for (const [lang, desc] of Object.entries(reg.description)) {
      if (!translations[lang]) translations[lang] = {};
      translations[lang].description = desc;
    }
  }
  if (reg?.ref) {
    const langs = reg.languages || [];
    for (const lang of langs) {
      if (!translations[lang]) translations[lang] = {};
      if (!translations[lang].title) translations[lang].title = reg.ref;
    }
  }
  if (Object.keys(translations).length > 0) {
    datasetTranslations[d.id] = translations;
  }
}
writeJson(path3.join(PUBLIC, "site-config.json"), {
  id: config.id,
  domain: config.domain,
  title: config.title,
  subtitle: config.subtitle,
  description: config.description,
  translations: config.translations || void 0,
  datasets: config.datasets.map((d) => d.id),
  datasetGroups: config.datasetGroups || void 0,
  datasetTranslations: Object.keys(datasetTranslations).length ? datasetTranslations : void 0,
  defaultDataset: config.datasets.length === 1 ? config.datasets[0].id : void 0,
  uiLanguages: config.uiLanguages || void 0,
  branding: siteBranding,
  analytics: config.analytics,
  features: config.features,
  social: config.social,
  nav: config.nav,
  footerNav: config.footerNav,
  defaults: config.defaults,
  email: config.email,
  pages: processedPages.length > 0 ? processedPages : void 0,
  contributors: config.contributors || void 0,
  copyright: config.copyright || void 0
});
console.log("Generated site-config.json");
var total = Object.values(counts).reduce((s, n) => s + n, 0);
console.log(`
Done! Generated data for ${total} concepts across ${registry.length} datasets.`);
for (const [id, count] of Object.entries(counts)) {
  console.log(`  ${id}: ${count} concepts`);
}
await writeBuildActivity(total, registry.map((r) => r.id), refMaps.uriBase);
fs2.writeFileSync(path3.join(DATA, "_vocab.ttl"), await buildVocabularyTurtle());
console.log("Emitted vocabulary graph: data/_vocab.ttl");
var contributors = config.contributors ?? [];
if (contributors.length > 0) {
  fs2.writeFileSync(path3.join(DATA, "agents.ttl"), await buildAgentsTurtle(contributors, refMaps.uriBase + "/agent", refMaps.uriBase + "/org"));
  console.log(`Emitted agents graph: data/agents.ttl (${contributors.length} contributors)`);
}
for (const ds of registry) {
  const bibPath = path3.join(DATA, ds.id, "bibliography.json");
  if (fs2.existsSync(bibPath)) {
    const bibJson = JSON.parse(fs2.readFileSync(bibPath, "utf8"));
    const bibTtl = await buildBibliographyTurtle(ds.id, bibJson, refMaps.uriBase);
    fs2.writeFileSync(path3.join(DATA, ds.id, "bib.ttl"), bibTtl);
  }
}
var datasetVersions = registry.map((ds) => ({
  registerId: ds.id,
  datasetIri: `${refMaps.uriBase}/${ds.id}/`,
  versions: [
    {
      version: pkgVersionForVersions(),
      generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
      changeSummary: `Build ${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}`
    }
  ]
}));
if (datasetVersions.length > 0) {
  const versionTtl = (await Promise.all(datasetVersions.map(
    (v) => buildVersionHistoryTurtle({
      registerId: v.registerId,
      datasetIri: v.datasetIri,
      versions: v.versions,
      associatedAgentIri: process.env.CI_BOT_AGENT_IRI ?? null
    })
  ))).join("\n");
  fs2.writeFileSync(path3.join(DATA, "versions.ttl"), versionTtl);
  console.log(`Emitted versions graph: data/versions.ttl (${datasetVersions.length} datasets)`);
}
function pkgVersionForVersions() {
  return JSON.parse(fs2.readFileSync(path3.join(__dirname3, "..", "package.json"), "utf8")).version;
}
