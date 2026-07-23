import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { naturalSort, Register, parseMention } from 'glossarist';
import { loadSiteConfig } from './load-site-config.mjs';
import { getGroups } from './lib/concept-groups.mjs';
import { consumeDatasetEntities } from './lib/build/non-verbal-consumer.mjs';
import { copyImageAssets } from './lib/build/image-assets.mjs';
import { buildDatasetTurtle } from './lib/dataset-turtle.mjs';
import { buildActivityTurtle } from './lib/build-activity-turtle.mjs';
import { buildVocabularyTurtle } from './lib/vocab-turtle.mjs';
import { buildAgentsTurtle } from './lib/agents-turtle.mjs';
import { buildVersionHistoryTurtle } from './lib/version-turtle.mjs';
import { buildBibliographyTurtle } from './lib/bibliography-turtle.mjs';
import { ttlLit } from './lib/turtle-escape.mjs';
import { firstNonEmpty } from './lib/first-non-empty.mjs';
function buildConceptUri(uriBase, registerId, conceptId) {
  return `${uriBase}/${registerId}/concept/${conceptId}`;
}


const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(PUBLIC, 'data');

/**
 * Resolve a dataset's source directory.
 * - If `ds.localPath` is set, use it in-place (resolved against ROOT).
 *   No staging, no copy. fetch-datasets.mjs verifies the path is safe.
 * - Otherwise fall back to the standard .datasets/<id>/ staging dir.
 */
function datasetDir(ds) {
  return ds.localPath
    ? path.resolve(ROOT, ds.localPath)
    : path.join(ROOT, '.datasets', ds.id);
}

const DS_PALETTE = [
  '#3366ff', '#0d9488', '#d97706', '#8b5cf6',
  '#ec4899', '#059669', '#dc2626', '#6366f1',
  '#0891b2', '#65a30d',
];

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
}

/** Strip HTML tags and normalize whitespace for plain-text display. */
function stripHtml(s) {
  return s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function loadConceptFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const docs = yaml.loadAll(content, null, { schema: yaml.DEFAULT_SCHEMA });

  if (docs.length === 1 && docs[0].termid !== undefined) {
    return docs[0];
  }

  if (docs.length >= 1 && docs[0].data && docs[0].data.identifier !== undefined) {
    const mc = docs[0];
    const result = { termid: String(mc.data.identifier) };

    // Managed concept-level fields
    if (mc.related) result._related = mc.related;
    if (mc.partitive_relations) result._partitiveRelations = mc.partitive_relations;
    if (mc.data.domains) result._domains = mc.data.domains;
    if (mc.dates) result._dates = mc.dates;
    if (mc.sources) result._sources = mc.sources;
    if (mc.status) result._status = mc.status;
    if (mc.schema_version) result._schemaVersion = mc.schema_version;
    if (mc.date_accepted) result._dateAccepted = mc.date_accepted;

    for (const doc of docs.slice(1)) {
      if (!doc) continue;
      const lang = doc.data?.language_code || doc.language_code;
      if (!lang) continue;
      const lcData = { ...(doc.data || {}) };
      delete lcData.language_code;
      // Merge top-level fields (terms, definition, notes, etc.) into lcData
      for (const key of ['terms', 'definition', 'notes', 'annotations', 'examples', 'sources', 'dates', 'domain', 'references', 'entry_status', 'classification', 'review_type', 'review_date', 'review_decision_date', 'review_decision_event', 'review_status', 'review_decision', 'review_decision_notes', 'lineage_source_similarity', 'release', 'script', 'system']) {
        if (doc[key] !== undefined && lcData[key] === undefined) {
          lcData[key] = doc[key];
        }
      }
      result[lang] = lcData;
    }
    return result;
  }

  return docs[0];
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data));
}

async function writeDatasetRdf(register, manifest, concepts, refMaps, opts) {
  const uriBase = refMaps?.uriBase;
  if (!uriBase) throw new Error('generate-data: uriBase is required — set uriBase in site-config.yml');
  const datasetIri = `${uriBase}/${register}/`;
  const topConceptUris = concepts
    .slice(0, 32)
    .map(c => buildConceptUri(uriBase, register, c.id));

  const sections = (manifest.sections ?? []).map(section => {
    const sectionId = section.id ?? section.slug ?? section.title;
    return {
      collectionIri: `${uriBase}/${register}/section/${sectionId}`,
      title: section.title ?? section.name ?? sectionId,
      memberUris: (section.members ?? []).map(id => buildConceptUri(uriBase, register, id)),
    };
  });

  const distributions = [
    {
      id: `${register}-ttl`,
      title: 'Turtle distribution',
      mediaType: 'text/turtle',
      downloadUrl: `${uriBase}/data/${register}/${register}.ttl`,
    },
    {
      id: `${register}-jsonld`,
      title: 'JSON-LD distribution',
      mediaType: 'application/ld+json',
      downloadUrl: `${uriBase}/data/${register}/${register}.jsonld`,
    },
  ];

  const ttl = await buildDatasetTurtle({
    datasetIri,
    registerId: register,
    title: manifest.title ?? register,
    description: manifest.description,
    modified: manifest.lastUpdated ?? new Date().toISOString().slice(0, 10),
    languages: opts.languages ?? ['eng'],
    distributions,
    topConceptUris,
    sections,
    sourceRepoUrl: manifest.sourceRepoUrl,
    publisherIri: manifest.publisher,
    contactIri: manifest.contactPoint,
  });
  fs.writeFileSync(path.join(DATA, register, `${register}.ttl`), ttl);
}

async function writeBuildActivity(conceptCount, datasetRegisters, baseUri) {
  const runId = process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT ?? '1'}`
    : `local-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const startedAt = process.env.BUILD_STARTED_AT ?? new Date(Date.now() - 60_000).toISOString();
  const endedAt = new Date().toISOString();
  const gitSha = process.env.GITHUB_SHA ?? null;
  const gitBranch = process.env.GITHUB_REF_NAME ?? null;
  const pkgVersion = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
  const agentIri = process.env.CI_BOT_AGENT_IRI ?? null;

  const ttl = await buildActivityTurtle({
    runId,
    startedAt,
    endedAt,
    gitSha,
    gitBranch,
    toolId: 'concept-browser',
    toolVersion: pkgVersion,
    datasetRegisters,
    conceptCount,
    associatedAgentIri: agentIri,
    baseUri,
  });
  const activityDir = path.join(DATA, 'activity');
  fs.mkdirSync(activityDir, { recursive: true });
  fs.writeFileSync(path.join(activityDir, `${runId}.ttl`), ttl);
  console.log(`Emitted build activity record: data/activity/${runId}.ttl`);
}

function termToDesignation(term) {
  const typeMap = {
    expression: 'gl:Expression',
    abbreviation: 'gl:Abbreviation',
    symbol: 'gl:Symbol',
    letter_symbol: 'gl:LetterSymbol',
    'graphical symbol': 'gl:GraphicalSymbol',
  };
  const doc = {
    '@type': typeMap[term.type] || 'gl:Designation',
    'gl:normativeStatus': term.normative_status || 'preferred',
    'gl:term': term.designation,
  };

  if (term.grammar_info && term.grammar_info.length > 0) {
    doc['gl:grammarInfo'] = term.grammar_info.map(gi => {
      const g = {};
      if (gi.gender) g['gl:gender'] = gi.gender;
      if (gi.number) g['gl:number'] = gi.number;
      for (const pos of ['noun', 'verb', 'adj', 'adverb', 'preposition', 'participle']) {
        if (gi[pos]) g[`gl:${pos}`] = gi[pos];
      }
      return g;
    });
  }

  if (term.international !== undefined) doc['gl:international'] = term.international;
  if (term.absent !== undefined) doc['gl:absent'] = term.absent;
  if (term.geographical_area) doc['gl:geographicalArea'] = term.geographical_area;
  if (term.term_type) doc['gl:termType'] = term.term_type;
  if (term.prefix) doc['gl:prefix'] = term.prefix;
  if (term.usage_info) doc['gl:usageInfo'] = term.usage_info;
  if (term.field_of_application) doc['gl:fieldOfApplication'] = term.field_of_application;

  if (term.acronym !== undefined) doc['gl:acronym'] = term.acronym;
  if (term.initialism !== undefined) doc['gl:initialism'] = term.initialism;
  if (term.truncation !== undefined) doc['gl:truncation'] = term.truncation;

  if (term.text) doc['gl:text'] = term.text;
  if (term.image) doc['gl:image'] = term.image;

  if (term.related && term.related.length > 0) {
    doc['gl:related'] = term.related.map(r => {
      const rel = {};
      if (r.type) rel['gl:relationshipType'] = r.type;
      if (r.target) {
        rel['gl:target'] = r.target;
      } else if (r.ref) {
        const ref = { '@type': 'gl:ConceptRef' };
        if (r.ref.source) ref['gl:source'] = r.ref.source;
        if (r.ref.id) ref['gl:id'] = r.ref.id;
        if (r.ref.text) ref['gl:text'] = r.ref.text;
        rel['gl:ref'] = ref;
      }
      return rel;
    });
  }

  return doc;
}

