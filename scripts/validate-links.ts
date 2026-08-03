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
    if (!target) return;
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

  // gl:related entries (concept-level)
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