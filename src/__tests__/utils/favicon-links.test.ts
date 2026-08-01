import { describe, it, expect } from 'vitest';
import { buildFaviconLinks, renderFaviconLinkTag, type FaviconIcon } from '../../utils/favicon-links';

/**
 * Regression test for the sub-path deployment 404 bug + the
 * data-driven icons API.
 *
 * Bug 1 (filed by user, 2026-08-01): deployments at sub-paths
 * (e.g. `/cie-eilv/`) saw console 404s for `favicon-32x32.png`,
 * `favicon-16x16.png`, `favicon-48x48.png` because the emitted
 * `<link href>` pointed at the ROOT instead of the deployment sub-path.
 *
 * Bug 2 (filed by user, 2026-08-01): the `links_html` field required
 * consumers to inject raw HTML — impossible to validate, can't be safely
 * BASE_PATH-rewritten. Refactored to DATA: `icons: [{ rel, href, type?,
 * sizes? }]` — href is a filename, system applies the correct prefix.
 */
describe('buildFaviconLinks — BASE_PATH regression', () => {
  it('emits /-prefixed hrefs for root deployment', () => {
    const links = buildFaviconLinks({ astroBaseUrl: '/' });
    const png16 = links.find(l => l.sizes === '16x16');
    const png32 = links.find(l => l.sizes === '32x32');
    const png48 = links.find(l => l.sizes === '48x48');
    expect(png16?.href).toBe('/favicon-16x16.png');
    expect(png32?.href).toBe('/favicon-32x32.png');
    expect(png48?.href).toBe('/favicon-48x48.png');
  });

  /**
   * THE LOAD-BEARING TEST — pins the exact bug the user reported.
   */
  it('emits /cie-eilv/-prefixed hrefs for sub-path deployment', () => {
    const links = buildFaviconLinks({
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
    const links = buildFaviconLinks({ siteConfigBasePath: '/vocab/iala/' });
    const icon = links.find(l => l.rel === 'icon' && l.type === 'image/x-icon');
    expect(icon?.href).toBe('/vocab/iala/favicon.ico');
  });

  it('handles basePath without trailing slash', () => {
    const links = buildFaviconLinks({ siteConfigBasePath: '/cie-eilv' });
    const icon = links.find(l => l.rel === 'icon' && l.type === 'image/x-icon');
    expect(icon?.href).toBe('/cie-eilv/favicon.ico');
  });

  it('never produces a bare "/" href', () => {
    const scenarios = [
      { astroBaseUrl: '/' },
      { astroBaseUrl: '/vocab/' },
      { siteConfigBasePath: '/cie-eilv/' },
      { brandingFaviconBasePath: '/custom/' },
    ];
    for (const input of scenarios) {
      const links = buildFaviconLinks(input);
      for (const link of links) {
        expect(link.href, `bare href for input ${JSON.stringify(input)}`).not.toBe('/');
        expect(link.href.length, `empty href for input ${JSON.stringify(input)}`).toBeGreaterThan(1);
      }
    }
  });

  it('emits the canonical 16 default favicon tags', () => {
    const links = buildFaviconLinks({ astroBaseUrl: '/' });
    expect(links.length).toBe(16);
    expect(links.filter(l => l.rel === 'icon').length).toBe(5);
    expect(links.filter(l => l.rel === 'apple-touch-icon').length).toBe(11);
  });
});

describe('buildFaviconLinks — consumer-declared icons (data form)', () => {
  const consumerIcons: FaviconIcon[] = [
    { rel: 'icon',          type: 'image/svg+xml', href: 'favicon.svg' },
    { rel: 'icon',          type: 'image/png',     sizes: '96x96', href: 'favicon-96x96.png' },
    { rel: 'shortcut icon', href: 'favicon.ico' },
    { rel: 'apple-touch-icon', sizes: '180x180',  href: 'apple-touch-icon.png' },
    { rel: 'manifest',      href: 'site.webmanifest' },
  ];

  it('replaces the default set when icons is non-empty', () => {
    const links = buildFaviconLinks({ astroBaseUrl: '/', icons: consumerIcons });
    expect(links.length).toBe(consumerIcons.length);
    // Should NOT contain any of the default 16 links.
    expect(links.find(l => l.sizes === '16x16')).toBeUndefined();
    expect(links.find(l => l.sizes === '32x32')).toBeUndefined();
  });

  it('prefixes bare filenames with the resolved base path', () => {
    const links = buildFaviconLinks({
      siteConfigBasePath: '/cie-eilv/',
      icons: consumerIcons,
    });
    const svg = links.find(l => l.type === 'image/svg+xml');
    const png96 = links.find(l => l.sizes === '96x96');
    const ico = links.find(l => l.rel === 'shortcut icon');
    const manifest = links.find(l => l.rel === 'manifest');
    expect(svg?.href).toBe('/cie-eilv/favicon.svg');
    expect(png96?.href).toBe('/cie-eilv/favicon-96x96.png');
    expect(ico?.href).toBe('/cie-eilv/favicon.ico');
    expect(manifest?.href).toBe('/cie-eilv/site.webmanifest');
  });

  it('emits absolute URLs as-is (no prefix)', () => {
    const links = buildFaviconLinks({
      astroBaseUrl: '/vocab/',
      icons: [
        { rel: 'icon', type: 'image/svg+xml', href: 'https://cdn.example.com/favicon.svg' },
        { rel: 'icon', href: 'favicon.ico' },
      ],
    });
    const cdn = links.find(l => l.href.startsWith('https://'));
    const local = links.find(l => l.href.endsWith('favicon.ico') && !l.href.startsWith('https://'));
    expect(cdn?.href).toBe('https://cdn.example.com/favicon.svg');
    expect(local?.href).toBe('/vocab/favicon.ico');
  });

  it('emits root-relative paths as-is', () => {
    const links = buildFaviconLinks({
      astroBaseUrl: '/vocab/',
      icons: [{ rel: 'icon', href: '/absolute-path.png' }],
    });
    expect(links[0].href).toBe('/absolute-path.png');
  });

  it('preserves type and sizes attributes from the data', () => {
    const links = buildFaviconLinks({ astroBaseUrl: '/', icons: consumerIcons });
    const svg = links.find(l => l.type === 'image/svg+xml');
    const png96 = links.find(l => l.sizes === '96x96');
    const touch = links.find(l => l.rel === 'apple-touch-icon');
    expect(svg?.type).toBe('image/svg+xml');
    expect(png96?.sizes).toBe('96x96');
    expect(touch?.sizes).toBe('180x180');
  });

  it('falls back to default set when icons is empty array', () => {
    const links = buildFaviconLinks({ astroBaseUrl: '/', icons: [] });
    expect(links.length).toBe(16);
  });

  it('falls back to default set when icons is undefined', () => {
    const links = buildFaviconLinks({ astroBaseUrl: '/' });
    expect(links.length).toBe(16);
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
    const links = buildFaviconLinks({ siteConfigBasePath: '/sub-path/' });
    for (const link of links) {
      const html = renderFaviconLinkTag(link);
      const hrefMatch = html.match(/href="([^"]+)"/);
      expect(hrefMatch, `no href in: ${html}`).not.toBeNull();
      expect(hrefMatch![1].length, `empty href in: ${html}`).toBeGreaterThan(0);
    }
  });
});
