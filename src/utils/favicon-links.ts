/**
 * Favicon link-tag builder — shared SSOT for the `<link rel="icon">`
 * block emitted in `<head>`.
 *
 * Used by:
 *   - `src/layouts/Default.astro` (build-time SSG)
 *   - `cli/index.mjs`             (consumer-side favicon pipeline)
 *
 * Design principle: declare icons as DATA, not HTML. Consumers describe
 * their favicon set via `branding.favicon.icons: [{ rel, href, type?,
 * sizes? }]`. The href is a filename (or path relative to the deployment
 * root); the system applies the correct BASE_PATH prefix and renders
 * well-formed `<link>` tags. No raw HTML in YAML.
 *
 * Why data over HTML: HTML-in-YAML is impossible to validate, can't be
 * BASE_PATH-rewritten safely (regex on user-supplied markup is brittle),
 * and forces the consumer to know the exact attribute order/shape the
 * browser expects. Data lets us validate, normalize, and render.
 */

import { resolveFaviconBase } from './favicon-base';

export interface FaviconIcon {
  /** The `rel` attribute. Most common: "icon", "shortcut icon",
   *  "apple-touch-icon", "manifest". */
  rel: string;
  /** The icon file path. May be either:
   *  - A bare filename ("favicon.ico") — gets prefixed with the resolved
   *    base path automatically.
   *  - An absolute URL ("https://...") or root-relative path ("/x.png")
   *    — emitted as-is, no prefixing.
   */
  href: string;
  /** Optional MIME type hint. */
  type?: string;
  /** Optional `sizes` attribute (e.g., "180x180", "any"). */
  sizes?: string;
}

export interface FaviconLinkTag {
  rel: string;
  type?: string;
  sizes?: string;
  href: string;
}

/** Default favicon file set emitted by the CLI's `favicons` pipeline.
 *  Used when the consumer doesn't declare `branding.favicon.icons`. */
const DEFAULT_FAVICON_FILES: readonly FaviconIcon[] = [
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
  /** Consumer-declared icons. When set, replaces the default set. */
  icons?: readonly FaviconIcon[];
}

/**
 * Build the list of favicon link tags with BASE_PATH-aware URLs.
 *
 * - If `input.icons` is provided (non-empty), uses that set; otherwise
 *   falls back to the default 16-link set.
 * - For each icon, the href is normalized:
 *   - Filenames ("favicon.ico") → prefixed with the resolved base path.
 *   - Absolute URLs ("https://...") → emitted as-is.
 *   - Root-relative paths ("/x.png") → emitted as-is.
 */
export function buildFaviconLinks(input: BuildFaviconLinksInput): FaviconLinkTag[] {
  const base = resolveFaviconBase(input);
  const icons = input.icons && input.icons.length > 0 ? input.icons : DEFAULT_FAVICON_FILES;
  return icons.map(icon => ({
    rel: icon.rel,
    type: icon.type,
    sizes: icon.sizes,
    href: prefixHref(icon.href, base),
  }));
}

/** Back-compat alias — older name for the same operation. */
export const buildDefaultFaviconLinks = buildFaviconLinks;

/** Decide whether to prefix the href with the base path.
 *  Absolute URLs and root-relative paths are emitted as-is; bare filenames
 *  and relative paths are prefixed. */
function prefixHref(href: string, base: string): string {
  if (!href) return base;
  // Absolute URL: https://, http://, //, data:, etc.
  if (/^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//')) return href;
  // Root-relative: /anything
  if (href.startsWith('/')) return href;
  // Bare filename or relative path: prefix with base.
  return `${base}${href}`;
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