function defsToJsonLd(defs) {
  if (!defs || !Array.isArray(defs)) return [];
  return defs
    .map(d => ({
      '@type': 'gl:DetailedDefinition',
      'gl:content': d.content || '',
    }))
    .filter(d => d['gl:content']);
}

function refToJsonLd(ref, typeName = 'gl:Ref') {
  if (!ref) return undefined;
  const refObj = { '@type': typeName };
  if (typeof ref === 'string') {
    refObj['gl:source'] = ref;
  } else {
    if (ref.source) refObj['gl:source'] = ref.source;
    if (ref.id) refObj['gl:id'] = ref.id;
    if (ref.version) refObj['gl:version'] = ref.version;
    if (ref.text) refObj['gl:text'] = ref.text;
  }
  return refObj;
}

function localityToJsonLd(loc) {
  if (!loc) return undefined;
  const locObj = {};
  if (loc.type) locObj['gl:localityType'] = loc.type;
  if (loc.reference_from) locObj['gl:referenceFrom'] = loc.reference_from;
  if (loc.referenceFrom) locObj['gl:referenceFrom'] = loc.referenceFrom;
  if (loc.reference_to) locObj['gl:referenceTo'] = loc.reference_to;
  if (loc.referenceTo) locObj['gl:referenceTo'] = loc.referenceTo;
  return Object.keys(locObj).length > 0 ? locObj : undefined;
}

function sourcesToJsonLd(sources) {
  if (!sources || !Array.isArray(sources)) return [];
  return sources.map(s => {
    const doc = { '@type': 'gl:ConceptSource' };
    if (s.id) doc['gl:id'] = s.id;
    if (s.type) doc['gl:sourceType'] = s.type;
    if (s.status) doc['gl:sourceStatus'] = s.status;
    if (s.modification) doc['gl:modification'] = s.modification;
    if (s.origin) {
      const origin = { '@type': 'gl:Citation' };
      const ref = refToJsonLd(s.origin.ref);
      if (ref) origin['gl:ref'] = ref;
      const loc = localityToJsonLd(s.origin.locality);
      if (loc) origin['gl:locality'] = loc;
      if (s.origin.link) origin['gl:link'] = s.origin.link;
      doc['gl:origin'] = origin;
    }
    if (s.sourced_from && s.sourced_from.length) {
      doc['gl:sourcedFrom'] = s.sourced_from.map(sf => {
        const cite = { '@type': 'gl:Citation' };
        const ref = refToJsonLd(sf.ref);
        if (ref) cite['gl:ref'] = ref;
        const loc = localityToJsonLd(sf.locality);
        if (loc) cite['gl:locality'] = loc;
        if (sf.link) cite['gl:link'] = sf.link;
        return cite;
      });
    }
    return doc;
  });
}

function refsToJsonLd(refs, refMaps) {
  if (!refs || !Array.isArray(refs)) return [];
  return refs.map(r => {
    if (r.id) {
      const ref = { '@id': r.id, 'gl:term': r.term };
      if (r.sourceId) ref['gl:sourceId'] = r.sourceId;
      if (r.citation) ref['gl:citation'] = citationToJsonLd(r.citation);
      return ref;
    }
    if (r.term && refMaps) {
      const uri = resolveRefUri(r.term, refMaps);
      if (uri) return { '@id': uri, 'gl:term': r.term };
    }
    return { '@id': r.id || r.term, 'gl:term': r.term };
  }).filter(r => r['@id']);
}

function citationToJsonLd(citation) {
  const obj = {};
  const ref = refToJsonLd(citation.ref);
  if (ref) obj['gl:ref'] = ref;
  const loc = localityToJsonLd(citation.locality);
  if (loc) obj['gl:locality'] = loc;
  if (citation.link) obj['gl:link'] = citation.link;
  return obj;
}

function buildPatternIndex(datasets, registerCache) {
  const entries = [];

  for (const ds of datasets) {
    const reg = registerCache[ds.id] || null;
    const patterns = new Set();

    // Site-config patterns (primary)
    if (ds.uri) patterns.add(ds.uri);
    for (const alias of ds.uriAliases || []) patterns.add(alias);

    // Register.yaml patterns (supplementary)
    if (reg) {
      if (reg.urn && reg.urn.endsWith('*')) patterns.add(reg.urn);
      for (const alias of reg.urnAliases || []) patterns.add(alias);
    }

    for (const pattern of patterns) {
      if (!pattern.endsWith('*')) continue;
      const prefix = pattern.slice(0, -1);
      if (prefix) entries.push({ prefix, datasetId: ds.id });
    }
  }

  // Sort longest prefix first for correct longest-prefix matching
  entries.sort((a, b) => b.prefix.length - a.prefix.length);

  function resolve(uri) {
    for (const { prefix, datasetId } of entries) {
      if (uri.startsWith(prefix)) {
        return { datasetId, conceptId: uri.slice(prefix.length) };
      }
    }
    return null;
  }

  return { resolve, entries };
}

function resolveRefUri(term, refMaps) {
  const resolved = refMaps.patternIndex.resolve(term);
  if (resolved) return buildConceptUri(refMaps.uriBase, resolved.datasetId, resolved.conceptId);

  const ievMatch = term.match(/^IEV:(\d+[-\d]+)$/);
  if (ievMatch) {
    const dsId = refMaps.refPrefixMap['IEV'];
    if (dsId) return buildConceptUri(refMaps.uriBase, dsId, ievMatch[1]);
  }
  return null;
}

function buildRefMaps(config, registerCache) {
  const refPrefixMap = {};
  const patternIndex = buildPatternIndex(config.datasets, registerCache);

  for (const route of config.routing || []) {
    if (route.uri && route.uri.includes('iec') && route.uri.includes('60050')) {
      const mapped = route.targetDataset;
      if (mapped) refPrefixMap['IEV'] = mapped;
    }
  }

  const xref = config.crossReferences || {};
  if (xref.refPrefixMap) Object.assign(refPrefixMap, xref.refPrefixMap);

  const uriBase = config.uriBase;
  if (!uriBase) throw new Error('site-config.yml: uriBase is required');
  return { patternIndex, refPrefixMap, uriBase, register: null };
}


// ── Mention handlers (OCP: add new mention kinds by adding handlers) ─────

/**
 * Resolve an IEV:NNN-NN-NN display form to a concept URI.
 */
function resolveIevRef(display, term, refPrefixMap, uriBase) {
  if (!display.startsWith('IEV:')) return null;
  const datasetId = refPrefixMap['IEV'];
  if (!datasetId) return null;
  return { id: buildConceptUri(uriBase, datasetId, display.slice(4)), term };
}

/**
 * Resolve a URI identifier via the pattern index.
 */
function resolvePatternRef(identifier, display, refPrefixMap, patternIndex, uriBase) {
  const r = patternIndex.resolve(identifier);
  if (!r) return null;
  return { id: buildConceptUri(uriBase, r.datasetId, r.conceptId), term: display };
}

/**
 * Handle a cite-ref mention: links to a ConceptSource entry.
 */
function handleCiteRef(parsed, allSources) {
  const sourceEntry = allSources.find(s => s.id === parsed.key);
  if (sourceEntry) {
    return {
      id: `cite:${sourceEntry.id}`,
      term: parsed.label || sourceEntry.origin?.toString?.() || sourceEntry.id,
      sourceId: sourceEntry.id,
      citation: sourceEntry.origin || null,
    };
  }
  return {
    id: `cite:${parsed.key}`,
    term: parsed.label || parsed.key,
    sourceId: parsed.key,
    citation: null,
  };
}

/**
 * Handle a numeric mention: bare concept ID in same dataset.
 */
