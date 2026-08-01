#!/usr/bin/env node

/**
 * Glossarist Concept Browser CLI — runtime entrypoint.
 *
 * This is the published bin entry. It stays as plain JS (no tsx dependency)
 * so consumers who install with --omit=dev can use it.
 *
 * The TypeScript version lives at cli/index.ts for type-checking during
 * development. The two files should be kept in sync manually until
 * TODO.typescript/03 adds a compile step.
 */

import { loadSiteConfig } from '../scripts/load-site-config.mjs';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');

const commands = {
  fetch:    async () => (await import('../scripts/fetch-datasets.mjs')).main(),
  generate: async () => { await import('../scripts/generate-data.mjs'); },
  edges:    async () => (await import('../scripts/build-edges.js')).main(),
  about:    async () => (await import('../scripts/process-about-pages.mjs')).main(),
};

function parseArgs(argv) {
  const positional = [];
  const named = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith('--') && i + 1 < argv.length) {
      named[argv[i].slice(2)] = argv[i + 1];
      i++;
    } else if (!argv[i].startsWith('-')) {
      positional.push(argv[i]);
    }
  }
  return { positional, named };
}

async function main() {
  const args = process.argv.slice(2);
  const { positional, named } = parseArgs(args);
  const cmd = positional[0];

  if (!cmd || cmd === 'help' || cmd === '--help') {
    console.log(`concept-browser <command> [options]

Commands:
  fetch      Fetch/update datasets from GCR packages or source repos
  generate   Convert YAML concepts to JSON-LD static data
  edges      Build cross-reference edges from generated concepts
  about      Compile per-dataset and per-group about pages
  build      Full pipeline (fetch + generate + edges + about + vite build)
  site       Same as build
  normalize  NFC-normalize YAML files in .datasets/
  doctor     Diagnose the local environment (deps, datasets, shapes, context)

Options:
  --site <id>  Site config ID (looks for site-config.yml in CWD)
  --check      (normalize only) Non-mutating; exit 1 if any file is not NFC

Environment:
  SITE_CONFIG          Site config file path (highest priority)
  SITE_ID              Site config ID (same as --site)
  GITHUB_TOKEN         GitHub token for private repos`);
    process.exit(cmd ? 0 : 1);
  }

  if (!process.env.SITE_CONFIG && !process.env.SITE_ID && named.site) {
    process.env.SITE_ID = named.site;
  }
  const { config } = loadSiteConfig(named.site ? [named.site] : []);

  if (cmd === 'build' || cmd === 'site') {
    if (!process.env.BASE_PATH && config?.basePath) {
      process.env.BASE_PATH = config.basePath;
    }
    for (const step of ['fetch', 'generate', 'edges', 'about']) {
      console.log(`\n=== ${step.toUpperCase()} ===\n`);
      await commands[step]();
    }

    const fs = await import('fs');
    const publicDir = resolve(process.cwd(), 'public');
    fs.mkdirSync(publicDir, { recursive: true });

    const branding = config?.branding || {};
    const faviconSrc =
      (branding.favicon && resolve(process.cwd(), branding.favicon)) ||
      (branding.logo?.localPath && resolve(process.cwd(), branding.logo.localPath)) ||
      resolve(pkgRoot, 'public', 'favicon.svg');

    let faviconHtml = '';
    if (fs.existsSync(faviconSrc)) {
      console.log(`\n=== FAVICONS ===\n`);
      const favicons = (await import('favicons')).default;
      const source = fs.readFileSync(faviconSrc);
      const response = await favicons(source, {
        appName: config?.title || 'Glossarist',
        background: branding.primaryColor || '#2563eb',
        theme_color: branding.primaryColor || '#2563eb',
        icons: {
          android: false,
          appleIcon: true,
          appleStartup: false,
          favicons: true,
          windows: false,
          yandex: false,
        },
      });

      for (const img of response.images) {
        fs.writeFileSync(resolve(publicDir, img.name), img.contents);
      }
      for (const file of response.files) {
        fs.writeFileSync(resolve(publicDir, file.name), file.contents);
      }

      if (faviconSrc.endsWith('.svg')) {
        fs.copyFileSync(faviconSrc, resolve(publicDir, 'favicon.svg'));
      }

      faviconHtml = response.html.join('\n    ');
      if (faviconSrc.endsWith('.svg')) {
        faviconHtml += '\n    <link rel="icon" type="image/svg+xml" href="/favicon.svg">';
      }
      fs.writeFileSync(resolve(publicDir, 'favicon-links.html'), faviconHtml);
      console.log(`  Generated ${response.images.length} favicon files`);
    }

    if (faviconHtml) {
      const basePath = process.env.BASE_PATH?.replace(/\/+$/, '') || '';
      if (basePath) {
        faviconHtml = faviconHtml.replace(/(href|content)="\/([^"]+)"/g, `$1="${basePath}/$2"`);
      }
      process.env.FAVICON_HTML = faviconHtml;
    }

    process.env.SITE_TITLE = config?.title || 'Glossarist';
    if (branding.fonts?.header || branding.fonts?.body) {
      const fontFamilies = [];
      if (branding.fonts.header?.source === 'google') {
        const w = (branding.fonts.header.weights || [400, 700]).join(';');
        fontFamilies.push(`family=${branding.fonts.header.family.replace(/ /g, '+')}:wght@${w}`);
      }
      if (branding.fonts.body?.source === 'google') {
        const w = (branding.fonts.body.weights || [400, 700]).join(';');
        fontFamilies.push(`family=${branding.fonts.body.family.replace(/ /g, '+')}:wght@${w}`);
      }
      if (fontFamilies.length) {
        process.env.SITE_FONTS_URL = `https://fonts.googleapis.com/css2?${fontFamilies.join('&')}&display=swap`;
      }
    }

    console.log(`\n=== BRIDGE DATA ===\n`);
    const bridge = resolve(pkgRoot, 'scripts', 'bridge-to-astro.mjs');
    if (existsSync(bridge)) {
      await import(`file://${bridge}`);
    }

    console.log(`\n=== BUILD ASTRO ===\n`);
    const astroConfig = resolve(pkgRoot, 'astro.config.mjs');
    if (existsSync(astroConfig)) {
      try {
        const { build: astroBuild } = await import('astro');
        await astroBuild({ root: pkgRoot, logLevel: 'info' });
      } catch (e) {
        console.warn(`  Astro build failed (${e.message}), falling back to Vite SPA`);
        console.log(`\n=== BUILD SPA ===\n`);
        const viteConfig = resolve(pkgRoot, 'vite.config.ts');
        const { build: viteBuild } = await import('vite');
        await viteBuild({ configFile: viteConfig, root: pkgRoot, mode: 'production' });
      }
    } else {
      console.log(`\n=== BUILD SPA ===\n`);
      const viteConfig = resolve(pkgRoot, 'vite.config.ts');
      const { build: viteBuild } = await import('vite');
      await viteBuild({ configFile: viteConfig, root: pkgRoot, mode: 'production' });
    }

    const postbuild = resolve(pkgRoot, 'scripts', 'generate-404.js');
    if (existsSync(postbuild)) {
      await import(`file://${postbuild}`);
    }

    return;
  }

  const runner = commands[cmd];
  if (runner) {
    await runner();
    return;
  }

  if (cmd === 'normalize') {
    const { normalizeYaml } = await import('../scripts/normalize-yaml.mjs');
    const check = process.argv.includes('--check');
    const paths = process.argv.slice(2).filter(a => !a.startsWith('-') && a !== 'normalize');
    const { checked, nonNfc, fixed } = normalizeYaml({ check, paths });
    if (check) {
      if (nonNfc === 0) {
        console.log(`NFC OK: ${checked} file(s) checked, all normalized`);
        return;
      }
      console.error(`NFC check failed: ${nonNfc} of ${checked} file(s) are not NFC-normalized\n`);
      for (const f of fixed) console.error(`  ${f}`);
      process.exit(1);
    }
    if (nonNfc === 0) {
      console.log(`NFC OK: ${checked} file(s) checked, all already normalized`);
    } else {
      console.log(`Normalized ${nonNfc} of ${checked} file(s)`);
      for (const f of fixed) console.log(`  ${f}`);
    }
    return;
  }

  if (cmd === 'doctor') {
    const { main: doctorMain } = await import('../scripts/doctor.mjs');
    await doctorMain();
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  console.error('Run `concept-browser help` for usage.');
  process.exit(1);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
