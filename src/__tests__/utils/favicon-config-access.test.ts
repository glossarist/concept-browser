import { describe, it, expect } from 'vitest';
import {
  getFaviconBasePath,
  getFaviconSkipDefaultLinks,
  getFaviconLinksHtml,
  getFaviconSourceDir,
  getFaviconIcons,
} from '../../utils/favicon-config-access';

/**
 * Regression test for the snake_case/camelCase mismatch reported against
 * 0.7.109 (user-filed bug, 2026-08-01):
 *
 *   "source_dir reads snake_case — CLI reads faviconCfg.source_dir but
 *    loadSiteConfig normalizes to sourceDir. Same bug as skip_default_links,
 *    base_path, links_html. The canonical files never get copied."
 *
 * Root cause: two loaders, two conventions.
 *   - scripts/load-site-config.mjs normalizes snake_case → camelCase.
 *   - src/lib/site-config.ts (Astro) does NOT normalize.
 *
 * Fix: the accessors below accept BOTH forms. They check camelCase first
 * (the post-normalization form) and fall back to snake_case (the raw YAML
 * wire form). Either loader's output works.
 */

describe('getFaviconBasePath', () => {
  it('returns undefined for null/undefined', () => {
    expect(getFaviconBasePath(null)).toBeUndefined();
    expect(getFaviconBasePath(undefined)).toBeUndefined();
    expect(getFaviconBasePath({})).toBeUndefined();
  });

  it('reads camelCase basePath', () => {
    expect(getFaviconBasePath({ basePath: '/vocab/' })).toBe('/vocab/');
  });

  it('reads snake_case base_path', () => {
    expect(getFaviconBasePath({ base_path: '/vocab/' })).toBe('/vocab/');
  });

  it('camelCase wins when both forms are set', () => {
    expect(getFaviconBasePath({ basePath: '/camel/', base_path: '/snake/' })).toBe('/camel/');
  });
});

describe('getFaviconSkipDefaultLinks', () => {
  it('returns false for null/undefined', () => {
    expect(getFaviconSkipDefaultLinks(null)).toBe(false);
    expect(getFaviconSkipDefaultLinks(undefined)).toBe(false);
    expect(getFaviconSkipDefaultLinks({})).toBe(false);
  });

  it('reads camelCase skipDefaultLinks', () => {
    expect(getFaviconSkipDefaultLinks({ skipDefaultLinks: true })).toBe(true);
    expect(getFaviconSkipDefaultLinks({ skipDefaultLinks: false })).toBe(false);
  });

  it('reads snake_case skip_default_links', () => {
    expect(getFaviconSkipDefaultLinks({ skip_default_links: true })).toBe(true);
  });
});

describe('getFaviconLinksHtml', () => {
  it('returns undefined for null/undefined', () => {
    expect(getFaviconLinksHtml(null)).toBeUndefined();
    expect(getFaviconLinksHtml({})).toBeUndefined();
  });

  it('reads camelCase linksHtml', () => {
    expect(getFaviconLinksHtml({ linksHtml: '<link>' })).toBe('<link>');
  });

  it('reads snake_case links_html', () => {
    expect(getFaviconLinksHtml({ links_html: '<link>' })).toBe('<link>');
  });
});

describe('getFaviconSourceDir', () => {
  it('returns undefined for null/undefined', () => {
    expect(getFaviconSourceDir(null)).toBeUndefined();
    expect(getFaviconSourceDir({})).toBeUndefined();
  });

  it('reads camelCase sourceDir', () => {
    expect(getFaviconSourceDir({ sourceDir: 'assets/favicons' })).toBe('assets/favicons');
  });

  /**
   * THE LOAD-BEARING TEST — pins the exact bug the user reported.
   * "source_dir reads snake_case — CLI reads faviconCfg.source_dir but
   *  loadSiteConfig normalizes to sourceDir. The canonical files never
   *  get copied."
   *
   * After loadSiteConfig normalization, the config object has sourceDir
   * (camelCase), NOT source_dir. The accessor must return the value.
   */
  it('reads snake_case source_dir (the user-reported regression form)', () => {
    expect(getFaviconSourceDir({ source_dir: 'assets/favicons' })).toBe('assets/favicons');
  });

  it('camelCase wins when both forms are set', () => {
    expect(getFaviconSourceDir({ sourceDir: 'a', source_dir: 'b' })).toBe('a');
  });
});

describe('getFaviconIcons', () => {
  it('returns undefined for null/undefined', () => {
    expect(getFaviconIcons(null)).toBeUndefined();
    expect(getFaviconIcons({})).toBeUndefined();
  });

  it('reads icons (same key in both forms)', () => {
    const icons = [{ rel: 'icon', href: 'favicon.ico' }];
    expect(getFaviconIcons({ icons })).toBe(icons);
  });
});

describe('regression — both loader outputs work end-to-end', () => {
  // Simulate the two loader paths:
  //   - Astro's getSiteConfig (no normalization): snake_case keys preserved
  //   - CLI's loadSiteConfig (normalizes): camelCase keys
  const snakeCaseForm = {
    base_path: '/cie-eilv/',
    skip_default_links: true,
    source_dir: 'assets/favicons',
    links_html: '<link>',
    icons: [{ rel: 'icon', href: 'favicon.ico' }],
  };
  const camelCaseForm = {
    basePath: '/cie-eilv/',
    skipDefaultLinks: true,
    sourceDir: 'assets/favicons',
    linksHtml: '<link>',
    icons: [{ rel: 'icon', href: 'favicon.ico' }],
  };

  for (const [label, cfg] of [['snake_case (Astro)', snakeCaseForm], ['camelCase (CLI)', camelCaseForm]] as const) {
    it(`accessors return identical values for ${label}`, () => {
      expect(getFaviconBasePath(cfg)).toBe('/cie-eilv/');
      expect(getFaviconSkipDefaultLinks(cfg)).toBe(true);
      expect(getFaviconSourceDir(cfg)).toBe('assets/favicons');
      expect(getFaviconLinksHtml(cfg)).toBe('<link>');
      expect(getFaviconIcons(cfg)).toEqual([{ rel: 'icon', href: 'favicon.ico' }]);
    });
  }
});
