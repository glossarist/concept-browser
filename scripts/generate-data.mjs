import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(PUBLIC, 'data');

// Dataset color palette (matches browser's src/utils/dataset-style.ts)
const DS_PALETTE = [
  '#3366ff', '#0d9488', '#d97706', '#8b5cf6',
  '#ec4899', '#059669', '#dc2626', '#6366f1',
  '#0891b2', '#65a30d',
];

// --- Helpers ---
function readYaml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return yaml.load(content);
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function termToDesignation(term) {
  const doc = {
    '@type': term.type === 'expression' ? 'gl:Expression'
      : term.type === 'symbol' ? 'gl:Symbol'
      : term.type === 'abbreviation' ? 'gl:Abbreviation'
      : 'gl:Designation',
    'gl:normativeStatus': term.normative_status || 'preferred',
    'gl:term': term.designation,
  };
  if (term.gender) doc['gl:gender'] = term.gender;
  if (term.plurality) doc['gl:plurality'] = term.plurality;
  if (term.international !== undefined) doc['gl:international'] = term.international;
  return doc;
}

// Canonical format: definition is always [{content: "..."}]
function defsToJsonLd(defs) {
  if (!defs || !Array.isArray(defs)) return [];
  return defs
    .map(d => ({
      '@type': 'gl:DetailedDefinition',
      'gl:content': d.content || '',
    }))
    .filter(d => d['gl:content']);
}

function sourcesToJsonLd(sources) {
  if (!sources || !Array.isArray(sources)) return [];
  return sources.map(s => {
    const doc = { '@type': 'gl:ConceptSource' };
    if (s.type) doc['gl:sourceType'] = s.type;
    if (s.status) doc['gl:sourceStatus'] = s.status;
    if (s.origin) {
      const origin = { '@type': 'gl:Citation' };
      if (s.origin.ref) origin['gl:ref'] = s.origin.ref;
      if (s.origin.clause) origin['gl:clause'] = s.origin.clause;
      if (s.origin.link) origin['gl:link'] = s.origin.link;
      doc['gl:origin'] = origin;
    }
    return doc;
  });
}

// Canonical format: references are pre-extracted during harmonization
function refsToJsonLd(refs) {
  if (!refs || !Array.isArray(refs)) return [];
  return refs.map(r => ({
    '@id': r.id,
    'gl:term': r.term,
  })).filter(r => r['@id']);
}

const LANG_CODES = ['eng', 'ara', 'deu', 'fra', 'spa', 'ita', 'jpn', 'kor', 'pol', 'por', 'srp', 'swe', 'zho', 'rus', 'fin', 'dan', 'nld', 'msa', 'nob', 'nno', 'zho'];

function yamlToJsonLd(conceptYaml, register) {
  const termid = String(conceptYaml.termid);
  const doc = {
    '@context': 'https://glossarist.org/ns/context.jsonld',
    '@id': `https://glossarist.org/${register}/concept/${termid}`,
    '@type': 'gl:Concept',
    'gl:identifier': termid,
  };

  const localizations = {};
  for (const lang of LANG_CODES) {
    const lc = conceptYaml[lang];
    if (!lc) continue;

    const lDoc = {
      '@id': `https://glossarist.org/${register}/concept/${termid}/${lang}`,
      '@type': 'gl:LocalizedConcept',
      'gl:languageCode': lang,
    };

    if (lc.entry_status) lDoc['gl:entryStatus'] = lc.entry_status;
    if (lc.terms && lc.terms.length > 0) lDoc['gl:designation'] = lc.terms.map(termToDesignation);
    if (lc.definition) lDoc['gl:definition'] = defsToJsonLd(lc.definition);
    if (lc.notes && lc.notes.length > 0) lDoc['gl:notes'] = defsToJsonLd(lc.notes);
    if (lc.examples && lc.examples.length > 0) lDoc['gl:examples'] = defsToJsonLd(lc.examples);
    if (lc.sources && lc.sources.length > 0) lDoc['gl:source'] = sourcesToJsonLd(lc.sources);
    if (lc.lineage_source_similarity !== undefined) lDoc['gl:lineageSourceSimilarity'] = lc.lineage_source_similarity;
    if (lc.release) lDoc['gl:release'] = lc.release;
    if (lc.review_date) lDoc['gl:reviewDate'] = lc.review_date;
    if (lc.review_decision_date) lDoc['gl:reviewDecisionDate'] = lc.review_decision_date;
    if (lc.review_decision_event) lDoc['gl:reviewDecisionEvent'] = lc.review_decision_event;
    if (lc.review_status) lDoc['gl:reviewStatus'] = lc.review_status;
    if (lc.review_decision) lDoc['gl:reviewDecision'] = lc.review_decision;
    if (lc.review_decision_notes) lDoc['gl:reviewDecisionNotes'] = lc.review_decision_notes;
    if (lc.dates && lc.dates.length > 0) {
      lDoc['gl:dates'] = lc.dates.map(d => ({
        'gl:dateType': d.type,
        'gl:date': d.date,
      }));
    }

    // Structured cross-references (pre-extracted during harmonization)
    if (lc.references && lc.references.length > 0) {
      lDoc['gl:references'] = refsToJsonLd(lc.references);
    }

    localizations[lang] = lDoc;
  }

  if (Object.keys(localizations).length > 0) {
    doc['gl:localizedConcept'] = localizations;
  }

  return doc;
}