function handleNumeric(parsed, register, uriBase) {
  if (!register) return null;
  const term = parsed.label ?? parsed.id;
  return { id: buildConceptUri(uriBase, register, parsed.id), term };
}

/**
 * Handle a designation mention (glossarist >= 0.3.7):
 * {{designation,render term}} — resolve designation to concept ID in same dataset.
 * Falls back to the raw designation as the concept ID if no lookup table exists.
 */
function handleDesignation(parsed, refMaps) {
  const register = refMaps.register;
  if (!register) return null;
  const designation = parsed.id;
  const display = parsed.label ?? designation;
  const conceptId = refMaps.designationLookup?.get(designation.toLowerCase());
  return {
    id: buildConceptUri(refMaps.uriBase, register, conceptId ?? designation),
    term: display,
  };
}

/**
 * Handle an unresolved double-brace mention: try two-arg form.
 * Format: {{conceptId, displayTerm}} — concept ID first, render term last.
 */
function handleUnresolved(body, refMaps) {
  const commaMatch = body.match(/^([^,}]+),\s*(.+)$/);
  if (!commaMatch) return null;
  const identifier = commaMatch[1].trim();
  const display = commaMatch[2].trim();

  // IEV shortform: {{IEV:shortform, display_term}}
  const iev = resolveIevRef(identifier, display, refMaps.refPrefixMap, refMaps.uriBase);
  if (iev) return iev;

  // URI pattern match
  const pattern = resolvePatternRef(identifier, display, refMaps.refPrefixMap, refMaps.patternIndex, refMaps.uriBase);
  if (pattern) return pattern;

  // Same-dataset: {{conceptId, displayTerm}} where conceptId is numeric/X.Y
  const register = refMaps.register;
  if (register && (/^\d/.test(identifier) || /^[A-Z]\.\d/.test(identifier))) {
    return { id: buildConceptUri(refMaps.uriBase, register, identifier), term: display };
  }
  return null;
}

// ── Inline reference extraction ───────────────────────────────────────────

function collectTextContent(localizedData) {
  const texts = [];
  const textFields = ['definition', 'notes', 'examples'];
  for (const field of textFields) {
    const items = localizedData[field];
    if (!items) continue;
    const arr = Array.isArray(items) ? items : [items];
    for (const item of arr) {
      texts.push(typeof item === 'string' ? item : (item.content || ''));
    }
  }
  return texts.join(' ');
}

function extractInlineRefs(localizedData, refMaps, conceptSources = []) {
  const refs = [];
  const { refPrefixMap, patternIndex, uriBase } = refMaps;
  const fullText = collectTextContent(localizedData);
  const allSources = [...(localizedData.sources || []), ...conceptSources];

  // Single-brace mentions: {uri,display} (not {{...}})
  for (const m of fullText.matchAll(/\{([^,}]+),([^,}]+)(?:,([^}]+))?\}/g)) {
    const identifier = m[1].trim();
    const display = m[2].trim();
    const altDisplay = (m[3] || '').trim();
    if (!identifier || !display) continue;

    const iev = resolveIevRef(display, identifier, refPrefixMap, uriBase);
    if (iev) { refs.push(iev); continue; }

    const pattern = resolvePatternRef(identifier, altDisplay || display, refPrefixMap, patternIndex, uriBase);
    if (pattern) { refs.push(pattern); }
  }

  // Double-brace mentions: dispatched by parseMention kind
  for (const m of fullText.matchAll(/\{\{([^{}]+?)\}\}/g)) {
    const body = m[1];
    const parsed = parseMention(body);

    let ref = null;
    if (parsed.kind === 'cite-ref') {
      ref = handleCiteRef(parsed, allSources);
    } else if (parsed.kind === 'numeric') {
      ref = handleNumeric(parsed, refMaps.register, uriBase);
    } else if (parsed.kind === 'urn-ref') {
      // {{urn:...,render term}} — resolve URN via pattern index (cross-dataset)
      const uri = parsed.uri;
      const term = parsed.label ?? uri;
      const pattern = refMaps.patternIndex.resolve(uri);
      if (pattern) {
        ref = { id: buildConceptUri(refMaps.uriBase, pattern.datasetId, pattern.conceptId), term };
      } else {
        ref = { id: uri, term };
      }
    } else if (parsed.kind === 'designation') {
      // {{designation,render term}} — same-dataset designation reference
      ref = handleDesignation(parsed, refMaps);
    } else {
      ref = handleUnresolved(body, refMaps);
    }
    if (ref) refs.push(ref);
  }

  // Deduplicate by id
  const seen = new Set();
  return refs.filter(r => {
    if (seen.has(r.id)) return false;
    seen.add(r.id);
    return true;
  });
}

const LANG_CODES = ['eng', 'ara', 'deu', 'fra', 'spa', 'ita', 'jpn', 'kor', 'pol', 'por', 'srp', 'swe', 'zho', 'rus', 'fin', 'dan', 'nld', 'msa', 'nob', 'nno', 'zho'];

