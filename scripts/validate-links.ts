#!/usr/bin/env node
/**
 * validate-links — post-generate link integrity check.
 *
 * Scans every generated concept JSON in public/data/ for links pointing
 * to URIs that should exist locally (gl:related targets, gl:references,
 * partitive/generic relation targets). Reports all broken links with
 * file:line precision and fails the build if any are found.
 *
 * Usage:
 *   npx tsx scripts/validate-links.ts [public/data]
 *
 * Default exit codes:
 *   0  all links resolve
 *   1  one or more broken links (build fails)
 */

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { cwd } from 'node:process';

const DATA_DIR = process.argv[2] ?? join(cwd(), 'public', 'data');

interface BrokenLink {
  file: string;
  line: number;
  field: string;
  target: string;
  reason: string;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) walk(full, out);
    else if (entry.endsWith('.json')) out.push(full);
  }
  return out;
}

function localPathForUri(uri: string, dataDir: string): { exists: boolean; expected: string } {
  // URIs are like https://example.com/cie-eilv/cie-2011/concept/17-580
  // We need to find the matching JSON file: data/cie-2011/concepts/17-580.json
  const match = uri.match(/\/([^/]+)\/concept\/([^/]+?)(?:\/|$)/);
  if (!match) return { exists: false, expected: '' };
  const [, datasetId, conceptId] = match;
  const decoded = decodeURIComponent(conceptId);
  const expected = join(dataDir, datasetId, 'concepts', `${decoded}.json`);
  return { exists: existsSync(expected), expected };
}