function getPrimaryDesignation(conceptYaml) {
  const descs = {};
  for (const lang of LANG_CODES) {
    const lc = conceptYaml[lang];
    if (lc && lc.terms && lc.terms.length > 0) {
      const preferred = lc.terms.find(t => t.normative_status === 'preferred') || lc.terms[0];
      descs[lang] = preferred.designation;
    }
  }
  return descs;
}

function getGroups(conceptYaml) {
  if (conceptYaml.eng && conceptYaml.eng.groups) return conceptYaml.eng.groups;
  const termid = String(conceptYaml.termid);
  if (/^\d{3}-/.test(termid)) return [termid.substring(0, 3)];
  if (/^\d+\.\d+\.\d+/.test(termid)) {
    const parts = termid.split('.');
    return [`${parts[0]}.${parts[1]}.${parts[2]}`];
  }
  return [];
}

// --- Dataset Processors ---
function processDataset(dir, register, opts) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml')).sort();
  const maxConcepts = opts.maxConcepts || files.length;

  console.log(`Processing ${register}: ${files.length} files available, taking ${Math.min(maxConcepts, files.length)}`);

  const conceptsDir = path.join(DATA, register, 'concepts');
  const concepts = [];
  const langTermCounts = {};
  const langDefCounts = {};

  for (let i = 0; i < Math.min(files.length, maxConcepts); i++) {
    const file = files[i];
    try {
      const conceptYaml = readYaml(path.join(dir, file));
      if (!conceptYaml || !conceptYaml.termid) continue;

      const termid = String(conceptYaml.termid);

      // Generate per-concept JSON-LD
      const jsonld = yamlToJsonLd(conceptYaml, register);
      writeJson(path.join(conceptsDir, `${termid}.json`), jsonld);

      // Build index entry
      concepts.push({
        id: termid,
        designations: getPrimaryDesignation(conceptYaml),
        groups: getGroups(conceptYaml),
        status: conceptYaml.eng?.entry_status || 'valid',
      });

      // Accumulate per-language stats
      for (const lang of opts.languages) {
        const lc = conceptYaml[lang];
        if (lc) {
          if (lc.terms && lc.terms.length > 0) {
            langTermCounts[lang] = (langTermCounts[lang] || 0) + 1;
          }
          if (lc.definition && (Array.isArray(lc.definition) ? lc.definition.some(d => d.content) : lc.definition)) {
            langDefCounts[lang] = (langDefCounts[lang] || 0) + 1;
          }
        }
      }
    } catch (e) {
      console.warn(`  Skipping ${file}: ${e.message}`);
    }
  }

  // Generate chunked index (500 concepts per chunk)
  const CHUNK_SIZE = 500;
  const chunks = [];
  for (let i = 0; i < concepts.length; i += CHUNK_SIZE) {
    const chunk = concepts.slice(i, i + CHUNK_SIZE);
    const chunkIndex = Math.floor(i / CHUNK_SIZE);
    const chunkFile = `index-${String(chunkIndex).padStart(4, '0')}.json`;
    writeJson(path.join(DATA, register, 'chunks', chunkFile), {
      registerId: register,
      chunkIndex,
      concepts: chunk,
    });
    chunks.push({ file: chunkFile, count: chunk.length });
  }

  // Generate summary index (lightweight — just IDs and first designation for search)
  const summary = concepts.map(c => ({
    id: c.id,
    eng: c.designations.eng || Object.values(c.designations)[0] || '',
    status: c.status,
  }));

  // Graph-level data: single compact file with only node data needed for visualization
  // Format: [id, primaryTerm, termLang, status] with shared uriPrefix
  const graphNodeEntries = concepts.map(c => {
    let term = '', lang = '';
    if (c.designations.eng) { term = c.designations.eng; lang = 'eng'; }
    else { for (const [l, t] of Object.entries(c.designations)) { if (t) { term = t; lang = l; break; } } }
    return [c.id, term, lang, c.status];
  });
  fs.mkdirSync(path.join(DATA, register), { recursive: true });
  fs.writeFileSync(
    path.join(DATA, register, 'graph-nodes.json'),
    JSON.stringify({
      uriPrefix: `https://glossarist.org/${register}/concept/`,
      registerId: register,
      nodes: graphNodeEntries,
    }),
  );

  writeJson(path.join(DATA, register, 'index.json'), {
    registerId: register,
    schemaVersion: '1.0.0',
    conceptCount: concepts.length,
    chunkSize: CHUNK_SIZE,
    chunks,
    concepts: summary,
  });

  // Lightweight metadata-only index for large datasets
  writeJson(path.join(DATA, register, 'index-meta.json'), {
    registerId: register,
    schemaVersion: '1.0.0',
    conceptCount: concepts.length,
    chunkSize: CHUNK_SIZE,
    chunks,
  });

  // Compute per-language statistics from accumulated counts
  const langStats = {};
  for (const lang of opts.languages) {
    langStats[lang] = {
      terms: langTermCounts[lang] || 0,
      definitions: langDefCounts[lang] || 0,
    };
  }

  // Generate manifest
  const manifest = {
    id: register,
    title: opts.title,
    description: opts.description,
    owner: opts.owner,
    baseUrl: `/data/${register}`,
    languages: opts.languages,
    conceptCount: concepts.length,
    conceptUrlTemplate: '{baseUrl}/concepts/{conceptId}.json',
    indexUrl: '{baseUrl}/index.json',
    contextUrl: 'https://glossarist.org/ns/context.jsonld',
    uriBase: 'https://glossarist.org',
    status: 'valid',
    schemaVersion: '1.0.0',
    tags: opts.tags,
    lastUpdated: new Date().toISOString().split('T')[0],
    sourceRepo: opts.sourceRepo,
    chunkSize: CHUNK_SIZE,
    color: opts.color,
    languageStats: langStats,
  };
  if (opts.existingSiteUrl) manifest.existingSiteUrl = opts.existingSiteUrl;
  if (opts.externalConceptUrlTemplate) manifest.externalConceptUrlTemplate = opts.externalConceptUrlTemplate;
  if (opts.languageOrder) manifest.languageOrder = opts.languageOrder;
  writeJson(path.join(DATA, register, 'manifest.json'), manifest);

  console.log(`  Generated ${concepts.length} concepts, manifest, ${chunks.length} index chunks`);
  return concepts.length;
}

