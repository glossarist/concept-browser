/**
 * Defensive favicon config accessor.
 *
 * WHY THIS EXISTS
 *
 * `loadSiteConfig` (scripts/load-site-config.mjs) normalizes YAML keys
 * from snake_case to camelCase at load time. So a YAML config with
 * `branding.favicon.source_dir: assets/favicons` arrives at the CLI as
 * `cfg.sourceDir`. But the canonical `FaviconConfig` type documents the
 * snake_case form (matching the YAML wire format), and Astro's
 * `getSiteConfig` does NOT normalize — so `Default.astro` sees the raw
 * snake_case form.
 *
 * The 0.7.107–0.7.109 CLI used `cfg.source_dir` directly, which silently
 * returned `undefined` after the loader's normalization. Canonical files
 * never got copied. Regression caught by user 2026-08-01.
 *
 * The fix: this helper reads BOTH forms. Each accessor takes the config
 * object and returns whichever form is present. The class of "loader
 * changed normalization, broke the CLI" is now permanently closed.
 */

export interface RawFaviconConfig {
  // snake_case (YAML wire format / Astro path)
  base_path?: string;
  skip_default_links?: boolean;
  links_html?: string;
  source_dir?: string;
  icons?: unknown;
  // camelCase (loadSiteConfig normalized form / TS convention)
  basePath?: string;
  skipDefaultLinks?: boolean;
  linksHtml?: string;
  sourceDir?: string;
}

function pick<T>(...vals: Array<T | undefined>): T | undefined {
  for (const v of vals) {
    if (v !== undefined && v !== null) return v;
  }
  return undefined;
}

export function getFaviconBasePath(cfg: RawFaviconConfig | null | undefined): string | undefined {
  if (!cfg) return undefined;
  return pick(cfg.basePath, cfg.base_path);
}

export function getFaviconSkipDefaultLinks(cfg: RawFaviconConfig | null | undefined): boolean {
  if (!cfg) return false;
  return pick(cfg.skipDefaultLinks, cfg.skip_default_links) === true;
}

export function getFaviconLinksHtml(cfg: RawFaviconConfig | null | undefined): string | undefined {
  if (!cfg) return undefined;
  return pick(cfg.linksHtml, cfg.links_html);
}

export function getFaviconSourceDir(cfg: RawFaviconConfig | null | undefined): string | undefined {
  if (!cfg) return undefined;
  return pick(cfg.sourceDir, cfg.source_dir);
}

export function getFaviconIcons(cfg: RawFaviconConfig | null | undefined): unknown {
  if (!cfg) return undefined;
  // `icons` has no snake_case form — same key in both worlds.
  return cfg.icons;
}
