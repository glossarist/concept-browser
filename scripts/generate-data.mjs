import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import { naturalSort } from 'glossarist';
import { loadSiteConfig } from './load-site-config.mjs';

const __dirname = path.dirname(new URL(import.meta.url).pathname);
const ROOT = process.cwd();
const PUBLIC = path.join(ROOT, 'public');
const DATA = path.join(PUBLIC, 'data');

const DS_PALETTE = [
  '#3366ff', '#0d9488', '#d97706', '#8b5cf6',
  '#ec4899', '#059669', '#dc2626', '#6366f1',
  '#0891b2', '#65a30d',
];

function readYaml(filePath) {
  return yaml.load(fs.readFileSync(filePath, 'utf8'));
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
    for (const doc of docs.slice(1)) {
      if (!doc || !doc.data || !doc.data.language_code) continue;
      const lang = doc.data.language_code;
      const lcData = { ...doc.data };
      delete lcData.language_code;
      result[lang] = lcData;
    }
    return result;
  }

  return docs[0];
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

function refsToJsonLd(refs, refMaps) {
  if (!refs || !Array.isArray(refs)) return [];
  return refs.map(r => {
    if (r.id) return { '@id': r.id, 'gl:term': r.term };
    if (r.term && refMaps) {
      const uri = resolveRefUri(r.term, refMaps);
      if (uri) return { '@id': uri, 'gl:term': r.term };
    }
    return { '@id': r.id || r.term, 'gl:term': r.term };
  }).filter(r => r['@id']);
}

function resolveRefUri(term, refMaps) {
  const base = refMaps.uriBase;
  const urnPrefix = 'urn:iso:std:iso:';
  if (term.startsWith(urnPrefix)) {
    const rest = term.slice(urnPrefix.length);
    const match = rest.match(/^(\d+):(.+)$/);
    if (match) {
      const dsId = refMaps.urnStandardMap[match[1]];
      if (dsId) return `${base}/${dsId}/concept/${match[2]}`;
    }
  }
  const ievMatch = term.match(/^IEV:(\d+[-\d]+)$/);
  if (ievMatch) {
    const dsId = refMaps.refPrefixMap['IEV'];
    if (dsId) return `${base}/${dsId}/concept/${ievMatch[1]}`;
  }
  return null;
}

function buildRefMaps(config) {
  const refPrefixMap = {};
  const urnStandardMap = {};

  for (const ds of config.datasets) {
    const uri = ds.uri || '';
    const urnMatch = uri.match(/^urn:iso:std:iso:(\d+):\*$/);
    if (urnMatch) urnStandardMap[urnMatch[1]] = ds.id;
  }

  for (const route of config.routing || []) {
    if (route.uri && route.uri.includes('iec') && route.uri.includes('60050')) {
      const mapped = route.targetDataset;
      if (mapped) refPrefixMap['IEV'] = mapped;
    }
  }

  const xref = config.crossReferences || {};
  if (xref.refPrefixMap) Object.assign(refPrefixMap, xref.refPrefixMap);
  if (xref.urnStandardMap) Object.assign(urnStandardMap, xref.urnStandardMap);

  const uriBase = config.uriBase || `https://${config.domain}`;
  return { refPrefixMap, urnStandardMap, uriBase };
}