// --- Main ---
console.log('Generating Glossarist vocabulary browser data...\n');

// Load datasets from datasets.yml
const configPath = path.join(ROOT, 'datasets.yml');
if (!fs.existsSync(configPath)) {
  console.error('datasets.yml not found. Run npm run fetch-datasets first.');
  process.exit(1);
}
const config = yaml.load(fs.readFileSync(configPath, 'utf8'));

const counts = {};
const registry = [];

for (let i = 0; i < config.datasets.length; i++) {
  const ds = config.datasets[i];

  // Always read from .datasets/{id}/concepts (harmonized by fetch-datasets)
  const dir = path.join(ROOT, '.datasets', ds.id, 'concepts');

  if (!fs.existsSync(dir)) {
    console.warn(`Skipping ${ds.id}: source directory not found (${dir})`);
    console.warn(`  Run: npm run fetch-datasets`);
    continue;
  }

  // Read register.yaml for metadata
  const registerDir = path.join(ROOT, '.datasets', ds.id);
  const registerYamlPath = path.join(registerDir, 'register.yaml');
  let registerMeta = {};
  if (fs.existsSync(registerYamlPath)) {
    try {
      registerMeta = readYaml(registerYamlPath) || {};
    } catch (e) {
      console.warn(`  Warning: could not read register.yaml: ${e.message}`);
    }
  }

  // Merge metadata: datasets.yml overrides → register.yaml → defaults
  const dsTitle = ds.title || registerMeta.name || ds.id;
  const dsDescription = ds.description || registerMeta.description || '';
  const dsLanguages = ds.languages || (registerMeta.subregisters ? Object.keys(registerMeta.subregisters) : ['eng']);

  counts[ds.id] = processDataset(dir, ds.id, {
    title: dsTitle,
    description: dsDescription,
    owner: ds.owner,
    languages: dsLanguages,
    sourceRepo: ds.sourceRepo,
    existingSiteUrl: ds.existingSiteUrl,
    externalConceptUrlTemplate: ds.externalConceptUrlTemplate,
    languageOrder: ds.languageOrder,
    tags: ds.tags,
    color: ds.color || DS_PALETTE[i % DS_PALETTE.length],
  });
  registry.push({ id: ds.id, manifestUrl: `/data/${ds.id}/manifest.json` });
}
writeJson(path.join(PUBLIC, 'datasets.json'), registry);

const total = Object.values(counts).reduce((s, n) => s + n, 0);
console.log(`\nDone! Generated data for ${total} concepts across ${registry.length} datasets.`);
for (const [id, count] of Object.entries(counts)) {
  console.log(`  ${id}: ${count} concepts`);
}
