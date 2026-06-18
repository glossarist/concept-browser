/**
 * Non-verbal entity consumer — reads source entities (JSON-LD preferred,
 * YAML fallback) and writes per-entity JSON + indexes to public/data/{ds}/.
 *
 * Source layout (preferred — produced by `glossarist export`):
 *   {sourceRoot}/figures/{id}.json
 *   {sourceRoot}/tables/{id}.json
 *   {sourceRoot}/formulas/{id}.json
 *
 * Fallback layout (raw glossarist YAML — converted minimally until
 * glossarist-ruby publishes export support for these entities):
 *   {sourceRoot}/figures/{id}.yaml
 *   {sourceRoot}/tables/{id}.yaml
 *   {sourceRoot}/formulas/{id}.yaml
 *
 * Output layout:
 *   public/data/{ds}/figures/{id}.json
 *   public/data/{ds}/tables/{id}.json
 *   public/data/{ds}/formulas/{id}.json
 *   public/data/{ds}/figures-index.json   { id: filename }
 *   public/data/{ds}/tables-index.json
 *   public/data/{ds}/formulas-index.json
 */

import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import yaml from 'js-yaml';

/** @typedef {'figure' | 'table' | 'formula'} NonVerbalKind */

/** @type {Record<NonVerbalKind, { dir: string, type: string }>} */
const KIND_META = {
  figure:  { dir: 'figures',  type: 'Figure'  },
  table:   { dir: 'tables',   type: 'Table'   },
  formula: { dir: 'formulas', type: 'Formula' },
};

/**
 * Convert a raw glossarist YAML entity to a JSON-LD-style document.
 * This is a temporary consumer-side bridge until glossarist-ruby's
 * `glossarist export` ships entity JSON-LD output natively.
 *
 * The output matches the wire format documented in TODO.figures/11-round-trip-spec.md.
 *
 * @param {Record<string, any>} yaml  Parsed YAML entity.
 * @param {NonVerbalKind} kind
 * @returns {Record<string, any>}     JSON-LD-style document.
 */
function yamlEntityToJsonLd(yaml, kind) {
  const meta = KIND_META[kind];
  const doc = {
    '@type': `gl:${meta.type}`,
    'gl:id': yaml.id,
  };
  if (yaml.identifier) doc['gl:identifier'] = yaml.identifier;
  if (yaml.caption) doc['gl:caption'] = yaml.caption;
  if (yaml.alt) doc['gl:altText'] = yaml.alt;
  if (yaml.description) doc['gl:description'] = yaml.description;
  if (Array.isArray(yaml.sources) && yaml.sources.length) {
    doc['gl:source'] = yaml.sources.map(s => yamlSourceToJsonLd(s));
  }

  if (kind === 'figure') {
    if (Array.isArray(yaml.images)) {
      doc['gl:image'] = yaml.images.map(img => ({
        'gl:src': img.src,
        'gl:format': img.format,
        ...(img.role ? { 'gl:role': img.role } : {}),
        ...(img.width != null ? { 'gl:width': img.width } : {}),
        ...(img.height != null ? { 'gl:height': img.height } : {}),
        ...(img.scale != null ? { 'gl:scale': img.scale } : {}),
      }));
    }
    if (Array.isArray(yaml.subfigures) && yaml.subfigures.length) {
      doc['gl:subfigure'] = yaml.subfigures.map(sub => yamlEntityToJsonLd(sub, 'figure'));
    }
  } else if (kind === 'table') {
    if (yaml.content) {
      const c = { ...yaml.content };
      if (c.type) {
        c['gl:type'] = c.type;
        delete c.type;
      }
      doc['gl:content'] = c;
    }
    if (yaml.format) doc['gl:format'] = yaml.format;
  } else if (kind === 'formula') {
    if (yaml.expression) doc['gl:expression'] = yaml.expression;
    if (yaml.notation) doc['gl:notation'] = yaml.notation;
  }

  return doc;
}