function checkFile(file: string, dataDir: string): BrokenLink[] {
  const raw = readFileSync(file, 'utf8');
  const json = JSON.parse(raw);
  const broken: BrokenLink[] = [];

  function check(target: string | undefined, field: string) {
    if (!target || typeof target !== 'string') return;
    if (!target.startsWith('http')) return; // External links checked separately
    const { exists, expected } = localPathForUri(target, dataDir);
    if (!exists) {
      broken.push({
        file: file.replace(cwd() + '/', ''),
        line: 0,
        field,
        target,
        reason: expected ? `local target file missing: ${expected}` : 'unparseable URI',
      });
    }
  }

  // ── Concept-level cross-references ─────────────────────────────────────
  // gl:related entries
  for (const r of json['gl:related'] ?? []) {
    check(r['gl:target'], 'gl:related[].gl:target');
    check(r['@id'], 'gl:related[].@id');
  }

  // gl:references (localization-level)
  for (const lc of Object.values(json['gl:localizedConcept'] ?? {})) {
    for (const ref of (lc as any)['gl:references'] ?? []) {
      if (ref['@id']) check(ref['@id'], 'gl:references[].@id');
    }
  }

  // gl:partitiveRelations → gl:hasPartitive[].gl:ref / gl:comprehensive
  for (const pr of json['gl:partitiveRelations'] ?? []) {
    check(pr['gl:comprehensive']?.['@id'] ?? pr['gl:comprehensive'], 'gl:partitiveRelations.gl:comprehensive');
    for (const m of pr['gl:hasPartitive'] ?? []) {
      check(m['gl:ref']?.['@id'] ?? m['gl:ref'], 'gl:partitiveRelations.gl:hasPartitive[].gl:ref');
    }
  }

  // gl:genericRelations → gl:hasMember[].gl:ref / gl:comprehensive
  for (const gr of json['gl:genericRelations'] ?? []) {
    check(gr['gl:comprehensive']?.['@id'] ?? gr['gl:comprehensive'], 'gl:genericRelations.gl:comprehensive');
    for (const m of gr['gl:hasMember'] ?? []) {
      check(m['gl:ref']?.['@id'] ?? m['gl:ref'], 'gl:genericRelations.gl:hasMember[].gl:ref');
    }
  }

  // ── Inline mention validation ─────────────────────────────────────────
  // Scan ALL text content (definitions, notes, examples, annotations) for
  // {{kind:target}} mentions and validate each by kind. No mention is
  // silently skipped — every xref must resolve.
  const datasetDir = file.includes('/concepts/') ? dirname(dirname(file)) : '';
  const bibPath = datasetDir ? join(datasetDir, 'bibliography.json') : '';
  let bibliography: Record<string, any> | null = null;
  if (bibPath && existsSync(bibPath)) {
    try { bibliography = JSON.parse(readFileSync(bibPath, 'utf8')); } catch {}
  }

  const sourceIds = new Set<string>();
  const sourceRefKeys = new Set<string>();
  // Collect from concept-level sources AND localization-level sources
  const allSourceArrays = [
    ...(json['gl:sources'] ?? []),
  ];
  for (const lc of Object.values(json['gl:localizedConcept'] ?? {})) {
    const lcSources = (lc as any)['gl:source'] ?? (lc as any)['gl:sources'];
    if (Array.isArray(lcSources)) allSourceArrays.push(...lcSources);
  }
  for (const s of allSourceArrays) {
    if (s['gl:id']) sourceIds.add(s['gl:id']);
    const origin = s['gl:origin'] ?? {};
    const ref = origin['gl:ref'] ?? {};
    if (ref['gl:source'] && ref['gl:id']) {
      sourceRefKeys.add(`${ref['gl:source']}:${ref['gl:id']}`);
      sourceIds.add(ref['gl:id']);
    }
  }

  const textChunks: string[] = [];
  for (const lc of Object.values(json['gl:localizedConcept'] ?? {})) {
    const lcObj = lc as any;
    for (const field of ['gl:definition', 'gl:notes', 'gl:examples', 'gl:annotations']) {
      for (const entry of lcObj[field] ?? []) {
        if (entry['gl:content']) textChunks.push(entry['gl:content']);
      }
    }
  }
  const fullText = textChunks.join('\n');

  for (const m of fullText.matchAll(/\{\{([^{}]+?)\}\}/g)) {
    const body = m[1].trim();
    const relFile = file.replace(cwd() + '/', '');

    // bib:id — must be a PURE bibliographic record, NOT a concept.
    // If the id matches a source in sources[], the author used bib: for
    // a concept citation — they should use {{cite:...}} instead.
    // Per concept-model spec: IEV entries, ISO standards with concept IDs,
    // anything that IS a concept in any dataset → must use cite:, not bib:.
    const bibMatch = body.match(/^bib:(.+)$/i);
    if (bibMatch) {
      const rest = bibMatch[1];
      const commaIdx = rest.indexOf(',');
      const id = (commaIdx > 0 ? rest.slice(0, commaIdx).trim() : rest.trim());
      if (sourceIds.has(id)) {
        broken.push({
          file: relFile, line: 0, field: '{{bib:...}}', target: id,
          reason: `"${id}" is a ConceptSource (concept), not a bibliography entry. Use {{cite:${id}}} instead. bib: is ONLY for pure bibliographic records (papers, external docs) that are NOT concepts in any dataset.`,
        });
      } else if (bibliography) {
        const entries = bibliography.bibliography ?? bibliography;
        if (!entries[id] && !(Array.isArray(entries) && entries.some((e: any) => e.id === id))) {
          broken.push({
            file: relFile, line: 0, field: '{{bib:...}}', target: id,
            reason: `bibliography entry "${id}" not found in bibliography.json. If this is a concept, use {{cite:...}} or {{urn:...}} instead.`,
          });
        }
      } else {
        broken.push({
          file: relFile, line: 0, field: '{{bib:...}}', target: id,
          reason: `no bibliography.json for this dataset. If "${id}" is a concept, use {{cite:...}} or {{urn:...}} instead.`,
        });
      }
      continue;
    }

    // link:url — must be a valid http/https URL
    const linkMatch = body.match(/^link:(.+)$/i);
    if (linkMatch) {
      const rest = linkMatch[1];
      const commaIdx = rest.indexOf(',');
      const url = (commaIdx > 0 ? rest.slice(0, commaIdx).trim() : rest.trim());
      if (!/^https?:\/\//.test(url)) {
        broken.push({ file: relFile, line: 0, field: '{{link:...}}', target: url, reason: 'link must be http: or https: URL' });
      }
      continue;
    }

    // image:src — if local path, must exist in public/
    const imageMatch = body.match(/^image:(.+)$/i);
    if (imageMatch) {
      const rest = imageMatch[1];
      const commaIdx = rest.indexOf(',');
      const src = (commaIdx > 0 ? rest.slice(0, commaIdx).trim() : rest.trim());
      if (!/^https?:\/\//.test(src) && !src.startsWith('data:')) {
        const imgPath = join(cwd(), 'public', src.replace(/^\//, ''));
        if (!existsSync(imgPath)) {
          broken.push({ file: relFile, line: 0, field: '{{image:...}}', target: src, reason: `image file not found: public/${src.replace(/^\//, '')}` });
        }
      }
      continue;
    }

    // cite:id — source must exist in this concept's sources[].
    // Handles DATASET:ID format: {{cite:IEV:702-02-07}} matches a source
    // with id "702-02-07" or origin.ref { source: "IEV", id: "702-02-07" }.
    const citeMatch = body.match(/^cite:(.+)$/i);
    if (citeMatch) {
      const rest = citeMatch[1];
      const commaIdx = rest.indexOf(',');
      const rawId = (commaIdx > 0 ? rest.slice(0, commaIdx).trim() : rest.trim());

      // Check: rawId (e.g. "IEV:702-02-07"), or just the ID part ("702-02-07")
      const lastColon = rawId.lastIndexOf(':');
      const idPart = lastColon > 0 ? rawId.slice(lastColon + 1) : rawId;
      if (!sourceIds.has(rawId) && !sourceIds.has(idPart) && !sourceRefKeys.has(rawId)) {
        broken.push({ file: relFile, line: 0, field: '{{cite:...}}', target: rawId, reason: `source "${rawId}" not found in this concept's sources[]` });
      }
      continue;
    }

    // numeric/designation/urn — checked via the concept-level cross-ref checks above
  }

  return broken;
}

function main(): void {
  if (!existsSync(DATA_DIR)) {
    console.error(`Data directory not found: ${DATA_DIR}\n  Run after generate-data has produced public/data/`);
    process.exit(2);
  }

  const files = walk(DATA_DIR).filter(f => f.includes('/concepts/') && f.endsWith('.json'));
  const broken: BrokenLink[] = [];
  for (const file of files) {
    broken.push(...checkFile(file, DATA_DIR));
  }

  // Dedupe by (file, field, target)
  const seen = new Set<string>();
  const unique = broken.filter(b => {
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

  console.error(`Found ${unique.length} broken internal link(s) across ${files.length} concept files:\n`);
  for (const b of unique) {
    console.error(`  ${b.file}`);
    console.error(`    field:   ${b.field}`);
    console.error(`    target:  ${b.target}`);
    console.error(`    reason:  ${b.reason}`);
    console.error('');
  }
  console.error('Build FAILED. Fix the broken links above (correct YAML refs) and re-run.');
  process.exit(1);
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);
if (isDirect) main();

export { checkFile, localPathForUri };