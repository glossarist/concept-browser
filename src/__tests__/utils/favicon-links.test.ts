import { describe, it, expect } from 'vitest';
import { buildDefaultFaviconLinks, renderFaviconLinkTag } from '../../utils/favicon-links';

/**
 * Regression test for the sub-path deployment 404 bug.
 *
 * Bug (filed by user, 2026-08-01): deployments at sub-paths
 * (e.g. `/cie-eilv/`) saw console 404s for `favicon-32x32.png`,
 * `favicon-16x16.png`, `favicon-48x48.png` because the emitted
 * `<link href>` pointed at the ROOT (`/favicon-32x32.png`) instead
 * of the deployment sub-path (`/cie-eilv/favicon-32x32.png`).
 *
 * Root cause: Default.astro hardcoded `const faviconBase = '/'`.
 * Fix: cascade through configuration sources (favicon-base.ts) and
 * emit links with the resolved prefix.
 *
 * This test exercises the full link-emission path: config in →
 * resolved base → link tags with correct hrefs.
 */
describe('buildDefaultFaviconLinks — BASE_PATH regression', () => {
  it('emits /-prefixed hrefs for root deployment', () => {
    const links = buildDefaultFaviconLinks({ astroBaseUrl: '/' });
    const png16 = links.find(l => l.sizes === '16x16');
    const png32 = links.find(l => l.sizes === '32x32');
    const png48 = links.find(l => l.sizes === '48x48');
    expect(png16?.href).toBe('/favicon-16x16.png');
    expect(png32?.href).toBe('/favicon-32x32.png');
    expect(png48?.href).toBe('/favicon-48x48.png');
  });

  /**
   * THE LOAD-BEARING TEST — pins the exact bug the user reported.
   *
   * Reproduction: cie-eilv deployment at /cie-eilv/. The 0.7.106/0.7.107
   * build emitted href="/favicon-32x32.png" — wrong. The fix must emit
   * href="/cie-eilv/favicon-32x32.png".
   */
  it('emits /cie-eilv/-prefixed hrefs for sub-path deployment', () => {
    const links = buildDefaultFaviconLinks({
      siteConfigBasePath: '/cie-eilv/',
      astroBaseUrl: '/',
    });
    const png16 = links.find(l => l.sizes === '16x16');
    const png32 = links.find(l => l.sizes === '32x32');
    const png48 = links.find(l => l.sizes === '48x48');
    expect(png16?.href).toBe('/cie-eilv/favicon-16x16.png');
    expect(png32?.href).toBe('/cie-eilv/favicon-32x32.png');
    expect(png48?.href).toBe('/cie-eilv/favicon-48x48.png');
  });

  it('handles deep sub-paths', () => {
    const links = buildDefaultFaviconLinks({
      siteConfigBasePath: '/vocab/iala/',
    });
    const icon = links.find(l => l.rel === 'icon' && l.type === 'image/x-icon');
    expect(icon?.href).toBe('/vocab/iala/favicon.ico');
  });

  it('handles basePath without trailing slash', () => {
    const links = buildDefaultFaviconLinks({
      siteConfigBasePath: '/cie-eilv', // no trailing slash
    });
    const icon = links.find(l => l.rel === 'icon' && l.type === 'image/x-icon');
    expect(icon?.href).toBe('/cie-eilv/favicon.ico');
  });

  it('never produces a bare "/" href', () => {
    // Regression guard: a future bug that drops the filename would leave
    // just the prefix. This test fails loudly if that happens.
    const scenarios = [
      { astroBaseUrl: '/' },
      { astroBaseUrl: '/vocab/' },
      { siteConfigBasePath: '/cie-eilv/' },
      { brandingFaviconBasePath: '/custom/' },
    ];
    for (const input of scenarios) {
      const links = buildDefaultFaviconLinks(input);
      for (const link of links) {
        expect(link.href, `bare href for input ${JSON.stringify(input)}`).not.toBe('/');
        expect(link.href.length, `empty href for input ${JSON.stringify(input)}`).toBeGreaterThan(1);
      }
    }
  });

  it('emits the canonical 16 default favicon tags', () => {
    const links = buildDefaultFaviconLinks({ astroBaseUrl: '/' });
    // 5 icons (ico + svg + 3 PNG sizes) + 11 apple-touch-icon sizes = 16
    expect(links.length).toBe(16);
    expect(links.filter(l => l.rel === 'icon').length).toBe(5);
    expect(links.filter(l => l.rel === 'apple-touch-icon').length).toBe(11);
  });
});

describe('renderFaviconLinkTag', () => {
  it('renders all attributes in deterministic order', () => {
    const html = renderFaviconLinkTag({
      rel: 'icon',
      type: 'image/png',
      sizes: '32x32',
      href: '/favicon-32x32.png',
    });
    expect(html).toBe('<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />');
  });

  it('omits optional attributes when not set', () => {
    const html = renderFaviconLinkTag({
      rel: 'apple-touch-icon',
      sizes: '180x180',
      href: '/apple-touch-icon.png',
    });
    expect(html).toBe('<link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />');
  });

  it('never emits an empty href', () => {
    // Build a complete link tag and verify the href attribute has content.
    const links = buildDefaultFaviconLinks({ siteConfigBasePath: '/sub-path/' });
    for (const link of links) {
      const html = renderFaviconLinkTag(link);
      const hrefMatch = html.match(/href="([^"]+)"/);
      expect(hrefMatch, `no href in: ${html}`).not.toBeNull();
      expect(hrefMatch![1].length, `empty href in: ${html}`).toBeGreaterThan(0);
    }
  });
});
