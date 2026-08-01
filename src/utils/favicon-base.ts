/**
 * Favicon base path resolver — shared SSOT for the URL prefix that
 * goes in front of every favicon `<link href="...">`.
 *
 * Used by:
 *   - `src/layouts/Default.astro`     (build-time SSG <link> emission)
 *   - `cli/index.mjs` / `cli/index.ts` (runtime <link> rewriting)
 *
 * Why this exists: a deployment at `/cie-eilv/` has its favicon files
 * at `/cie-eilv/favicon.ico`, NOT `/favicon.ico`. Hardcoding `/` as
 * the URL prefix (which 0.7.106 did) caused 404s on every sub-path
 * deployment. This resolver walks the configuration cascade to find
 * the right prefix.
 */

export interface FaviconBaseInput {
  /** Explicit consumer override via `branding.favicon.base_path`. */
  brandingFaviconBasePath?: string;
  /** Consumer's declared sub-path via `site-config.yml:basePath`. */
  siteConfigBasePath?: string;
  /** Build-time BASE_PATH from Astro/Vite (`import.meta.env.BASE_URL`). */
  astroBaseUrl?: string;
}

/**
 * Resolve the URL prefix for favicon links. Always returns a string
 * ending with `/` so callers can do `${base}favicon.ico` without
 * worrying about the separator.
 *
 * Cascade (first non-empty wins):
 *   1. branding.favicon.base_path (explicit per-deployment override)
 *   2. siteConfig.basePath        (consumer's declared sub-path)
 *   3. import.meta.env.BASE_URL   (build-time BASE_PATH)
 *   4. '/'                        (last resort — root deployment)
 */
export function resolveFaviconBase(input: FaviconBaseInput): string {
  const candidates = [
    input.brandingFaviconBasePath,
    input.siteConfigBasePath,
    input.astroBaseUrl,
    '/',
  ];
  const raw = candidates.find(c => c != null && c.length > 0) ?? '/';
  return raw.endsWith('/') ? raw : `${raw}/`;
}
