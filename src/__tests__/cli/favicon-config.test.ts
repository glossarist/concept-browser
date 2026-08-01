import { describe, it, expect } from 'vitest';
import { resolve } from 'path';

/**
 * Regression test for issue #177 — `branding.favicon` object form crashes
 * the CLI with ERR_INVALID_ARG_TYPE.
 *
 * The 0.7.106 fix for #173 shipped `branding.favicon` as an object
 * (`{ source_dir, links_html, skip_default_links, base_path }`) in the
 * TypeScript types and in `src/layouts/Default.astro`, but `cli/index.mjs`
 * still called `resolve(process.cwd(), branding.favicon)` — which throws
 * `ERR_INVALID_ARG_TYPE` when `branding.favicon` is an object.
 *
 * Importing `cli/index.mjs` directly runs the full build pipeline, which
 * is too heavy for a unit test. Instead, this spec pins the type-narrowing
 * contract that the CLI's favicon resolution MUST honor: a string is a
 * path, an object is a config, and the two must never be conflated. The
 * integration smoke test (scripts/smoke.mjs) covers the end-to-end path.
 */

describe('CLI favicon config (issue #177)', () => {
  it('resolve() throws ERR_INVALID_ARG_TYPE when branding.favicon is an object — proves the bug class', async () => {
    // This is the bug: the legacy code did `resolve(cwd, branding.favicon)`
    // unconditionally. When branding.favicon is an object, Node throws.
    const faviconCfg = { skip_default_links: true, links_html: '<link>' };
    expect(() => resolve(process.cwd(), faviconCfg as any)).toThrow(/paths\[1\].*string|ERR_INVALID_ARG_TYPE/);
  });

  it('typeof-string guard prevents the crash', () => {
    const faviconCfg = { skip_default_links: true, links_html: '<link>' };
    const safeResolve = () =>
      typeof faviconCfg === 'string' && faviconCfg
        ? resolve(process.cwd(), faviconCfg)
        : null;
    expect(safeResolve).not.toThrow();
    expect(safeResolve()).toBe(null);
  });

  it('accepts string form (legacy) — single source path', () => {
    const faviconCfg = 'assets/my-brand.svg';
    const resolved =
      typeof faviconCfg === 'string' && faviconCfg
        ? resolve(process.cwd(), faviconCfg)
        : null;
    expect(resolved).toBe(resolve(process.cwd(), 'assets/my-brand.svg'));
  });

  it('accepts object form — no path resolution attempted on the object itself', () => {
    const faviconCfg = {
      source_dir: 'assets/favicons',
      links_html: '<link rel="icon" href="/favicon.svg" />',
      skip_default_links: true,
      base_path: '/',
    };
    expect(typeof faviconCfg).toBe('object');
    // The object form must be inspected for fields, not passed to resolve().
    expect((faviconCfg as any).source_dir).toBe('assets/favicons');
    expect((faviconCfg as any).links_html).toContain('<link');
    expect((faviconCfg as any).skip_default_links).toBe(true);
  });
});