function yamlToJsonLd(conceptYaml, register, refMaps) {
  const termid = String(conceptYaml.termid);
  const base = refMaps.uriBase;
  const doc = {
    '@context': 'https://glossarist.org/ns/context.jsonld',
    '@id': buildConceptUri(base, register, termid),
    '@type': 'gl:Concept',
    'gl:identifier': termid,
  };

  const localizations = {};
  for (const lang of LANG_CODES) {
    const lc = conceptYaml[lang];
    if (!lc) continue;

    const lDoc = {
      '@id': `${base}/${register}/concept/${termid}/${lang}`,
      '@type': 'gl:LocalizedConcept',
      'gl:languageCode': lang,
    };

    if (lc.entry_status) lDoc['gl:entryStatus'] = lc.entry_status;
    if (lc.classification) lDoc['gl:classification'] = lc.classification;
    if (lc.review_type) lDoc['gl:reviewType'] = lc.review_type;
    if (lc.script) lDoc['gl:script'] = lc.script;
    if (lc.system) lDoc['gl:system'] = lc.system;
    if (lc.terms && lc.terms.length > 0) lDoc['gl:designation'] = lc.terms.map(termToDesignation);
    if (lc.definition) lDoc['gl:definition'] = defsToJsonLd(lc.definition);
    if (lc.notes && lc.notes.length > 0) lDoc['gl:notes'] = defsToJsonLd(lc.notes);
    if (lc.annotations && lc.annotations.length > 0) lDoc['gl:annotations'] = defsToJsonLd(lc.annotations);
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
    if (lc.domain) lDoc['gl:domain'] = lc.domain;
    if (lc.dates && lc.dates.length > 0) {
      lDoc['gl:dates'] = lc.dates.map(d => ({
        'gl:dateType': d.type,
        'gl:date': d.date,
      }));
    }
    if (lc.references && lc.references.length > 0) {
      lDoc['gl:references'] = refsToJsonLd(lc.references, refMaps);
    } else if (refMaps) {
      const inlineRefs = extractInlineRefs(lc, refMaps, conceptYaml._sources);
      if (inlineRefs.length > 0) {
        lDoc['gl:references'] = refsToJsonLd(inlineRefs, refMaps);
      }
    }

    localizations[lang] = lDoc;
  }

  if (Object.keys(localizations).length > 0) {
    doc['gl:localizedConcept'] = localizations;
  }

  // Managed concept-level fields (v3)
  if (conceptYaml._status) doc['gl:status'] = conceptYaml._status;
  if (conceptYaml._schemaVersion) doc['gl:schemaVersion'] = conceptYaml._schemaVersion;
  if (conceptYaml._dateAccepted) doc['gl:dateAccepted'] = conceptYaml._dateAccepted;

  if (conceptYaml._dates && conceptYaml._dates.length > 0) {
    doc['gl:dates'] = conceptYaml._dates.map(d => ({
      'gl:dateType': d.type,
      'gl:date': d.date,
    }));
  }

  if (conceptYaml._sources && conceptYaml._sources.length > 0) {
    doc['gl:source'] = sourcesToJsonLd(conceptYaml._sources);
  }

  if (conceptYaml._domains && conceptYaml._domains.length > 0) {
    doc['gl:domain'] = conceptYaml._domains.map(d => {
      const domain = { '@type': 'gl:ConceptReference' };
      if (d.concept_id) domain['gl:conceptId'] = d.concept_id;
      if (d.source) domain['gl:source'] = d.source;
      if (d.urn) domain['gl:urn'] = d.urn;
      if (d.ref_type) domain['gl:refType'] = d.ref_type;
      return domain;
    });
  }

  if (conceptYaml._related && conceptYaml._related.length > 0) {
    doc['gl:related'] = conceptYaml._related.map(r => {
      const rel = { '@type': 'gl:RelatedConcept' };
      if (r.type) rel['gl:relationshipType'] = r.type;
      if (r.content) rel['gl:content'] = r.content;
      if (r.ref) {
        const ref = {};
        if (r.ref.source) ref['gl:source'] = r.ref.source;
        if (r.ref.id) ref['gl:id'] = r.ref.id;
        if (r.ref.text) ref['gl:text'] = r.ref.text;
        rel['gl:ref'] = ref;
      }
      return rel;
    });
  }

  if (conceptYaml._partitiveRelations?.length > 0) {
    doc['gl:partitiveRelations'] = conceptYaml._partitiveRelations.map(rel => {
      const out = { '@type': 'gl:PartitiveRelation' };
      if (rel.comprehensive) {
        out['gl:comprehensive'] = refToJsonLd(rel.comprehensive, 'gl:ConceptRef');
      }
      if (Array.isArray(rel.partitives) && rel.partitives.length > 0) {
        out['gl:hasPartitive'] = rel.partitives.map(member => {
          const m = { '@type': 'gl:PartitiveMember' };
          if (member.ref) {
            m['gl:ref'] = refToJsonLd(member.ref, 'gl:ConceptRef');
          } else {
            m['gl:ref'] = refToJsonLd(member, 'gl:ConceptRef');
          }
          if (member.certainty) m['gl:certainty'] = member.certainty;
          return m;
        });
      }
      if (rel.completeness) {
        out['gl:completeness'] = rel.completeness;
      }
      if (rel.plurality) {
        const pl = { '@type': 'gl:TypeSharedPlurality' };
        pl['gl:isShared'] = rel.plurality.is_shared ?? rel.plurality.isShared ?? false;
        if (rel.plurality.is_uncertain ?? rel.plurality.isUncertain) {
          pl['gl:isUncertain'] = rel.plurality.is_uncertain ?? rel.plurality.isUncertain;
        }
        if (rel.plurality.shared_type ?? rel.plurality.sharedType) {
          pl['gl:sharedType'] = refToJsonLd(
            rel.plurality.shared_type ?? rel.plurality.sharedType,
            'gl:ConceptRef',
          );
        }
        out['gl:hasPlurality'] = pl;
      }
      if (rel.criterion) {
        out['gl:criterion'] = typeof rel.criterion === 'string'
          ? { default: rel.criterion }
          : rel.criterion;
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
      const preferredExpr = lc.terms.find(t => t.normative_status === 'preferred' && t.type === 'expression');
      const preferred = preferredExpr || lc.terms.find(t => t.normative_status === 'preferred') || lc.terms[0];
      descs[lang] = preferred.designation;
    }
  }
  return descs;
}

function escapeTurtle(s) {
  return ttlLit(s).slice(1, -1);
}

function conceptJsonToTurtle(concept) {
  const uri = concept['@id'] || '';
  const id = concept['gl:identifier'] || '';
  const lines = [
    '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .',
    '@prefix dcterms: <http://purl.org/dc/terms/> .',
    '',
  ];

  const props = ['  a skos:Concept'];
  props.push(`  skos:notation "${escapeTurtle(id)}"`);

  for (const [lang, lc] of Object.entries(concept['gl:localizedConcept'] || {})) {
    if (lc['gl:designation']) {
      for (const d of lc['gl:designation']) {
        const term = d['gl:term'];
        if (!term) continue;
        const pred = d['gl:normativeStatus'] === 'preferred' ? 'skos:prefLabel' : 'skos:altLabel';
        props.push(`  ${pred} "${escapeTurtle(term)}"@${lang}`);
      }
    }
    if (lc['gl:definition']) {
      for (const d of lc['gl:definition']) {
        if (d['gl:content']) props.push(`  skos:definition "${escapeTurtle(d['gl:content'])}"@${lang}`);
      }
    }
    if (lc['gl:notes']) {
      for (const d of lc['gl:notes']) {
        if (d['gl:content']) props.push(`  skos:scopeNote "${escapeTurtle(d['gl:content'])}"@${lang}`);
      }
    }
  }

  lines.push(`<${uri}>`);
  lines.push(props.join(' ;\n'));
  lines.push(' .');
  return lines.join('\n');
}

function conceptJsonToSkosJsonLd(concept) {
  const uri = concept['@id'] || '';
  const id = concept['gl:identifier'] || '';

  const doc = {
    '@context': {
      skos: 'http://www.w3.org/2004/02/skos/core#',
      dcterms: 'http://purl.org/dc/terms/',
      '@language': { '@container': '@language' },
    },
    '@id': uri,
    '@type': 'skos:Concept',
    'skos:notation': id,
  };

  const prefLabels = {}, altLabels = {}, definitions = {}, scopeNotes = {};
  for (const [lang, lc] of Object.entries(concept['gl:localizedConcept'] || {})) {
    const descs = lc['gl:designation'] || [];
    const pref = descs.find(d => d['gl:normativeStatus'] === 'preferred' && d['gl:term']);
    const alt = descs.find(d => d['gl:normativeStatus'] !== 'preferred' && d['gl:term']);
    if (pref) prefLabels[lang] = pref['gl:term'];
    if (alt) altLabels[lang] = alt['gl:term'];
    const def = (lc['gl:definition'] || [])[0];
    if (def?.['gl:content']) definitions[lang] = def['gl:content'];
    const note = (lc['gl:notes'] || [])[0];
    if (note?.['gl:content']) scopeNotes[lang] = note['gl:content'];
  }

  if (Object.keys(prefLabels).length) doc['skos:prefLabel'] = prefLabels;
  if (Object.keys(altLabels).length) doc['skos:altLabel'] = altLabels;
  if (Object.keys(definitions).length) doc['skos:definition'] = definitions;
  if (Object.keys(scopeNotes).length) doc['skos:scopeNote'] = scopeNotes;

  return JSON.stringify(doc);
}

function escapeXml(s) {
  const str = Array.isArray(s) ? s.join(', ') : String(s ?? '');
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function conceptJsonToTbx(concept) {
  const id = concept['gl:identifier'] || '';
  const uri = concept['@id'] || '';
  const localized = concept['gl:localizedConcept'] || {};

  const langSections = [];
  for (const [lang, lc] of Object.entries(localized)) {
    const descs = lc['gl:designation'] || [];
    const definitions = (lc['gl:definition'] || []).filter(d => d['gl:content']);
    const notes = (lc['gl:notes'] || []).filter(d => d['gl:content']);
    const examples = (lc['gl:examples'] || []).filter(d => d['gl:content']);
    const sources = lc['gl:source'] || [];
    const entryStatus = lc['gl:entryStatus'] || '';

    if (!descs.length && !definitions.length) continue;

    const termEntries = [];
    for (const d of descs) {
      const term = d['gl:term'];
      if (!term) continue;
      const status = d['gl:normativeStatus'] || '';
      const type = d['@type'] || '';
      let gramGrp = '';
      if (d['gl:grammarInfo'] && d['gl:grammarInfo'].length > 0) {
        const gi = d['gl:grammarInfo'][0];
        if (gi['gl:gender']) gramGrp = `\n            <grammaticalGender>${escapeXml(gi['gl:gender'])}</grammaticalGender>`;
        if (gi['gl:number']) gramGrp += `\n            <grammaticalNumber>${escapeXml(gi['gl:number'])}</grammaticalNumber>`;
        for (const pos of ['noun', 'verb', 'adj', 'adverb', 'preposition', 'participle']) {
          if (gi[`gl:${pos}`]) gramGrp += `\n            <partOfSpeech>${pos}</partOfSpeech>`;
        }
      }
      let posBlock = '';
      if (type.includes('Abbreviation')) posBlock = '\n            <partOfSpeech>abbreviation</partOfSpeech>';
      if (type.includes('Symbol')) posBlock = '\n            <partOfSpeech>symbol</partOfSpeech>';

      termEntries.push(`          <termEntry>
            <langSet xml:lang="${lang}">
              <tig>
                <term>${escapeXml(term)}</term>${gramGrp}${posBlock}
              </tig>
            </langSet>
          </termEntry>`);
    }

    let defBlock = '';
    if (definitions.length) {
      const defParts = definitions.map(d => `            <p>${escapeXml(d['gl:content'])}</p>`).join('\n');
      defBlock = `\n          <descrip type="definition">\n${defParts}\n          </descrip>`;
    }

    let noteBlock = '';
    for (let i = 0; i < notes.length; i++) {
      noteBlock += `\n          <note type="note">${escapeXml(notes[i]['gl:content'])}</note>`;
    }
    for (let i = 0; i < examples.length; i++) {
      noteBlock += `\n          <note type="example">${escapeXml(examples[i]['gl:content'])}</note>`;
    }

    let sourceBlock = '';
    for (const src of sources) {
      const origin = src['gl:origin'] || {};
      const parts = [];
      const ref = origin['gl:ref'];
      if (ref) {
        const refParts = [];
        if (ref['gl:source']) refParts.push(ref['gl:source']);
        if (ref['gl:id']) refParts.push(ref['gl:id']);
        parts.push(refParts.join(' ') || '');
      }
      if (origin['gl:locality']) {
        const loc = origin['gl:locality'];
        if (loc['gl:referenceFrom']) parts.push(loc['gl:localityType'] ? `${loc['gl:localityType']} ${loc['gl:referenceFrom']}` : loc['gl:referenceFrom']);
      }
      if (parts.filter(Boolean).length) {
        sourceBlock += `\n          <ref>${escapeXml(parts.filter(Boolean).join(', '))}</ref>`;
      }
    }

    let statusBlock = '';
    if (entryStatus) {
      statusBlock += `\n          <descrip type="entryStatus">${escapeXml(entryStatus)}</descrip>`;
    }

    const termEntriesBlock = termEntries.length ? '\n' + termEntries.join('\n') : '';
    langSections.push({ lang, termEntries, blocks: [defBlock, noteBlock, sourceBlock, statusBlock].filter(b => b).join('') });
  }

  if (!langSections.length) return '';

  const bodyEntries = langSections.map(ls => {
    return `      <languageSection xml:lang="${ls.lang}">${ls.blocks}\n      </languageSection>`;
  }).join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<tbx style="dca" type="TBX-Basic" xml:lang="en" xmlns="urn:iso:std:iso:30042:ed-2">
  <tbxHeader>
    <fileDesc>
      <source>${escapeXml(uri)}</source>
    </fileDesc>
  </tbxHeader>
  <text>
    <body>
      <conceptEntry id="${escapeXml(id)}">
${bodyEntries}
      </conceptEntry>
    </body>
  </text>
</tbx>
`;
}

async function processDataset(dir, register, opts) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml')).sort((a, b) => naturalSort(a.replace('.yaml', ''), b.replace('.yaml', '')));

  console.log(`Processing ${register}: ${files.length} files`);

  const conceptsDir = path.join(DATA, register, 'concepts');
  // Clean previous output to avoid stale files accumulating across runs
  if (fs.existsSync(conceptsDir)) {
    for (const f of fs.readdirSync(conceptsDir)) fs.unlinkSync(path.join(conceptsDir, f));
  }
  const concepts = [];
  const langTermCounts = {};
  const langDefCounts = {};
  const availableFormats = ['ttl', 'jsonld', 'yaml', 'tbx'];

  // Pre-scan: build designation → concept ID lookup for same-dataset designation refs
  const designationLookup = new Map();
  for (const file of files) {
    try {
      const conceptYaml = loadConceptFile(path.join(dir, file));
      if (!conceptYaml?.termid) continue;
      const termid = String(conceptYaml.termid);
      for (const lang of Object.keys(conceptYaml)) {
        const lc = conceptYaml[lang];
        if (!lc || typeof lc !== 'object' || !Array.isArray(lc.terms)) continue;
        for (const term of lc.terms) {
          const designation = term.designation;
          if (typeof designation === 'string' && designation && !designationLookup.has(designation.toLowerCase())) {
            designationLookup.set(designation.toLowerCase(), termid);
          }
        }
      }
    } catch {}
  }

  const dsRefMaps = { ...refMaps, register, designationLookup };

  const stats = {
    sourceMap: new Map(),
    relTypeCounts: {},
    partitiveRelations: {
      count: 0,
      byCompleteness: { complete: 0, partial: 0 },
      byMemberCertainty: { confirmed: 0, possible: 0 },
      withCriterion: 0,
      withoutCriterion: 0,
      withPlurality: 0,
    },
  };

  const STATS_PROCESSORS = [
    function collectSources(cy, termid, s) {
      const refs = new Set();
      const allSources = [
        ...(cy._sources || []),
        ...opts.languages.flatMap(l => cy[l]?.sources || []),
      ];
      for (const src of allSources) {
        const ref = src.origin?.ref?.source || src.origin?.ref?.id || 'Unknown';
        refs.add(ref);
        if (!s.sourceMap.has(ref)) s.sourceMap.set(ref, { ref, types: new Set(), conceptIds: [] });
        if (src.type) s.sourceMap.get(ref).types.add(src.type);
      }
      for (const ref of refs) s.sourceMap.get(ref)?.conceptIds.push(termid);
    },
    function countRelationships(cy, _termid, s) {
      for (const r of cy._related || []) {
        const type = r.type || 'unknown';
        s.relTypeCounts[type] = (s.relTypeCounts[type] || 0) + 1;
      }
    },
    function countPartitiveRelations(cy, _termid, s) {
      for (const rel of cy._partitiveRelations || []) {
        s.partitiveRelations.count += 1;
        const completeness = rel.completeness || 'complete';
        s.partitiveRelations.byCompleteness[completeness] =
          (s.partitiveRelations.byCompleteness[completeness] || 0) + 1;
        const partitives = rel.partitives || [];
        for (const member of partitives) {
          const certainty = member.certainty || 'confirmed';
          s.partitiveRelations.byMemberCertainty[certainty] =
            (s.partitiveRelations.byMemberCertainty[certainty] || 0) + 1;
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
          if (lc.definition && (Array.isArray(lc.definition) ? lc.definition.some(d => d.content) : lc.definition)) {
            langDefCounts[lang] = (langDefCounts[lang] || 0) + 1;
          }
        }
      }
    },
  ];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const conceptYaml = loadConceptFile(path.join(dir, file));
      if (!conceptYaml || !conceptYaml.termid) continue;

      const termid = String(conceptYaml.termid);
      const jsonld = yamlToJsonLd(conceptYaml, register, dsRefMaps);
      writeJson(path.join(conceptsDir, `${termid}.json`), jsonld);

      const ttlContent = conceptJsonToTurtle(jsonld);
      fs.writeFileSync(path.join(conceptsDir, `${termid}.ttl`), ttlContent);

      const skosJsonLd = conceptJsonToSkosJsonLd(jsonld);
      fs.writeFileSync(path.join(conceptsDir, `${termid}.jsonld`), skosJsonLd);

      const tbxContent = conceptJsonToTbx(jsonld);
      if (tbxContent) {
        fs.writeFileSync(path.join(conceptsDir, `${termid}.tbx`), tbxContent);
      }

      fs.copyFileSync(path.join(dir, file), path.join(conceptsDir, `${termid}.yaml`));

      concepts.push({
        id: termid,
        designations: getPrimaryDesignation(conceptYaml),
        groups: getGroups(conceptYaml),
        status: conceptYaml.eng?.entry_status || 'valid',
      });

      for (const processor of STATS_PROCESSORS) {
        processor(conceptYaml, termid, stats);
      }
    } catch (e) {
      console.warn(`  Skipping ${file}: ${e.message}`);
    }
  }

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

  const summary = concepts.map(c => ({
    id: c.id,
    designations: c.designations,
    eng: c.designations.eng || Object.values(c.designations)[0] || '',
    status: c.status,
    groups: c.groups || [],
  }));

  // Strip HTML from index summary for text display
  const plainSummary = summary.map(c => {
    const designations = {};
    for (const [lang, term] of Object.entries(c.designations)) {
      if (term) designations[lang] = stripHtml(term);
    }
    return {
      ...c,
      designations,
      eng: stripHtml(c.eng),
    };
  });

  const graphNodeEntries = concepts.map(c => {
    const cleanDesignations = {};
    for (const [l, t] of Object.entries(c.designations)) {
      if (t) cleanDesignations[l] = stripHtml(t);
    }
    return [c.id, cleanDesignations, c.status];
  });
  fs.mkdirSync(path.join(DATA, register), { recursive: true });
  fs.writeFileSync(
    path.join(DATA, register, 'graph-nodes.json'),
    JSON.stringify({
      uriPrefix: `${refMaps.uriBase}/${register}/concept/`,
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
    concepts: plainSummary,
  });

  writeJson(path.join(DATA, register, 'index-meta.json'), {
    registerId: register,
    schemaVersion: '1.0.0',
    conceptCount: concepts.length,
    chunkSize: CHUNK_SIZE,
    chunks,
  });

  const langStats = {};
  for (const lang of opts.languages) {
    langStats[lang] = {
      terms: langTermCounts[lang] || 0,
      definitions: langDefCounts[lang] || 0,
    };
  }

  // Copy bulk format files from compiled/ directory (full GCR)
  const sourceRoot = path.dirname(dir);
  const compiledDir = path.join(sourceRoot, 'compiled');
  const bulkFormats = [];
  if (fs.existsSync(compiledDir)) {
    for (const file of fs.readdirSync(compiledDir)) {
      const src = path.join(compiledDir, file);
      const dest = path.join(DATA, register, file);
      fs.copyFileSync(src, dest);
      const ext = path.extname(file);
      const formatMap = {
        '.ttl': 'turtle',
        '.jsonld': 'jsonld',
        '.xml': 'tbx',
        '.jsonl': 'jsonl',
        '.yaml': 'yaml',
      };
      const formatName = formatMap[ext] || ext.slice(1);
      bulkFormats.push({ file, format: formatName, size: fs.statSync(src).size });
    }
    if (bulkFormats.length) {
      console.log(`  Copied ${bulkFormats.length} bulk format files`);
    }
  }

  const sourceStats = Array.from(stats.sourceMap.values())
    .map(s => ({
      ref: s.ref,
      types: Array.from(s.types),
      conceptCount: s.conceptIds.length,
      conceptIds: s.conceptIds,
    }))
    .sort((a, b) => b.conceptCount - a.conceptCount);
  const totalRelationships = Object.values(stats.relTypeCounts).reduce((a, b) => a + b, 0);

  writeJson(path.join(DATA, register, 'stats.json'), {
    sourceCount: sourceStats.length,
    sources: sourceStats,
    relationshipCount: totalRelationships,
    relationshipTypes: stats.relTypeCounts,
    partitiveRelations: stats.partitiveRelations,
  });

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
    conceptUrlTemplate: '{baseUrl}/concepts/{conceptId}.json',
    indexUrl: '{baseUrl}/index.json',
    contextUrl: 'https://glossarist.org/ns/context.jsonld',
    uriBase: refMaps.uriBase,
    status: 'valid',
    schemaVersion: '1.0.0',
    tags: opts.tags,
    lastUpdated: new Date().toISOString().split('T')[0],
    sourceRepo: opts.sourceRepo,
    chunkSize: CHUNK_SIZE,
    color: opts.color,
    year: opts.year ?? undefined,
    languageStats: langStats,
    availableFormats,
    bulkFormats,
    hasBibliography: opts.hasBibliography,
    hasImages: opts.hasImages,
  };
  if (opts.languageOrder) manifest.languageOrder = opts.languageOrder;
  if (opts.ref) manifest.ref = opts.ref;
  if (opts.refAliases) manifest.refAliases = opts.refAliases;
  if (opts.status) manifest.editionStatus = opts.status;
  if (opts.ordering) manifest.ordering = opts.ordering;
  if (opts.sections && opts.sections.length > 0) manifest.sections = opts.sections;
  writeJson(path.join(DATA, register, 'manifest.json'), manifest);

  // Dataset-level RDF (WS J2/J5): dcat:Dataset + skos:ConceptScheme + skos:Collection per section.
  await writeDatasetRdf(register, manifest, concepts, refMaps, opts);

  // Copy bibliography.yaml → bibliography.json
  const bibPath = path.join(sourceRoot, 'bibliography.yaml');
  if (fs.existsSync(bibPath)) {
    const bibData = readYaml(bibPath);
    writeJson(path.join(DATA, register, 'bibliography.json'), bibData);
    const bibCount = Array.isArray(bibData?.bibliography) ? bibData.bibliography.length : 0;
    console.log(`  Copied bibliography (${bibCount} entries)`);
  }

  // Copy images/ with magic-byte validation + manifest emission.
  const imagesSrcDir = path.join(sourceRoot, 'images');
  if (fs.existsSync(imagesSrcDir) && fs.statSync(imagesSrcDir).isDirectory()) {
    const imagesDestDir = path.join(DATA, register, 'images');
    const result = await copyImageAssets(imagesSrcDir, imagesDestDir);
    console.log(`  Copied ${result.count} images (skipped ${result.skipped.length})`);
    for (const w of result.skipped) {
      console.warn(`    Warning: skipped image ${w}`);
    }
  }

  // Consume non-verbal entities (figures/tables/formulas) — JSON-LD preferred,
  // YAML fallback. Writes per-entity JSON + indexes.
  const nvResult = await consumeDatasetEntities(sourceRoot, path.join(DATA, register));
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

// --- Main ---
console.log('Generating Glossarist vocabulary browser data...\n');

const { config } = loadSiteConfig();
const counts = {};
const registry = [];
const registerCache = {};

// Pre-load all register.yaml files (needed before buildRefMaps for URI pattern indexing)
for (const ds of config.datasets) {
  const dsDir = datasetDir(ds);
  const registerYamlPath = path.join(dsDir, 'register.yaml');
  if (fs.existsSync(registerYamlPath)) {
    try {
      const raw = yaml.load(fs.readFileSync(registerYamlPath, 'utf8'));
      registerCache[ds.id] = Register.fromJSON(raw);
    } catch (e) {
      console.warn(`  Warning: failed to parse register.yaml for ${ds.id}: ${e.message}`);
    }
  }
}

const refMaps = buildRefMaps(config, registerCache);

for (let i = 0; i < config.datasets.length; i++) {
  const ds = config.datasets[i];

  const dir = path.join(datasetDir(ds), 'concepts');
  if (!fs.existsSync(dir)) {
    console.warn(`Skipping ${ds.id}: source directory not found (${dir})`);
    console.warn(`  Run: npm run fetch-datasets`);
    continue;
  }

  // Use cached register
  const reg = registerCache[ds.id] || null;

  // Content fields: register-wins, site-config fallback. Layout-only
  // fields (uri, color, gcrPackage) stay on site-config.
  const dsLanguages = firstNonEmpty(reg?.languages, ds.languages, ['eng']);

  // Resolve description: register-wins (localized object), site-config fallback
  const defaultLang = dsLanguages[0] || 'eng';
  const regDesc = reg?.description;
  const dsDesc = ds.description;
  const resolvedDescription = (typeof regDesc === 'object' && Object.keys(regDesc).length > 0)
    ? regDesc[defaultLang] || Object.values(regDesc)[0] || ''
    : dsDesc || '';

  // Title: register.displayName wins (TODO.refactor/40 — Register.name
  // is first-class in glossarist-js since v0.4.13). Site-config title
  // is fallback, then ref (citation proxy), then id.
  const resolvedTitle = reg?.displayName(defaultLang)
    ?? ds.title
    ?? reg?.ref
    ?? ds.id;

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
    sections: reg?.sections ? reg.sections.map(s => s.toJSON()) : [],
    hasBibliography: fs.existsSync(path.join(datasetDir(ds), 'bibliography.yaml')),
    hasImages: fs.existsSync(path.join(datasetDir(ds), 'images')),
  });
  const resolvedOwner = firstNonEmpty(reg?.owner, ds.owner) ?? '';
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
      year: reg?.year ?? undefined,
    },
    datasetUri: resolvedDatasetUri,
    uriBase: config.uriBase || undefined,
    uriAliases: resolvedUriAliases,
    ref: resolvedRef,
    refAliases: resolvedRefAliases,
  });
}
writeJson(path.join(PUBLIC, 'datasets.json'), registry);

// Clean stale dataset directories not referenced in config
const configuredIds = new Set(config.datasets.map(d => d.id));
if (fs.existsSync(DATA)) {
  for (const entry of fs.readdirSync(DATA)) {
      const stalePath = path.join(DATA, entry);
    if (!configuredIds.has(entry) && fs.statSync(stalePath).isDirectory()) {
      fs.rmSync(stalePath, { recursive: true, force: true });
      console.log(`  Removed stale data directory: ${entry}`);
    }
  }
}

// Generate routing.json from site config
writeJson(path.join(PUBLIC, 'routing.json'), config.routing || []);
console.log('Generated routing.json');

// Copy/download logos
async function processLogo(logoConfig, filename) {
  if (!logoConfig) return;
  const destDir = path.join(PUBLIC, 'logos');
  fs.mkdirSync(destDir, { recursive: true });
  const destPath = path.join(destDir, filename);

  // Local file in deployment repo
  if (logoConfig.localPath) {
    const src = path.resolve(process.cwd(), logoConfig.localPath);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, destPath);
      console.log(`  Copied logo: ${src} → ${destPath}`);
      return;
    }
    console.warn(`  Logo not found at: ${src}`);
  }

  // Remote URL
  if (logoConfig.remoteUrl) {
    try {
      console.log(`  Downloading logo: ${logoConfig.remoteUrl}`);
      const resp = await fetch(logoConfig.remoteUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const buf = Buffer.from(await resp.arrayBuffer());
      fs.writeFileSync(destPath, buf);
      console.log(`  Saved logo: ${destPath}`);
    } catch (e) {
      console.warn(`  Logo download failed: ${e.message}`);
    }
  }
}

await processLogo(config.branding?.logo, `${config.id}-logo.svg`);
await processLogo(config.branding?.footerLogo, `${config.id}-footer-logo.svg`);

// Process light/dark logo variants
if (config.branding?.logo?.localLight) {
  await processLogo({ localPath: config.branding.logo.localLight }, `${config.id}-logo-light.svg`);
}
if (config.branding?.logo?.localDark) {
  await processLogo({ localPath: config.branding.logo.localDark }, `${config.id}-logo-dark.svg`);
}

// === Page processors ===

function processNewsPage(config, page) {
  const newsDir = page.source
    ? path.resolve(process.cwd(), page.source)
    : config.newsDir
      ? path.resolve(process.cwd(), config.newsDir)
      : null;

  if (!newsDir || !fs.existsSync(newsDir)) {
    if (newsDir) console.warn(`News directory not found: ${newsDir}`);
    return;
  }

  const index = [];
  const newsOutDir = path.join(PUBLIC, 'news');
  fs.mkdirSync(newsOutDir, { recursive: true });
  const postFiles = fs.readdirSync(newsDir).filter(f => f.endsWith('.adoc') || f.endsWith('.md')).sort().reverse();

  for (const file of postFiles) {
    const content = fs.readFileSync(path.join(newsDir, file), 'utf8');
    const frontmatter = {};
    const bodyLines = [];

    let inFm = false;
    const lines = content.split('\n');
    if (lines[0] === '---') {
      inFm = true;
      for (let i = 1; i < lines.length; i++) {
        if (lines[i] === '---') { inFm = false; continue; }
        if (inFm) {
          const m = lines[i].match(/^(\w[\w\s]*):\s*(.*)/);
          if (m) frontmatter[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
        } else {
          bodyLines.push(lines[i]);
        }
      }
    } else {
      bodyLines.push(...lines);
    }

    const slug = file.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace(/\.(adoc|md)$/, '');
    const body = bodyLines.join('\n').trim();

    const ext = path.extname(file);
    const destFile = path.join(newsOutDir, `${slug}${ext}`);
    fs.copyFileSync(path.join(newsDir, file), destFile);

    index.push({
      slug,
      title: frontmatter.title || slug,
      date: frontmatter.date || '',
      categories: frontmatter.categories ? frontmatter.categories.split(',').map(s => s.trim()) : [],
      file: `/news/${slug}${ext}`,
      excerpt: body.split('\n').find(l => l.trim())?.slice(0, 200) || '',
    });
  }

  writeJson(path.join(PUBLIC, 'news.json'), index);
  console.log(`Generated news index: ${index.length} posts, ${postFiles.length} files copied to public/news/`);
}

// --- Markdown-lite renderer (isomorphic, same logic as src/utils/markdown-lite.ts) ---

function renderMarkdown(input) {
  const INLINE_PATTERNS = [
    [/\*\*(.+?)\*\*/g, m => `<strong>${m[1]}</strong>`],
    [/(?<!\*)\*([^*]+?)\*(?!\*)/g, m => `<em>${m[1]}</em>`],
    [/`([^`]+?)`/g, m => `<code>${m[1]}</code>`],
    [/\[([^\]]+)\]\(([^)]+)\)/g, m => `<a href="${m[2]}" target="_blank">${m[1]}</a>`],
  ];
  function renderInline(text) {
    for (const [re, fn] of INLINE_PATTERNS) {
      text = text.replace(re, (...args) => fn(args));
    }
    return text;
  }
  function escapeHtml(s) {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const blocks = [];
  const lines = input.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trimStart().startsWith('```')) {
      const lang = line.trim().slice(3);
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].trimStart().startsWith('```')) { codeLines.push(lines[i]); i++; }
      i++;
      blocks.push(`<pre><code${lang ? ` class="language-${lang}"` : ''}>${escapeHtml(codeLines.join('\n'))}</code></pre>`);
      continue;
    }
    const hm = line.match(/^(#{1,4})\s+(.+)/);
    if (hm) { blocks.push(`<h${hm[1].length + 1}>${renderInline(hm[2])}</h${hm[1].length + 1}>`); i++; continue; }
    if (/^---+\s*$/.test(line)) { blocks.push('<hr>'); i++; continue; }
    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) { items.push(`<li>${renderInline(lines[i].replace(/^\s*[-*]\s+/, ''))}</li>`); i++; }
      blocks.push(`<ul>${items.join('')}</ul>`); continue;
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) { items.push(`<li>${renderInline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`); i++; }
      blocks.push(`<ol>${items.join('')}</ol>`); continue;
    }
    if (/^>\s?/.test(line)) {
      const ql = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) { ql.push(lines[i].replace(/^>\s?/, '')); i++; }
      blocks.push(`<blockquote>${renderInline(ql.join(' '))}</blockquote>`); continue;
    }
    if (/^\|(.+)\|$/.test(line) && i + 1 < lines.length && /^\|[-:| ]+\|$/.test(lines[i + 1])) {
      const headerCells = line.split('|').map(c => c.trim()).filter(Boolean);
      i += 2;
      const rows = [];
      while (i < lines.length && /^\|(.+)\|$/.test(lines[i])) {
        rows.push(lines[i].split('|').map(c => c.trim()).filter(Boolean));
        i++;
      }
      const thCells = headerCells.map(c => `<th>${renderInline(c)}</th>`).join('');
      const trRows = rows.map(r => `<tr>${r.map(c => `<td>${renderInline(c)}</td>`).join('')}</tr>`).join('');
      blocks.push(`<table><thead><tr>${thCells}</tr></thead><tbody>${trRows}</tbody></table>`);
      continue;
    }
    if (!line.trim()) { i++; continue; }
    const pl = [];
    while (i < lines.length && lines[i].trim() && !/^#{1,4}\s/.test(lines[i]) && !/^\s*[-*]\s+/.test(lines[i]) && !/^\s*\d+\.\s+/.test(lines[i]) && !/^>\s?/.test(lines[i]) && !lines[i].trimStart().startsWith('```')) { pl.push(lines[i]); i++; }
    if (pl.length) blocks.push(`<p>${renderInline(pl.join(' '))}</p>`);
  }
  return blocks.join('\n');
}

