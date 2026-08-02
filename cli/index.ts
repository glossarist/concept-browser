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
 *   normalize  NFC-normalize YAML files in .datasets/ (use --check for CI gate)
 *   doctor     Diagnose the local environment (deps, datasets, shapes, context)
 *
 * Options:
 *   --site <id>  Site config to use (looks for site-config.yml in CWD)
 *
 * Environment:
 *   SITE_CONFIG          Path to site config file (overrides --site)
 *   SITE_ID              Site config ID (overrides --site)
 *   GITHUB_TOKEN         GitHub token for private repos
 */

import { loadSiteConfig } from '../scripts/load-site-config';
import { existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname: string = dirname(fileURLToPath(import.meta.url));
const pkgRoot: string = resolve(__dirname, '..');

interface ParsedArgs {
  positional: string[];
  named: Record<string, string>;
}

type CommandRunner = () => Promise<void>;

const commands: Record<string, CommandRunner> = {
  fetch:        async () => (await import('../scripts/fetch-datasets')).main(),
  generate:     async () => { await import('../scripts/generate-data'); },
  edges:        async () => (await import('../scripts/build-edges')).main(),
  about:        async () => (await import('../scripts/process-about-pages')).main(),
  'validate-yaml': async () => { await import('../scripts/validate-yaml'); },
};

function parseArgs(argv: readonly string[]): ParsedArgs {
  const positional: string[] = [];
  const named: Record<string, string> = {};
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

interface BrandingFonts {
  source?: string;
  family?: string;
  weights?: number[];
}

interface FaviconIcon {
  rel?: string;
  href: string;
  type?: string;
  sizes?: string;
}

interface FaviconConfig {
  /** Path prefix for all favicon URLs. Accepts both forms because
   *  loadSiteConfig normalizes snake_case → camelCase at load time. */
  base_path?: string;
  basePath?: string;
  /** Skip emitting the default <link> block. */
  skip_default_links?: boolean;
  skipDefaultLinks?: boolean;
  /** Consumer-declared icons (DATA, not HTML). */
  icons?: FaviconIcon[];
  /** @deprecated Use `icons` instead. */
  links_html?: string;
  linksHtml?: string;
  /** Consumer-side directory of canonical favicon files. */
  source_dir?: string;
  sourceDir?: string;
}

interface BrandingConfig {
  /** Either a string (legacy: path to a source SVG/PNG) or an object form
   *  with `source_dir`, `links_html`, `skip_default_links`, `base_path`. */
  favicon?: string | FaviconConfig;
  logo?: { localPath?: string };
  primaryColor?: string;
  fonts?: { header?: BrandingFonts; body?: BrandingFonts };
}

interface SiteConfig {
  basePath?: string;
  title?: string;
  branding?: BrandingConfig;
}

interface FaviconResponse {
  images: Array<{ name: string; contents: string | Buffer }>;
  files: Array<{ name: string; contents: string | Buffer }>;
  html: string[];
}

async function runBuildPipeline(config: SiteConfig | null): Promise<void> {
  if (!process.env.BASE_PATH && config?.basePath) {
    process.env.BASE_PATH = config.basePath;
  }
  for (const step of ['fetch', 'generate', 'edges', 'about'] as const) {
    console.log(`\n=== ${step.toUpperCase()} ===\n`);
    await commands[step]();
  }

  const fs = await import('fs');
  const publicDir: string = resolve(process.cwd(), 'public');
  fs.mkdirSync(publicDir, { recursive: true });

  const branding: BrandingConfig = config?.branding ?? {};

  // Favicon resolution (issue #173, #177).
  // `branding.favicon` accepts two shapes:
  //   1. String (legacy) — path to a single source SVG/PNG.
  //   2. Object — `{ source_dir?, links_html?, skip_default_links?, base_path? }`.
  const faviconCfg: string | FaviconConfig | undefined = branding.favicon;
  const faviconCfgIsObject: boolean =
    faviconCfg !== null && typeof faviconCfg === 'object' && !Array.isArray(faviconCfg);
  const faviconCfgObject: FaviconConfig | undefined =
    faviconCfgIsObject ? (faviconCfg as FaviconConfig) : undefined;

  let faviconHtml = '';
  let skipDefaultGeneration = false;

  if (faviconCfgObject) {
    const cfg: FaviconConfig = faviconCfgObject;
    // Defensive field access: loadSiteConfig normalizes snake_case → camelCase
    // at load time. Accept both forms.
    const cfgBasePath: string | undefined    = cfg.basePath ?? cfg.base_path;
    const cfgSkipDefault: boolean            = (cfg.skipDefaultLinks ?? cfg.skip_default_links) === true;
    const cfgLinksHtml: string | undefined   = cfg.linksHtml ?? cfg.links_html;
    const cfgSourceDir: string | undefined   = cfg.sourceDir ?? cfg.source_dir;
    const cfgIcons: FaviconIcon[] | undefined = cfg.icons;

    if (cfgIcons && cfgIcons.length > 0) {
      // Data-driven: build <link> tags from the icons array.
      const basePathForIcons: string =
        cfgBasePath ||
        process.env.BASE_PATH?.replace(/\/+$/, '') ||
        '';
      faviconHtml = cfgIcons.map((icon: FaviconIcon): string => {
        const attrs: string[] = [`rel="${icon.rel || 'icon'}"`];
        if (icon.type) attrs.push(`type="${icon.type}"`);
        if (icon.sizes) attrs.push(`sizes="${icon.sizes}"`);
        let href: string = icon.href || '';
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
      const srcDir: string = resolve(process.cwd(), cfgSourceDir);
      if (fs.existsSync(srcDir) && fs.statSync(srcDir).isDirectory()) {
        console.log(`\n=== FAVICONS (copy from ${cfgSourceDir}) ===\n`);
        // When the consumer provides a canonical favicon set, also delete
        // the default-generated cruft so it doesn't linger in public/.
        const cruftFiles: readonly string[] = [
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
          const cruftPath: string = resolve(publicDir, cruft);
          if (fs.existsSync(cruftPath)) {
            fs.unlinkSync(cruftPath);
            removed++;
          }
        }
        if (removed > 0) console.log(`  Removed ${removed} default cruft file(s)`);

        let copied = 0;
        for (const entry of fs.readdirSync(srcDir)) {
          const fromPath: string = resolve(srcDir, entry);
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
    const faviconSrc: string =
      (typeof faviconCfg === 'string' && faviconCfg && resolve(process.cwd(), faviconCfg)) ||
      (branding.logo?.localPath && resolve(process.cwd(), branding.logo.localPath)) ||
      resolve(pkgRoot, 'public', 'favicon.svg');

    if (fs.existsSync(faviconSrc)) {
      console.log(`\n=== FAVICONS ===\n`);
      const favicons = (await import('favicons')).default;
      const source: Buffer = fs.readFileSync(faviconSrc);
      const response: FaviconResponse = await favicons(source, {
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
    const basePath: string =
      (faviconCfgObject ? (faviconCfgObject.basePath ?? faviconCfgObject.base_path) : undefined) ||
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
    const fontFamilies: string[] = [];
    if (branding.fonts.header?.source === 'google') {
      const w: string = (branding.fonts.header.weights || [400, 700]).join(';');
      fontFamilies.push(`family=${branding.fonts.header.family!.replace(/ /g, '+')}:wght@${w}`);
    }
    if (branding.fonts.body?.source === 'google') {
      const w: string = (branding.fonts.body.weights || [400, 700]).join(';');
      fontFamilies.push(`family=${branding.fonts.body.family!.replace(/ /g, '+')}:wght@${w}`);
    }
    if (fontFamilies.length) {
      process.env.SITE_FONTS_URL = `https://fonts.googleapis.com/css2?${fontFamilies.join('&')}&display=swap`;
    }
  }

  console.log(`\n=== BRIDGE DATA ===\n`);
  const bridge: string = resolve(pkgRoot, 'scripts', 'bridge-to-astro.ts');
  if (existsSync(bridge)) {
    await import(`file://${bridge}`);
  }

  console.log(`\n=== BUILD ASTRO ===\n`);
  const astroConfig: string = resolve(pkgRoot, 'astro.config.mjs');
  if (existsSync(astroConfig)) {
    try {
      const { build: astroBuild } = await import('astro');
      await astroBuild({ root: pkgRoot, logLevel: 'info' });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn(`  Astro build failed (${msg}), falling back to Vite SPA`);
      console.log(`\n=== BUILD SPA ===\n`);
      const viteConfig: string = resolve(pkgRoot, 'vite.config.ts');
      const { build: viteBuild } = await import('vite');
      await viteBuild({ configFile: viteConfig, root: pkgRoot, mode: 'production' });
    }
  } else {
    console.log(`\n=== BUILD SPA ===\n`);
    const viteConfig: string = resolve(pkgRoot, 'vite.config.ts');
    const { build: viteBuild } = await import('vite');
    await viteBuild({ configFile: viteConfig, root: pkgRoot, mode: 'production' });
  }

  const postbuild: string = resolve(pkgRoot, 'scripts', 'generate-404.js');
  if (existsSync(postbuild)) {
    await import(`file://${postbuild}`);
  }
}

async function runNormalize(): Promise<void> {
  const mod = await import('../scripts/normalize-yaml');
  const normalizeYaml = mod.normalizeYaml;
  const check: boolean = process.argv.includes('--check');
  const paths: string[] = process.argv.slice(2).filter(a => !a.startsWith('-') && a !== 'normalize');
  const { checked, nonNfc, fixed }: { checked: number; nonNfc: number; fixed: string[] } = normalizeYaml({ check, paths });
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
}

async function main(): Promise<void> {
  const args: readonly string[] = process.argv.slice(2);
  const { positional, named }: ParsedArgs = parseArgs(args);
  const cmd: string | undefined = positional[0];

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
  const { config }: { config: SiteConfig | null } = loadSiteConfig(named.site ? [named.site] : []);

  if (cmd === 'build' || cmd === 'site') {
    await runBuildPipeline(config);
    return;
  }

  const runner: CommandRunner | undefined = commands[cmd];
  if (runner) {
    await runner();
    return;
  }

  if (cmd === 'normalize') {
    await runNormalize();
    return;
  }

  if (cmd === 'doctor') {
    const mod = await import('../scripts/doctor');
    await mod.main();
    return;
  }

  console.error(`Unknown command: ${cmd}`);
  console.error('Run `concept-browser help` for usage.');
  process.exit(1);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
