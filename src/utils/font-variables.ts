/**
 * Single source of truth for branding-driven CSS font variables.
 *
 * WHY THIS EXISTS
 *
 * Pre-refactor (0.7.106–0.7.111), font variables came from FOUR places:
 *   1. `src/utils/font-stack.ts` (DEFAULT_FONTS)
 *   2. `src/styles/tailwind.css` `:root { ... }` block
 *   3. `src/styles/tailwind.css` `@theme { ... }` block (generated
 *      `:root, :host { ... }` in the CSS bundle)
 *   4. `tailwind.config.js` `fontFamily.*` utility fallback strings
 *
 * The @theme block was the load-bearing bug. Its `:root, :host { ... }`
 * declaration in the CSS bundle loaded AFTER `Default.astro`'s inline
 * `<style>`, so by CSS cascade (equal specificity, later source order
 * wins) the brand values were silently clobbered for `--font-serif`,
 * `--font-sans`, `--font-mono`.
 *
 * Post-refactor: this module is the ONLY place that decides which CSS
 * font variables exist and what their values are. Both
 * `Default.astro` (build-time SSG inline `<style>`) and
 * `use-site-config.ts` (runtime `root.style.setProperty` overrides)
 * call `buildFontVariables()` and emit the same shape.
 *
 * DESIGN
 *
 * Slot-named variables only. No category-named variables
 * (`--font-serif`, `--font-sans`) — those bake in "serif↔heading,
 * sans↔body" assumptions that break when a consumer picks a different
 * category for a slot. The Tailwind utilities `.font-serif` and
 * `.font-sans` are kept as backward-compat aliases defined in
 * `@layer base`, mapped to slot variables.
 *
 * Output keys:
 *   --font-title   — most prominent display text
 *   --font-heading — h2–h6 section headings
 *   --font-body    — paragraph text
 *   --font-mono    — code, pre, kbd
 */

import { fontStack, DEFAULT_FONTS, DEFAULT_CATEGORY, type FontConfigLike } from './font-stack';

/** Canonical slot names. Any CSS variable not in this list is a bug. */
export const FONT_SLOTS = ['title', 'heading', 'body', 'mono'] as const;
export type FontSlot = (typeof FONT_SLOTS)[number];

/** Branding fonts shape — accepts both `header` (legacy alias) and `heading`. */
export interface BrandingFontsLike {
  title?: FontConfigLike;
  heading?: FontConfigLike;
  /** @deprecated Legacy alias for `heading`. */
  header?: FontConfigLike;
  body?: FontConfigLike;
  mono?: FontConfigLike;
}

/**
 * Build the canonical `:root` CSS font-variable map from a branding
 * config. Every variable the system relies on is present in the output
 * — no need for fallback definitions elsewhere.
 *
 * Values are pre-formed CSS font-family stacks (e.g.
 * `'Raleway', system-ui, sans-serif`). The caller is responsible for
 * serializing into a CSS `:root { ... }` block.
 *
 * `header` (legacy alias) is read but not emitted as a separate
 * variable. Its value flows into `--font-heading`. Consumers that
 * still reference `--font-header` in their CSS get the heading value
 * via the alias declaration in `@layer base` of tailwind.css.
 */
export function buildFontVariables(
  fonts: BrandingFontsLike | null | undefined,
): Record<`--font-${FontSlot}`, string> {
  const f = fonts ?? {};
  const heading = f.heading ?? f.header;
  return {
    '--font-title': fontStack(f.title, DEFAULT_CATEGORY.title) ?? DEFAULT_FONTS.title,
    '--font-heading': fontStack(heading, DEFAULT_CATEGORY.heading) ?? DEFAULT_FONTS.heading,
    '--font-body': fontStack(f.body, DEFAULT_CATEGORY.body) ?? DEFAULT_FONTS.body,
    '--font-mono': fontStack(f.mono, DEFAULT_CATEGORY.mono) ?? DEFAULT_FONTS.mono,
  };
}

/**
 * Serialize the variable map to an inline `:root { ... }` CSS string,
 * safe to drop into a `<style>` tag.
 *
 * Escapes nothing (font stacks come from a controlled source) but
 * joins with proper CSS syntax. Use this from Default.astro.
 */
export function renderFontVariablesInline(
  fonts: BrandingFontsLike | null | undefined,
): string {
  const vars = buildFontVariables(fonts);
  const body = FONT_SLOTS.map(slot => `--font-${slot}:${vars[`--font-${slot}`]}`).join(';');
  return `:root{${body}}`;
}