function processContentPage(config, page) {
  if (!page.source) {
    console.warn(`  Skipping content page '${page.route}': no source file`);
    return;
  }
  const srcPath = path.resolve(ROOT, page.source);
  if (!fs.existsSync(srcPath)) {
    console.warn(`  Skipping content page '${page.route}': source not found (${srcPath})`);
    return;
  }
  const raw = fs.readFileSync(srcPath, 'utf8');
  const ext = path.extname(srcPath).toLowerCase();
  let html;
  if (ext === '.html' || ext === '.htm') {
    html = raw;
  } else {
    const stripped = stripFrontmatter(raw);
    html = renderMarkdown(stripped);
  }

  const pagesDir = path.join(PUBLIC, 'pages');
  fs.mkdirSync(pagesDir, { recursive: true });
  writeJson(path.join(pagesDir, `${page.route}.json`), { title: page.title, html });
  console.log(`  Generated content page: ${page.route} (${ext})`);

  // Generate localized versions
  if (page.translations) {
    for (const [lang, tr] of Object.entries(page.translations)) {
      const { source, title: trTitle } = tr;
      if (!source) continue;
      const trSrcPath = path.resolve(ROOT, source);
      if (!fs.existsSync(trSrcPath)) {
        console.warn(`  Skipping '${page.route}' translation '${lang}': source not found (${trSrcPath})`);
        continue;
      }
      const trRaw = fs.readFileSync(trSrcPath, 'utf8');
      const trExt = path.extname(trSrcPath).toLowerCase();
      let trHtml;
      if (trExt === '.html' || trExt === '.htm') {
        trHtml = trRaw;
      } else {
        trHtml = renderMarkdown(stripFrontmatter(trRaw));
      }
      writeJson(path.join(pagesDir, `${page.route}.${lang}.json`), { title: trTitle || page.title, html: trHtml });
      console.log(`  Generated localized page: ${page.route}.${lang} (${trExt})`);
    }
  }
}

