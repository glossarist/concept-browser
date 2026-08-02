#!/usr/bin/env node

/**
 * Glossarist Concept Browser CLI — runtime entrypoint.
 *
 * Registers tsx as the ESM loader so dynamic imports of .ts scripts
 * work at runtime. tsx is a regular dependency (not devDep), so it
 * survives --omit=dev.
 */

import { register } from 'node:module';
register('tsx/esm', import.meta.url);

import { loadSiteConfig } from '../scripts/load-site-config.ts';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');

const commands = {
  fetch:    async () => (await import('../scripts/fetch-datasets.ts')).main(),
  generate: async () => { await import('../scripts/generate-data.ts'); },
  edges:    async () => (await import('../scripts/build-edges.ts')).main(),
  about:    async () => (await import('../scripts/process-about-pages.ts')).main(),
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

    // Favicon resolution (issue #173).
    //
    // `branding.favicon` accepts two shapes:
    //
    //   1. String (legacy) — path to a single source SVG/PNG. The `favicons`
    //      package generates the full variant set from it.
    //
    //   2. Object — `{ source_dir?, links_html?, skip_default_links?, base_path? }`.
    //      - `icons`: DATA — array of { rel, href, type?, sizes? } entries.
    //        The hrefs are filenames; the CLI applies BASE_PATH and renders
    //        well-formed <link> tags. Recommended over `links_html`.
    //      - `links_html` (deprecated): raw HTML emitted verbatim.
    //        Skips the `favicons` package entirely; impossible to validate
    //        or safely BASE_PATH-rewrite. Use `icons` instead.
    //      - `source_dir`: directory of canonical favicon files copied as-is
    //        into public/ (overriding any defaults). Useful when the consumer
    //        already has a RealFaviconGenerator output set.
    //      - `skip_default_links`: don't emit the default <link> block at all.
    //      - `base_path`: URL prefix for the emitted links (BASE_PATH-aware).
    const faviconCfg = branding.favicon;
    const faviconCfgIsObject =
      faviconCfg !== null && typeof faviconCfg === 'object' && !Array.isArray(faviconCfg);

    // Defensive field access: loadSiteConfig normalizes snake_case YAML keys
    // to camelCase at load time, so `source_dir` arrives as `sourceDir`. But
    // the canonical FaviconConfig schema documents snake_case (matching the
    // YAML wire format), and Astro's getSiteConfig path does NOT normalize.
    // Accept both forms so a future change to either loader can't break this.
    // See src/utils/favicon-config-access.ts for the SSOT + tests.
    const cfgBasePath       = faviconCfgIsObject ? (faviconCfg.basePath ?? faviconCfg.base_path) : undefined;
    const cfgSkipDefault    = faviconCfgIsObject ? (faviconCfg.skipDefaultLinks ?? faviconCfg.skip_default_links) === true : false;
    const cfgLinksHtml      = faviconCfgIsObject ? (faviconCfg.linksHtml ?? faviconCfg.links_html) : undefined;
    const cfgSourceDir      = faviconCfgIsObject ? (faviconCfg.sourceDir ?? faviconCfg.source_dir) : undefined;
    const cfgIcons          = faviconCfgIsObject ? faviconCfg.icons : undefined;

    let faviconHtml = '';
    let skipDefaultGeneration = false;

    if (faviconCfgIsObject) {
      // Object form — honor each declared field.
      if (cfgIcons && Array.isArray(cfgIcons) && cfgIcons.length > 0) {
        // Data-driven: build <link> tags from the icons array.
        const basePathForIcons =
          cfgBasePath ||
          process.env.BASE_PATH?.replace(/\/+$/, '') ||
          '';
        faviconHtml = cfgIcons.map((icon) => {
          const attrs = [`rel="${icon.rel || 'icon'}"`];
          if (icon.type) attrs.push(`type="${icon.type}"`);
          if (icon.sizes) attrs.push(`sizes="${icon.sizes}"`);
          // Bare filenames get BASE_PATH-prefixed; absolute URLs / root-relative
          // paths are emitted as-is.
          let href = icon.href || '';
          if (href && !/^[a-z][a-z0-9+.-]*:/i.test(href) && !href.startsWith('//') && !href.startsWith('/')) {
            href = basePathForIcons ? `${basePathForIcons}/${href}` : `/${href}`;
          }
          attrs.push(`href="${href}"`);
          return `<link ${attrs.join(' ')} />`;
        }).join('\n    ');
        skipDefaultGeneration = true;
      }
      if (cfgLinksHtml) {
        if (faviconHtml) {
          console.warn('  Warning: branding.favicon.icons and links_html are both set; using icons (data form).');
        } else {
          console.warn('  Warning: branding.favicon.links_html is deprecated. Use branding.favicon.icons (data) instead.');
          faviconHtml = String(cfgLinksHtml);
        }
        skipDefaultGeneration = true;
      }
      if (cfgSourceDir) {
        const srcDir = resolve(process.cwd(), cfgSourceDir);
        if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
          console.log(`\n=== FAVICONS (copy from ${cfgSourceDir}) ===\n`);
          // When the consumer provides a canonical favicon set, also delete
          // the default-generated cruft (apple-touch-icon-*.png, etc.) so
          // it doesn't linger in public/ and pollute the deployment.
          // Mirrors glossarist/iala-vocab/scripts/install-favicons.mjs.
          const cruftFiles = [
            'apple-touch-icon-57x57.png',
            'apple-touch-icon-60x60.png',
            'apple-touch-icon-72x72.png',
            'apple-touch-icon-76x76.png',
            'apple-touch-icon-114x114.png',
            'apple-touch-icon-120x120.png',
            'apple-touch-icon-144x144.png',
            'apple-touch-icon-152x152.png',
            'apple-touch-icon-167x167.png',
            'apple-touch-icon-180x180.png',
            'apple-touch-icon-1024x1024.png',
            'apple-touch-icon-precomposed.png',
            'favicon-16x16.png',
            'favicon-32x32.png',
            'favicon-48x48.png',
            'browserconfig.xml',
          ];
          let removed = 0;
          for (const cruft of cruftFiles) {
            const cruftPath = resolve(publicDir, cruft);
            if (fs.existsSync(cruftPath)) {
              fs.unlinkSync(cruftPath);
              removed++;
            }
          }
          if (removed > 0) console.log(`  Removed ${removed} default cruft file(s)`);

          let copied = 0;
          for (const entry of fs.readdirSync(srcDir)) {
            const fromPath = resolve(srcDir, entry);
            if (fs.statSync(fromPath).isFile()) {
              fs.copyFileSync(fromPath, resolve(publicDir, entry));
              copied++;
            }
          }
          console.log(`  Copied ${copied} canonical favicon file(s) from ${cfgSourceDir}`);
        } else {
          console.warn(`  Warning: branding.favicon.source_dir not found: ${srcDir}`);
        }
      }
      if (cfgSkipDefault) {
        skipDefaultGeneration = true;
      }
    }

    if (!skipDefaultGeneration) {
      // Legacy / default path — derive a single source file and let the
      // `favicons` package generate the full variant set.
      const faviconSrc =
        (typeof faviconCfg === 'string' && faviconCfg && resolve(process.cwd(), faviconCfg)) ||
        (branding.logo?.localPath && resolve(process.cwd(), branding.logo.localPath)) ||
        resolve(pkgRoot, 'public', 'favicon.svg');

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

        // Only use the generated HTML if the consumer didn't supply their own.
        if (!faviconHtml) {
          faviconHtml = response.html.join('\n    ');
          if (faviconSrc.endsWith('.svg')) {
            faviconHtml += '\n    <link rel="icon" type="image/svg+xml" href="/favicon.svg">';
          }
        }
        console.log(`  Generated ${response.images.length} favicon files`);
      }
    }

    if (faviconHtml) {
      fs.writeFileSync(resolve(publicDir, 'favicon-links.html'), faviconHtml);
      // Apply base_path prefix (issue #173 + BASE_PATH-aware deployments).
      const basePath =
        cfgBasePath ||
        process.env.BASE_PATH?.replace(/\/+$/, '') ||
        '';
      if (basePath) {
        faviconHtml = faviconHtml.replace(
          /(href|content)="\/([^"]+)"/g,
          `$1="${basePath}/$2`,
        );
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
    const bridge = resolve(pkgRoot, 'scripts', 'bridge-to-astro.ts');
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

    const postbuild = resolve(pkgRoot, 'scripts', 'generate-404.ts');
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
    const { normalizeYaml } = await import('../scripts/normalize-yaml.ts');
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
    const { main: doctorMain } = await import('../scripts/doctor.ts');
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
