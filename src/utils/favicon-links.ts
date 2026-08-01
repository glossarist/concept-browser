/**
 * Favicon link-tag builder — shared SSOT for the `<link rel="icon">`
 * block emitted in `<head>`.
 *
 * Used by:
 *   - `src/layouts/Default.astro` (build-time SSG)
 *
 * Why this exists: a deployment at `/cie-eilv/` has its favicon files
 * at `/cie-eilv/favicon.ico`, NOT `/favicon.ico`. Hardcoding `/` as
 * the URL prefix (which 0.7.106 did) caused 404s on every sub-path
 * deployment. This builder walks the configuration cascade via
 * `resolveFaviconBase` and emits correctly-prefixed link tags.
 */

import { resolveFaviconBase } from './favicon-base';

export interface FaviconLinkTag {
  rel: string;
  type?: string;
  sizes?: string;
  href: string;
}

/** Default favicon file set emitted by the CLI's `favicons` pipeline. */
const DEFAULT_FAVICON_FILES: readonly FaviconLinkTag[] = [
  { rel: 'icon',       type: 'image/x-icon',  href: 'favicon.ico' },
  { rel: 'icon',       type: 'image/svg+xml', href: 'favicon.svg' },
  { rel: 'icon',       type: 'image/png',     sizes: '16x16',  href: 'favicon-16x16.png' },
  { rel: 'icon',       type: 'image/png',     sizes: '32x32',  href: 'favicon-32x32.png' },
  { rel: 'icon',       type: 'image/png',     sizes: '48x48',  href: 'favicon-48x48.png' },
  { rel: 'apple-touch-icon', sizes: '57x57',  href: 'apple-touch-icon-57x57.png' },
  { rel: 'apple-touch-icon', sizes: '60x60',  href: 'apple-touch-icon-60x60.png' },
  { rel: 'apple-touch-icon', sizes: '72x72',  href: 'apple-touch-icon-72x72.png' },
  { rel: 'apple-touch-icon', sizes: '76x76',  href: 'apple-touch-icon-76x76.png' },
  { rel: 'apple-touch-icon', sizes: '114x114',href: 'apple-touch-icon-114x114.png' },
  { rel: 'apple-touch-icon', sizes: '120x120',href: 'apple-touch-icon-120x120.png' },
  { rel: 'apple-touch-icon', sizes: '144x144',href: 'apple-touch-icon-144x144.png' },
  { rel: 'apple-touch-icon', sizes: '152x152',href: 'apple-touch-icon-152x152.png' },
  { rel: 'apple-touch-icon', sizes: '167x167',href: 'apple-touch-icon-167x167.png' },
  { rel: 'apple-touch-icon', sizes: '180x180',href: 'apple-touch-icon-180x180.png' },
  { rel: 'apple-touch-icon', sizes: '1024x1024',href: 'apple-touch-icon-1024x1024.png' },
];

export interface BuildFaviconLinksInput {
  /** Explicit consumer override via `branding.favicon.base_path`. */
  brandingFaviconBasePath?: string;
  /** Consumer's declared sub-path via `site-config.yml:basePath`. */
  siteConfigBasePath?: string;
  /** Build-time BASE_PATH from Astro/Vite (`import.meta.env.BASE_URL`). */
  astroBaseUrl?: string;
}

/**
 * Build the list of default favicon link tags with BASE_PATH-aware URLs.
 *
 * Returns the tag descriptors; the caller (Default.astro) renders them
 * into <link> elements.
 */
export function buildDefaultFaviconLinks(input: BuildFaviconLinksInput): FaviconLinkTag[] {
  const base = resolveFaviconBase(input);
  return DEFAULT_FAVICON_FILES.map(tag => ({
    ...tag,
    href: `${base}${tag.href}`,
  }));
}

/**
 * Render a single FaviconLinkTag to an HTML <link> string.
 *
 * Attribute order: rel, type (if present), sizes (if present), href.
 * Deterministic for snapshot testing.
 */
export function renderFaviconLinkTag(tag: FaviconLinkTag): string {
  const attrs: string[] = [`rel="${tag.rel}"`];
  if (tag.type) attrs.push(`type="${tag.type}"`);
  if (tag.sizes) attrs.push(`sizes="${tag.sizes}"`);
  attrs.push(`href="${tag.href}"`);
  return `<link ${attrs.join(' ')} />`;
}