function stripFrontmatter(text) {
  const lines = text.split('\n');
  if (lines[0] !== '---') return text;
  let end = -1;
  for (let i = 1; i < lines.length; i++) { if (lines[i] === '---') { end = i; break; } }
  if (end < 0) return text;
  return lines.slice(end + 1).join('\n').trim();
}

const pageProcessors = {
  news: processNewsPage,
  page: processContentPage,
  about: processContentPage,
};

function synthesizePages(config) {
  const pages = [];
  if (config.newsDir) pages.push({ type: 'news', route: 'news', title: 'News', icon: 'newspaper' });
  return pages;
}

function processPages(config) {
  const pages = config.pages || synthesizePages(config);
  for (const page of pages) {
    const processor = pageProcessors[page.type];
    if (processor) processor(config, page);
  }
  return pages;
}

const processedPages = processPages(config);

// Auto-generate dataset about pages from {localPath}/about-{lang}.md
const _pagesDir = path.join(PUBLIC, 'pages');
for (const ds of config.datasets || []) {
  if (!ds.localPath) continue;
  const dsDir = path.resolve(ROOT, ds.localPath);
  const defaultLang = (ds.languages || ['eng'])[0];
  const route = `${ds.id}-about`;
  const dsTranslations = ds.translations || {};

  // Default-language about page: try about-{defaultLang}.md, fall back to about.md
  const defaultSrc = [
    path.join(dsDir, `about-${defaultLang}.md`),
    path.join(dsDir, 'about.md'),
  ].find(p => fs.existsSync(p));

  if (defaultSrc) {
    const raw = fs.readFileSync(defaultSrc, 'utf8');
    const html = renderMarkdown(stripFrontmatter(raw));
    writeJson(path.join(_pagesDir, `${route}.json`), { title: 'About', html });
    console.log(`  Auto-generated dataset about page: ${route} (from ${path.basename(defaultSrc)})`);
  }

  // Translated about pages for all non-default UI languages
  const uiLangs = (config.uiLanguages || []).map(l => l.code).filter(l => l !== defaultLang);
  for (const lang of uiLangs) {
    const trAboutSrc = path.join(dsDir, `about-${lang}.md`);
    if (!fs.existsSync(trAboutSrc)) continue;
    const trRaw = fs.readFileSync(trAboutSrc, 'utf8');
    const trHtml = renderMarkdown(stripFrontmatter(trRaw));
    const trTitle = dsTranslations[lang]?.title ? `About ${dsTranslations[lang].title}` : 'About';
    writeJson(path.join(_pagesDir, `${route}.${lang}.json`), { title: trTitle, html: trHtml });
    console.log(`  Auto-generated dataset about page: ${route}.${lang}`);
  }
}

