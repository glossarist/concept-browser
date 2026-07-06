#!/usr/bin/env node
// About page compiler — processes markdown/AsciiDoc about pages for
// datasets and groups into the public/pages/*.json format consumed
// by PageView.vue.
//
// Source layout:
//   .datasets/<id>/about/about.{lang}.adoc   → dataset about
//   .datasets/<id>/about/about.{lang}.md     → dataset about
//   site-content/groups/<id>/about/about.{lang}.adoc → group about
//
// Output:
//   public/pages/dataset-<id>-about.{lang}.json
//   public/pages/group-<id>-about.{lang}.json
//
// Output shape: { title: string, html: string }

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync, realpathSync } from 'node:fs';
import { join, basename, extname, resolve } from 'node:path';
import { cwd } from 'node:process';
import { fileURLToPath } from 'node:url';

import { loadSiteConfig } from './load-site-config.mjs';

export function loadSiteConfigForAbout() {
  try {
    const { config } = loadSiteConfig([]);
    return config;
  } catch {
    return null;
  }
}

// Resolve roots at call time, not at module load — supports test
// environments that chdir between module import and main() call.
export function roots() {
  const ROOT = cwd();
  return {
    ROOT,
    PUBLIC_PAGES: join(ROOT, 'public', 'pages'),
    DATASETS_DIR: join(ROOT, '.datasets'),
    GROUPS_CONTENT_DIR: join(ROOT, 'site-content', 'groups'),
  };
}

export function renderMarkdown(text) {
  // Minimal markdown → HTML. For production, use a real parser.
  // This handles headings, paragraphs, bold, italic, links, lists.
  const lines = text.split('\n');
  const html = [];
  let inList = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (inList) { html.push('</ul>'); inList = false; }
      continue;
    }
    if (/^#{1}\s/.test(trimmed)) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h1>${inline(trimmed.replace(/^#\s/, ''))}</h1>`);
    } else if (/^#{2}\s/.test(trimmed)) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h2>${inline(trimmed.replace(/^##\s/, ''))}</h2>`);
    } else if (/^#{3}\s/.test(trimmed)) {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<h3>${inline(trimmed.replace(/^###\s/, ''))}</h3>`);
    } else if (/^[-*]\s/.test(trimmed)) {
      if (!inList) { html.push('<ul>'); inList = true; }
      html.push(`<li>${inline(trimmed.replace(/^[-*]\s/, ''))}</li>`);
    } else {
      if (inList) { html.push('</ul>'); inList = false; }
      html.push(`<p>${inline(trimmed)}</p>`);
    }
  }
  if (inList) html.push('</ul>');
  return html.join('\n');
}

function inline(text) {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/`(.+?)`/g, '<code>$1</code>');
}

export function processAboutDir(sourceDir, outputPrefix, publicPagesDir) {
  if (!existsSync(sourceDir)) return 0;
  let count = 0;

  for (const file of readdirSync(sourceDir)) {
    const fullPath = join(sourceDir, file);
    if (!statSync(fullPath).isFile()) continue;

    const ext = extname(file);
    if (ext !== '.md' && ext !== '.adoc' && ext !== '.html') continue;

    // Parse filename: about.{lang}.md or about.md
    const base = basename(file, ext);
    const langMatch = base.match(/^about\.(\w+)$/);
    const lang = langMatch ? langMatch[1] : 'eng';
    const outputName = lang === 'eng'
      ? `${outputPrefix}.json`
      : `${outputPrefix}.${lang}.json`;

    const raw = readFileSync(fullPath, 'utf8');
    let html;
    let title;

    if (ext === '.html') {
      html = raw;
      const titleMatch = raw.match(/<h1[^>]*>(.+?)<\/h1>/);
      title = titleMatch ? titleMatch[1] : 'About';
    } else if (ext === '.md') {
      html = renderMarkdown(raw);
      const titleMatch = raw.match(/^#\s+(.+)$/m);
      title = titleMatch ? titleMatch[1] : 'About';
    } else {
      // AsciiDoc — treat as plain text for now (production: use asciidoctor.js)
      html = `<p>${raw.split('\n').filter(l => l.trim() && !l.startsWith('=')).join('</p>\n<p>')}</p>`;
      const titleMatch = raw.match(/^=\s+(.+)$/m);
      title = titleMatch ? titleMatch[1] : 'About';
    }

    const output = { title, html };
    mkdirSync(publicPagesDir, { recursive: true });
    writeFileSync(join(publicPagesDir, outputName), JSON.stringify(output));
    count++;
    console.log(`  Compiled: ${file} → public/pages/${outputName}`);
  }

  return count;
}

export function main() {
  const { ROOT, PUBLIC_PAGES, DATASETS_DIR, GROUPS_CONTENT_DIR } = roots();
  mkdirSync(PUBLIC_PAGES, { recursive: true });
  let total = 0;

  // Dataset about pages — discover from .datasets/<id>/about/ (fetched
  // or copied) OR from site-config localPath overrides for datasets that
  // aren't materialized under .datasets/.
  const siteConfig = loadSiteConfigForAbout();
  const localPathMap = new Map();
  for (const ds of siteConfig?.datasets || []) {
    if (ds.id && ds.localPath) {
      localPathMap.set(ds.id, resolve(ROOT, ds.localPath));
    }
  }

  const seenIds = new Set();
  if (existsSync(DATASETS_DIR)) {
    for (const dsId of readdirSync(DATASETS_DIR)) {
      seenIds.add(dsId);
      const aboutDir = join(DATASETS_DIR, dsId, 'about');
      if (existsSync(aboutDir) && statSync(aboutDir).isDirectory()) {
        console.log(`Processing dataset: ${dsId}`);
        total += processAboutDir(aboutDir, `dataset-${dsId}-about`, PUBLIC_PAGES);
      }
    }
  }
  for (const [dsId, dsPath] of localPathMap) {
    if (seenIds.has(dsId)) continue;
    const aboutDir = join(dsPath, 'about');
    if (existsSync(aboutDir) && statSync(aboutDir).isDirectory()) {
      console.log(`Processing dataset (localPath): ${dsId}`);
      total += processAboutDir(aboutDir, `dataset-${dsId}-about`, PUBLIC_PAGES);
    }
  }

  // Group about pages
  if (existsSync(GROUPS_CONTENT_DIR)) {
    for (const groupId of readdirSync(GROUPS_CONTENT_DIR)) {
      const aboutDir = join(GROUPS_CONTENT_DIR, groupId, 'about');
      if (existsSync(aboutDir) && statSync(aboutDir).isDirectory()) {
        console.log(`Processing group: ${groupId}`);
        total += processAboutDir(aboutDir, `group-${groupId}-about`, PUBLIC_PAGES);
      }
    }
  }

  console.log(total > 0 ? `\nCompiled ${total} about page(s).` : '\nNo about pages found.');
}

// realpathSync dereferences symlinks and monorepo hoists so the
// comparison is stable across npx, symlinked binaries, and workspace
// installs. Without this, `process.argv[1]` may string-differ from
// `import.meta.url` even when they point to the same file.
const isDirectInvocation = process.argv[1]
  && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url));
if (isDirectInvocation) {
  main();
}