function yamlSourceToJsonLd(s) {
  const out = {};
  if (s.id) out['gl:id'] = s.id;
  if (s.type) out['gl:sourceType'] = s.type;
  if (s.status) out['gl:sourceStatus'] = s.status;
  if (s.modification) out['gl:modification'] = s.modification;
  if (s.origin) {
    const o = {};
    if (s.origin.ref) {
      o['gl:ref'] = typeof s.origin.ref === 'string'
        ? s.origin.ref
        : {
            ...(s.origin.ref.source ? { 'gl:source': s.origin.ref.source } : {}),
            ...(s.origin.ref.id ? { 'gl:id': s.origin.ref.id } : {}),
            ...(s.origin.ref.version ? { 'gl:version': s.origin.ref.version } : {}),
            ...(s.origin.ref.text ? { 'gl:text': s.origin.ref.text } : {}),
          };
    }
    if (s.origin.locality) {
      const l = s.origin.locality;
      o['gl:locality'] = {
        ...(l.type ? { 'gl:localityType': l.type } : {}),
        ...(l.reference_from ? { 'gl:referenceFrom': l.reference_from } : {}),
        ...(l.reference_to ? { 'gl:referenceTo': l.reference_to } : {}),
      };
    }
    if (s.origin.link) o['gl:link'] = s.origin.link;
    if (Object.keys(o).length) out['gl:origin'] = o;
  }
  return out;
}

/**
 * Read entities of one kind from sourceDir. Tries JSON first, falls back to YAML.
 *
 * @param {string} sourceDir
 * @param {NonVerbalKind} kind
 * @returns {Promise<Array<{ id: string, doc: Record<string, any> }>>}
 */
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
    if (ext === '.json') {
      try {
        const doc = JSON.parse(await readFile(full, 'utf8'));
        out.push({ id, doc });
      } catch (e) {
        console.warn(`  Warning: failed to parse ${full}: ${e.message}`);
      }
    } else if (ext === '.yaml' || ext === '.yml') {
      try {
        const raw = yaml.load(await readFile(full, 'utf8'));
        if (!raw || typeof raw !== 'object') continue;
        out.push({ id, doc: yamlEntityToJsonLd(raw, kind) });
      } catch (e) {
        console.warn(`  Warning: failed to parse ${full}: ${e.message}`);
      }
    }
  }
  return out;
}

/**
 * Consume non-verbal entities from sourceDir and write to public/data/{ds}/.
 *
 * @param {string} sourceRoot  Absolute path to the dataset source root.
 * @param {string} destRoot    Absolute path to public/data/{ds}/.
 * @returns {Promise<{ figures: number, tables: number, formulas: number, warnings: string[] }>}
 */
export async function consumeDatasetEntities(sourceRoot, destRoot) {
  const counts = { figures: 0, tables: 0, formulas: 0 };
  const warnings = [];

  for (const kind of /** @type {NonVerbalKind[]} */ (['figure', 'table', 'formula'])) {
    const meta = KIND_META[kind];
    const entities = await readEntitiesForKind(sourceRoot, kind);
    if (entities.length === 0) continue;

    const outDir = path.join(destRoot, meta.dir);
    await mkdir(outDir, { recursive: true });

    const index = {};
    for (const { id, doc } of entities) {
      const docId = doc['gl:id'] ?? doc['gloss:id'] ?? id;
      if (docId !== id) {
        warnings.push(`${meta.dir}/${id}: gl:id (${docId}) does not match filename`);
      }
      const dest = path.join(outDir, `${id}.json`);
      await writeFile(dest, JSON.stringify(doc, null, 2));
      index[id] = `${meta.dir}/${id}.json`;

      // Basic validation warnings — non-fatal, surface to authors.
      if (!doc[`gl:${kind === 'figure' ? 'altText' : ''}`] && kind === 'figure') {
        warnings.push(`${meta.dir}/${id}: missing gl:altText (accessibility)`);
      }
      if (!doc['gl:caption']) {
        warnings.push(`${meta.dir}/${id}: missing gl:caption`);
      }
    }

    const indexDest = path.join(destRoot, `${meta.dir}-index.json`);
    await writeFile(indexDest, JSON.stringify(index, null, 2));

    counts[meta.dir] = entities.length;
  }

  return {
    figures: counts.figures,
    tables: counts.tables,
    formulas: counts.formulas,
    warnings,
  };
}