// Generate site-config.json from site config
const siteBranding = { ...config.branding };
// Rewrite logo paths to destination filenames and strip build-time fields
const basePathPrefix = process.env.BASE_PATH?.replace(/\/+$/, '') || '';
for (const key of ['logo', 'footerLogo']) {
  const suffix = key === 'logo' ? 'logo.svg' : 'footer-logo.svg';
  if (siteBranding[key]) {
    const updated = { ...siteBranding[key], path: `${basePathPrefix}/logos/${config.id}-${suffix}` };
    if (siteBranding[key].localLight) updated.light = `${basePathPrefix}/logos/${config.id}-${suffix.replace('.svg', '-light.svg')}`;
    if (siteBranding[key].localDark) updated.dark = `${basePathPrefix}/logos/${config.id}-${suffix.replace('.svg', '-dark.svg')}`;
    delete updated.localPath;
    delete updated.remoteUrl;
    delete updated.localLight;
    delete updated.localDark;
    siteBranding[key] = updated;
  }
}

// Build dataset translations map: register descriptions win, site-config fills gaps
const datasetTranslations = {};
for (const d of config.datasets) {
  const reg = registerCache[d.id];
  const translations = { ...d.translations };

  // Register descriptions are authoritative; site-config translations fill gaps
  if (reg?.description && typeof reg.description === 'object') {
    for (const [lang, desc] of Object.entries(reg.description)) {
      if (!translations[lang]) translations[lang] = {};
      translations[lang].description = desc;
    }
  }

  // Title falls back to register.ref when site-config doesn't supply one
  // (TODO.refactor/40 — replace ref with Register.name once it exists)
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

writeJson(path.join(PUBLIC, 'site-config.json'), {
  id: config.id,
  domain: config.domain,
  title: config.title,
  subtitle: config.subtitle,
  description: config.description,
  translations: config.translations || undefined,
  datasets: config.datasets.map(d => d.id),
  datasetGroups: config.datasetGroups || undefined,
  datasetTranslations: Object.keys(datasetTranslations).length ? datasetTranslations : undefined,
  defaultDataset: config.datasets.length === 1 ? config.datasets[0].id : undefined,
  uiLanguages: config.uiLanguages || undefined,
  branding: siteBranding,
  analytics: config.analytics,
  features: config.features,
  social: config.social,
  nav: config.nav,
  footerNav: config.footerNav,
  defaults: config.defaults,
  email: config.email,
  pages: processedPages.length > 0 ? processedPages : undefined,
  contributors: config.contributors || undefined,
  copyright: config.copyright || undefined,
});
console.log('Generated site-config.json');

const total = Object.values(counts).reduce((s, n) => s + n, 0);
console.log(`\nDone! Generated data for ${total} concepts across ${registry.length} datasets.`);
for (const [id, count] of Object.entries(counts)) {
  console.log(`  ${id}: ${count} concepts`);
}

await writeBuildActivity(total, registry.map(r => r.id), refMaps.uriBase);

fs.writeFileSync(path.join(DATA, '_vocab.ttl'), await buildVocabularyTurtle());
console.log('Emitted vocabulary graph: data/_vocab.ttl');

const contributors = config.contributors ?? [];
if (contributors.length > 0) {
  fs.writeFileSync(path.join(DATA, 'agents.ttl'), await buildAgentsTurtle(contributors, refMaps.uriBase + '/agent', refMaps.uriBase + '/org'));
  console.log(`Emitted agents graph: data/agents.ttl (${contributors.length} contributors)`);
}

// Bibliography aggregation (K5): one bib.ttl per register from bibliography.json
for (const ds of registry) {
  const bibPath = path.join(DATA, ds.id, 'bibliography.json');
  if (fs.existsSync(bibPath)) {
    const bibJson = JSON.parse(fs.readFileSync(bibPath, 'utf8'));
    const bibTtl = await buildBibliographyTurtle(ds.id, bibJson, refMaps.uriBase);
    fs.writeFileSync(path.join(DATA, ds.id, 'bib.ttl'), bibTtl);
  }
}

const datasetVersions = registry.map(ds => ({
  registerId: ds.id,
  datasetIri: `${refMaps.uriBase}/${ds.id}/`,
  versions: [
    {
      version: pkgVersionForVersions(),
      generatedAt: new Date().toISOString(),
      changeSummary: `Build ${new Date().toISOString().slice(0, 10)}`,
    },
  ],
}));

if (datasetVersions.length > 0) {
  const versionTtl = (await Promise.all(datasetVersions.map(v =>
    buildVersionHistoryTurtle({
      registerId: v.registerId,
      datasetIri: v.datasetIri,
      versions: v.versions,
      associatedAgentIri: process.env.CI_BOT_AGENT_IRI ?? null,
    }),
  ))).join('\n');
  fs.writeFileSync(path.join(DATA, 'versions.ttl'), versionTtl);
  console.log(`Emitted versions graph: data/versions.ttl (${datasetVersions.length} datasets)`);
}

function pkgVersionForVersions() {
  return JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8')).version;
}
