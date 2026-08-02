import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderContent, cleanContent, type RenderOptions } from '../../utils/content-renderer';

/**
 * Unified mention syntax contract — {{kind:target[, label]}}.
 *
 * Pins the dispatch for every kind and the deprecation behavior for
 * the legacy <<ref,title>> AsciiDoc xref syntax.
 */

describe('content-renderer — unified mention kinds', () => {

  describe('{{link:URL}} — external link', () => {
    it('renders bare URL as external anchor', () => {
      const html = renderContent('{{link:https://example.com}}');
      expect(html).toContain('<a href="https://example.com"');
      expect(html).toContain('target="_blank"');
      expect(html).toContain('rel="noopener"');
      expect(html).toContain('https://example.com');
    });

    it('renders URL with label', () => {
      const html = renderContent('{{link:https://example.com, click here}}');
      expect(html).toContain('click here');
      expect(html).toContain('href="https://example.com"');
    });

    it('delegates to linkResolver when provided', () => {
      const opts: RenderOptions = { linkResolver: (url, label) => `<a href="${url}" class="custom">${label}</a>` };
      const html = renderContent('{{link:https://example.com, test}}', opts);
      expect(html).toContain('class="custom"');
      expect(html).toContain('test');
    });
  });

  describe('{{image:src}} — inline image embed', () => {
    it('renders bare src as img tag', () => {
      const html = renderContent('{{image:photo.png}}');
      expect(html).toContain('<img');
      expect(html).toContain('src="photo.png"');
    });

    it('renders src with alt text', () => {
      const html = renderContent('{{image:photo.png, A photo of the setup}}');
      expect(html).toContain('src="photo.png"');
      expect(html).toContain('alt="A photo of the setup"');
    });

    it('delegates to imageResolver when provided', () => {
      const opts: RenderOptions = { imageResolver: (src, alt) => `<img src="/base/${src}" alt="${alt}" class="custom-img" />` };
      const html = renderContent('{{image:photo.png, test}}', opts);
      expect(html).toContain('src="/base/photo.png"');
      expect(html).toContain('class="custom-img"');
    });
  });

  describe('{{bib:id}} — bibliography entry', () => {
    it('renders id as bib-ref span when no resolver', () => {
      const html = renderContent('{{bib:ref_1}}');
      expect(html).toContain('bib-ref');
      expect(html).toContain('ref_1');
    });

    it('renders label when provided', () => {
      const html = renderContent('{{bib:ref_1, ISO 704}}');
      expect(html).toContain('ISO 704');
    });

    it('delegates to bibResolver when provided', () => {
      const opts: RenderOptions = { bibResolver: (id, title) => `<a href="/bib/${id}" class="bib-link">${title}</a>` };
      const html = renderContent('{{bib:ref_1, ISO 704}}', opts);
      expect(html).toContain('href="/bib/ref_1"');
      expect(html).toContain('ISO 704');
    });
  });

  describe('cleanContent — new kinds stripped correctly', () => {
    it('strips {{link:URL}} to the URL', () => {
      expect(cleanContent('{{link:https://example.com}}')).toBe('https://example.com');
    });

    it('strips {{link:URL, label}} to the label', () => {
      expect(cleanContent('{{link:https://example.com, click here}}')).toBe('click here');
    });

    it('strips {{image:src}} to empty string', () => {
      expect(cleanContent('{{image:photo.png}}')).toBe('');
    });

    it('strips {{image:src, alt}} to the alt text', () => {
      expect(cleanContent('{{image:photo.png, A photo}}')).toBe('A photo');
    });

    it('strips {{bib:id}} to the id', () => {
      expect(cleanContent('{{bib:ref_1}}')).toBe('ref_1');
    });

    it('strips {{bib:id, label}} to the label', () => {
      expect(cleanContent('{{bib:ref_1, ISO 704}}')).toBe('ISO 704');
    });
  });
});

describe('content-renderer — legacy <<ref,title>> deprecation', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('emits a deprecation warning via console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    renderContent('See <<845-01-01, 845-01-01>> for details.');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][0]).toContain('deprecated');
    expect(spy.mock.calls[0][0]).toContain('<<845-01-01,845-01-01>>');
  });

  it('renders the title as plain text in a legacy-xref span', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const html = renderContent('See <<845-01-01, 845-01-01>> for details.');
    expect(html).toContain('legacy-xref');
    expect(html).toContain('845-01-01');
    // Must NOT contain bib-ref or bib-link (the old wrong behavior)
    expect(html).not.toContain('bib-ref');
    expect(html).not.toContain('bib-link');
  });

  it('does NOT call bibResolver (cascade is not bypassed)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const bibResolver = vi.fn(() => '<a class="bib-link">mock</a>');
    const opts: RenderOptions = { bibResolver };
    const html = renderContent('<<845-01-01, 845-01-01>>', opts);
    expect(bibResolver).not.toHaveBeenCalled();
    expect(html).not.toContain('bib-link');
  });

  it('cleanContent extracts the title from <<ref,title>>', () => {
    expect(cleanContent('See <<845-01-01, 845-01-01>>')).toContain('845-01-01');
  });
});
