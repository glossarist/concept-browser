/**
 * Font stack builder — shared SSOT for `branding.fonts.*` fallback chains.
 *
 * Used by:
 *   - `src/layouts/Default.astro`     (build-time SSG CSS variables)
 *   - `src/config/use-site-config.ts` (runtime CSS variable overrides)
 *
 * Design principle: NO slot dictates a font category. The consumer picks
 * `serif`, `sans-serif`, or `monospace` for each slot independently. The
 * defaults below preserve the Glossarist visual identity (serif title +
 * serif heading + sans-serif body + monospace code) but every slot can
 * be overridden to any category.
 *
 * Slot semantics:
 *   - title   : single most-prominent display text on the page
 *               (home hero h1, concept name on detail page, group title)
 *   - heading : h2–h6 section headings
 *   - body    : paragraph text, lists, table cells
 *   - mono    : code blocks, inline code, kbd
 *
 * Backward compat:
 *   - `branding.fonts.header` is accepted as a deprecated alias for
 *     `branding.fonts.heading` (both write to `--font-heading`, which
 *     also surfaces as `--font-header` for legacy CSS).
 */

export type FontCategory = 'serif' | 'sans-serif' | 'monospace';

export interface FontConfigLike {
  family: string;
  category?: FontCategory;
}

const FALLBACKS: Readonly<Record<FontCategory, string>> = {
  serif: 'Georgia, serif',
  'sans-serif': 'system-ui, sans-serif',
  monospace: 'ui-monospace, "JetBrains Mono", Menlo, Monaco, monospace',
};

/**
 * Build a CSS font-family stack from a FontConfig-like object.
 *
 * - If `font` is null/undefined or has no family, returns `undefined`
 *   and the caller applies its slot-specific default.
 * - If `font.category` is omitted, falls back to `defaultCategory`
 *   so existing configs preserve prior behavior.
 */
export function fontStack(
  font: FontConfigLike | null | undefined,
  defaultCategory: FontCategory,
): string | undefined {
  if (!font?.family) return undefined;
  const category: FontCategory = font.category ?? defaultCategory;
  const fallback = FALLBACKS[category];
  return `'${font.family}', ${fallback}`;
}

/** Default font stacks (used when the consumer declares nothing).
 *  Preserves the Glossarist visual identity. NOT a dictate — every
 *  slot can be overridden to any category via branding.fonts.*. */
export const DEFAULT_FONTS = {
  title: `'DM Serif Display', ${FALLBACKS.serif}`,
  heading: `'DM Serif Display', ${FALLBACKS.serif}`,
  body: `'DM Sans', ${FALLBACKS['sans-serif']}`,
  mono: `'JetBrains Mono', ${FALLBACKS.monospace}`,
} as const;

/** Slot → default category, used when the consumer omits `category`.
 *  These defaults preserve prior behavior and are NOT a constraint —
 *  consumers can pick any category for any slot. */
export const DEFAULT_CATEGORY = {
  title: 'serif' as FontCategory,
  heading: 'serif' as FontCategory,
  body: 'sans-serif' as FontCategory,
  mono: 'monospace' as FontCategory,
} as const;

