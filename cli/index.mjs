#!/usr/bin/env node

/**
 * Glossarist Concept Browser CLI.
 *
 * Commands:
 *   fetch      Fetch/update datasets (from GCR packages or source repos)
 *   generate   Convert harmonized YAML concepts to JSON-LD static files
 *   edges      Build cross-reference edges from generated concept data
 *   build      Full pipeline: fetch + generate + edges + vite build
 *   site       Same as build (alias)
 *
 * Options:
 *   --site <id>  Site config to use (looks for site-config.yml in CWD)
 *
 * Environment:
 *   SITE_CONFIG          Path to site config file (overrides --site)
 *   SITE_ID              Site config ID (overrides --site)
 *   GITHUB_TOKEN         GitHub token for private repos
 */

import { loadSiteConfig } from '../scripts/load-site-config.mjs';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');

const commands = {
  fetch: () => import('../scripts/fetch-datasets.mjs'),
  generate: () => import('../scripts/generate-data.mjs'),
  edges: () => import('../scripts/build-edges.js'),
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
  build      Full pipeline (fetch + generate + edges + vite build)
  site       Same as build

Options:
  --site <id>  Site config ID (looks for site-config.yml in CWD)

Environment:
  SITE_CONFIG          Site config file path (highest priority)
  SITE_ID              Site config ID (same as --site)
  GITHUB_TOKEN         GitHub token for private repos`);
    process.exit(cmd ? 0 : 1);
  }

  // Pre-load site config so scripts can use it
  if (!process.env.SITE_CONFIG && !process.env.SITE_ID && named.site) {
    process.env.SITE_ID = named.site;
  }
  const { config } = loadSiteConfig(named.site ? [named.site] : []);

  if (cmd === 'build' || cmd === 'site') {
    if (!process.env.BASE_PATH && config?.basePath) {
      process.env.BASE_PATH = config.basePath;
    }
    for (const step of ['fetch', 'generate', 'edges']) {
      console.log(`\n=== ${step.toUpperCase()} ===\n`);
      await commands[step]();
    }

    // Generate favicons from site logo
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

      // Write all generated images and files to public/
      for (const img of response.images) {
        fs.writeFileSync(resolve(publicDir, img.name), img.contents);
      }
      for (const file of response.files) {
        fs.writeFileSync(resolve(publicDir, file.name), file.contents);
      }

      // Keep the original SVG for dark mode support
      if (faviconSrc.endsWith('.svg')) {
        fs.copyFileSync(faviconSrc, resolve(publicDir, 'favicon.svg'));
      }

      faviconHtml = response.html.join('\n    ');
      // Add SVG favicon
      if (faviconSrc.endsWith('.svg')) {
        faviconHtml += '\n    <link rel="icon" type="image/svg+xml" href="/favicon.svg">';
      }
      // Write tags for Vite plugin to pick up
      fs.writeFileSync(resolve(publicDir, 'favicon-links.html'), faviconHtml);
      console.log(`  Generated ${response.images.length} favicon files`);
    }

    // Pass favicon tags to Vite via env
    if (faviconHtml) {
      const basePath = process.env.BASE_PATH?.replace(/\/+$/, '') || '';
      if (basePath) {
        faviconHtml = faviconHtml.replace(/(href|content)="\/([^"]+)"/g, `$1="${basePath}/$2"`);
      }
      process.env.FAVICON_HTML = faviconHtml;
    }

    // Pass branding info for HTML transformation
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

    // Run vite build using the package's vite.config.ts via programmatic API
    console.log(`\n=== BUILD SPA ===\n`);
    const viteConfig = resolve(pkgRoot, 'vite.config.ts');
    const { build: viteBuild } = await import('vite');
    await viteBuild({
      configFile: viteConfig,
      root: pkgRoot,
      mode: 'production',
    });

    // Run postbuild (404 page) via dynamic import
    const postbuild = resolve(pkgRoot, 'scripts', 'generate-404.js');
    if (existsSync(postbuild)) {
      await import(`file://${postbuild}`);
    }

    return;
  }

  const runner = commands[cmd];
  if (!runner) {
    console.error(`Unknown command: ${cmd}`);
    console.error('Run `concept-browser help` for usage.');
    process.exit(1);
  }

  await runner();
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
