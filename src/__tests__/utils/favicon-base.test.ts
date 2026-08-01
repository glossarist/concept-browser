import { describe, it, expect } from 'vitest';
import { resolveFaviconBase } from '../../utils/favicon-base';

/**
 * Regression test for the sub-path deployment 404 bug.
 *
 * Bug (filed by user, 2026-08-01): deployments at sub-paths
 * (e.g. `/cie-eilv/`) saw console 404s for `favicon-32x32.png`,
 * `favicon-16x16.png`, `favicon-48x48.png` because the emitted
 * `<link href>` pointed at the ROOT (`/favicon-32x32.png`) instead
 * of the deployment sub-path (`/cie-eilv/favicon-32x32.png`).
 *
 * Root cause: `Default.astro` hardcoded `const faviconBase = '/'`.
 * Fix: cascade through configuration sources to find the right prefix.
 */
describe('resolveFaviconBase', () => {
  it('returns / when nothing is configured (root deployment)', () => {
    expect(resolveFaviconBase({})).toBe('/');
  });

  it('returns / when all candidates are empty', () => {
    expect(resolveFaviconBase({
      brandingFaviconBasePath: '',
      siteConfigBasePath: '',
      astroBaseUrl: '',
    })).toBe('/');
  });

  it('uses branding.favicon.base_path when set (highest priority)', () => {
    expect(resolveFaviconBase({
      brandingFaviconBasePath: '/my-brand/',
      siteConfigBasePath: '/should-be-ignored/',
      astroBaseUrl: '/should-be-ignored/',
    })).toBe('/my-brand/');
  });

  it('uses siteConfig.basePath when branding.favicon.base_path is absent', () => {
    expect(resolveFaviconBase({
      siteConfigBasePath: '/cie-eilv/',
      astroBaseUrl: '/',
    })).toBe('/cie-eilv/');
  });

  it('uses import.meta.env.BASE_URL when siteConfig.basePath is absent', () => {
    expect(resolveFaviconBase({
      astroBaseUrl: '/vocab/',
    })).toBe('/vocab/');
  });

  /**
   * THE LOAD-BEARING REGRESSION TEST.
   *
   * Reproduction of the bug: cie-eilv is deployed at /cie-eilv/, but
   * the live site emitted <link href="/favicon-32x32.png">. The fix
   * must produce /cie-eilv/favicon-32x32.png.
   */
  it('regression: resolves /cie-eilv/ when that is the configured basePath', () => {
    const base = resolveFaviconBase({
      siteConfigBasePath: '/cie-eilv/',
      astroBaseUrl: '/',
    });
    expect(base).toBe('/cie-eilv/');
    // Pin the full URL construction so a future regression that breaks
    // the trailing slash also fails this test.
    expect(`${base}favicon-32x32.png`).toBe('/cie-eilv/favicon-32x32.png');
    expect(`${base}favicon-16x16.png`).toBe('/cie-eilv/favicon-16x16.png');
    expect(`${base}favicon-48x48.png`).toBe('/cie-eilv/favicon-48x48.png');
  });

  it('appends trailing slash if consumer omitted it', () => {
    expect(resolveFaviconBase({
      siteConfigBasePath: '/cie-eilv', // no trailing slash
    })).toBe('/cie-eilv/');
  });

  it('does not double-slash if consumer includes trailing slash', () => {
    expect(resolveFaviconBase({
      siteConfigBasePath: '/cie-eilv/',
    })).toBe('/cie-eilv/');
  });

  it('handles deep sub-path deployments', () => {
    expect(resolveFaviconBase({
      siteConfigBasePath: '/vocab/iala/',
    })).toBe('/vocab/iala/');
    expect(`${resolveFaviconBase({ siteConfigBasePath: '/vocab/iala/' })}favicon.ico`)
      .toBe('/vocab/iala/favicon.ico');
  });
});