function extractInlineRefs(localizedData, refMaps) {
  const refs = [];
  const texts = [];
  const { refPrefixMap, urnStandardMap, uriBase } = refMaps;

  if (localizedData.definition) {
    const defs = Array.isArray(localizedData.definition) ? localizedData.definition : [localizedData.definition];
    for (const d of defs) texts.push(typeof d === 'string' ? d : (d.content || ''));
  }
  if (localizedData.notes) {
    for (const n of localizedData.notes) texts.push(typeof n === 'string' ? n : (n.content || ''));
  }
  if (localizedData.examples) {
    for (const e of localizedData.examples) texts.push(typeof e === 'string' ? e : (e.content || ''));
  }
  const fullText = texts.join(' ');

  for (const m of fullText.matchAll(/\{\{([^,}]+),\s*IEV:([^}]+)\}\}/g)) {
    const datasetId = refPrefixMap['IEV'];
    if (datasetId) refs.push({ id: `${uriBase}/${datasetId}/concept/${m[2]}`, term: m[1].trim() });
  }

  for (const m of fullText.matchAll(/\{urn:iso:std:iso:(\d+):([^,}]+),([^,}]+)(?:,([^}]+))?\}/g)) {
    const datasetId = urnStandardMap[m[1]];
    if (datasetId) refs.push({ id: `${uriBase}/${datasetId}/concept/${m[2]}`, term: (m[4] || m[3]).trim() });
  }

  for (const m of fullText.matchAll(/\{\{urn:iso:std:iso:(\d+):([^,}]+),([^,}]+)(?:,([^}]+))?\}\}/g)) {
    const datasetId = urnStandardMap[m[1]];
    if (datasetId) refs.push({ id: `${uriBase}/${datasetId}/concept/${m[2]}`, term: (m[4] || m[3]).trim() });
  }

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
    '@id': `${base}/${register}/concept/${termid}`,
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
    if (lc.references && lc.references.length > 0) {
      lDoc['gl:references'] = refsToJsonLd(lc.references, refMaps);
    } else if (refMaps) {
      const inlineRefs = extractInlineRefs(lc, refMaps);
      if (inlineRefs.length > 0) {
        lDoc['gl:references'] = refsToJsonLd(inlineRefs, refMaps);
      }
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
      const preferredExpr = lc.terms.find(t => t.normative_status === 'preferred' && t.type === 'expression');
      const preferred = preferredExpr || lc.terms.find(t => t.normative_status === 'preferred') || lc.terms[0];
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

function escapeTurtle(s) {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
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

  return JSON.stringify(doc, null, 2);
}

function escapeXml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
      if (d['gl:gender']) gramGrp = `\n            <grammaticalGender>${escapeXml(d['gl:gender'])}</grammaticalGender>`;
      let partOfSpeech = '';
      if (type.includes('Abbreviation')) partOfSpeech = '\n            <partOfSpeech>abbreviation</partOfSpeech>';
      if (type.includes('Symbol')) partOfSpeech = '\n            <partOfSpeech>symbol</partOfSpeech>';

      termEntries.push(`          <termEntry>
            <langSet xml:lang="${lang}">
              <tig>
                <term>${escapeXml(term)}</term>${gramGrp}${partOfSpeech}
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
      if (origin['gl:ref']) parts.push(origin['gl:ref']);
      if (origin['gl:clause']) parts.push(origin['gl:clause']);
      if (parts.length) {
        sourceBlock += `\n          <ref>${escapeXml(parts.join(', '))}</ref>`;
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

function processDataset(dir, register, opts) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.yaml')).sort((a, b) => naturalSort(a.replace('.yaml', ''), b.replace('.yaml', '')));

  console.log(`Processing ${register}: ${files.length} files`);

  const conceptsDir = path.join(DATA, register, 'concepts');
  const concepts = [];
  const langTermCounts = {};
  const langDefCounts = {};
  const availableFormats = ['ttl', 'jsonld', 'yaml', 'tbx'];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    try {
      const conceptYaml = loadConceptFile(path.join(dir, file));
      if (!conceptYaml || !conceptYaml.termid) continue;

      const termid = String(conceptYaml.termid);
      const jsonld = yamlToJsonLd(conceptYaml, register, refMaps);
      writeJson(path.join(conceptsDir, `${termid}.json`), jsonld);

      // Generate Turtle format
      const ttlContent = conceptJsonToTurtle(jsonld);
      fs.writeFileSync(path.join(conceptsDir, `${termid}.ttl`), ttlContent);

      // Generate SKOS JSON-LD format
      const skosJsonLd = conceptJsonToSkosJsonLd(jsonld);
      fs.writeFileSync(path.join(conceptsDir, `${termid}.jsonld`), skosJsonLd);

      // Generate TBX-XML format
      const tbxContent = conceptJsonToTbx(jsonld);
      if (tbxContent) {
        fs.writeFileSync(path.join(conceptsDir, `${termid}.tbx`), tbxContent);
      }

      // Copy source YAML
      fs.copyFileSync(path.join(dir, file), path.join(conceptsDir, `${termid}.yaml`));

      concepts.push({
        id: termid,
        designations: getPrimaryDesignation(conceptYaml),
        groups: getGroups(conceptYaml),
        status: conceptYaml.eng?.entry_status || 'valid',
      });

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
    eng: c.designations.eng || Object.values(c.designations)[0] || '',
    status: c.status,
  }));

  // Strip HTML from index summary for text display
  const plainSummary = summary.map(c => ({
    ...c,
    eng: c.eng.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(),
  }));

  const graphNodeEntries = concepts.map(c => {
    let term = '', lang = '';
    if (c.designations.eng) { term = c.designations.eng; lang = 'eng'; }
    else { for (const [l, t] of Object.entries(c.designations)) { if (t) { term = t; lang = l; break; } } }
    return [c.id, term.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(), lang, c.status];
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
  const compiledDir = path.join(ROOT, '.datasets', register, 'compiled');
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
    languageStats: langStats,
    availableFormats,
    bulkFormats,
    hasBibliography: opts.hasBibliography,
    hasImages: opts.hasImages,
  };
  if (opts.languageOrder) manifest.languageOrder = opts.languageOrder;
  writeJson(path.join(DATA, register, 'manifest.json'), manifest);

  // Copy bibliography.yaml → bibliography.json
  const bibPath = path.join(ROOT, '.datasets', register, 'bibliography.yaml');
  if (fs.existsSync(bibPath)) {
    const bibData = readYaml(bibPath);
    writeJson(path.join(DATA, register, 'bibliography.json'), bibData);
    console.log(`  Copied bibliography (${Object.keys(bibData).length} entries)`);
  }

  // Copy images/
  const imagesSrcDir = path.join(ROOT, '.datasets', register, 'images');
  if (fs.existsSync(imagesSrcDir) && fs.statSync(imagesSrcDir).isDirectory()) {
    const imagesDestDir = path.join(DATA, register, 'images');
    fs.mkdirSync(imagesDestDir, { recursive: true });
    let imgCount = 0;
    for (const file of fs.readdirSync(imagesSrcDir)) {
      const src = path.join(imagesSrcDir, file);
      if (fs.statSync(src).isFile()) {
        fs.copyFileSync(src, path.join(imagesDestDir, file));
        imgCount++;
      }
    }
    console.log(`  Copied ${imgCount} images`);
  }

  console.log(`  Generated ${concepts.length} concepts, manifest, ${chunks.length} index chunks`);
  return concepts.length;
}

// --- Main ---
console.log('Generating Glossarist vocabulary browser data...\n');

const { config } = loadSiteConfig();
const refMaps = buildRefMaps(config);
const counts = {};
const registry = [];

for (let i = 0; i < config.datasets.length; i++) {
  const ds = config.datasets[i];

  const dir = path.join(ROOT, '.datasets', ds.id, 'concepts');
  if (!fs.existsSync(dir)) {
    console.warn(`Skipping ${ds.id}: source directory not found (${dir})`);
    console.warn(`  Run: npm run fetch-datasets`);
    continue;
  }

  const registerDir = path.join(ROOT, '.datasets', ds.id);
  const registerYamlPath = path.join(registerDir, 'register.yaml');
  let registerMeta = {};
  if (fs.existsSync(registerYamlPath)) {
    try { registerMeta = readYaml(registerYamlPath) || {}; } catch {}
  }

  const dsLanguages = ds.languages || (registerMeta.subregisters ? Object.keys(registerMeta.subregisters) : ['eng']);

  counts[ds.id] = processDataset(dir, ds.id, {
    title: ds.title || registerMeta.name || ds.id,
    description: ds.description || registerMeta.description || '',
    owner: ds.owner,
    languages: dsLanguages,
    sourceRepo: ds.sourceRepo,
    languageOrder: ds.languageOrder,
    tags: ds.tags,
    color: ds.color || DS_PALETTE[i % DS_PALETTE.length],
    datasetUri: ds.uri,
    uriAliases: ds.uriAliases,
    hasBibliography: fs.existsSync(path.join(ROOT, '.datasets', ds.id, 'bibliography.yaml')),
    hasImages: fs.existsSync(path.join(ROOT, '.datasets', ds.id, 'images')),
  });
  registry.push({ id: ds.id, manifestUrl: `/data/${ds.id}/manifest.json` });
}
writeJson(path.join(PUBLIC, 'datasets.json'), registry);

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

// Generate site-config.json from site config
const siteBranding = { ...config.branding };
// Rewrite logo paths to destination filenames and strip build-time fields
for (const key of ['logo', 'footerLogo']) {
  const suffix = key === 'logo' ? 'logo.svg' : 'footer-logo.svg';
  if (siteBranding[key]) {
    siteBranding[key] = { ...siteBranding[key], path: `/logos/${config.id}-${suffix}` };
    delete siteBranding[key].localPath;
    delete siteBranding[key].remoteUrl;
  }
}

writeJson(path.join(PUBLIC, 'site-config.json'), {
  id: config.id,
  domain: config.domain,
  title: config.title,
  subtitle: config.subtitle,
  description: config.description,
  datasets: config.datasets.map(d => d.id),
  defaultDataset: config.datasets.length === 1 ? config.datasets[0].id : undefined,
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
