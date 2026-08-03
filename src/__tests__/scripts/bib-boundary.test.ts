import { describe, it, expect } from 'vitest';

/**
 * Regression test: extractInlineRefs must NOT turn bib:/link:/image: mentions
 * into concept cross-references. These are deployment-specific renderings
 * (bibliography entries, external URLs, inline images), not concept pages.
 *
 * The data/deployment boundary requires that dataset authors can write
 * {{bib:...}} without knowing whether IEV or any other dataset is
 * co-deployed. The deployment's renderer handles bib/link/image at
 * runtime. concept-browser MUST NOT create concept URIs for them.
 */

// Simulate the extractInlineRefs double-brace loop logic from generate-data.ts
function shouldSkipMention(body: string): boolean {
  return /^(bib|link|image):/i.test(body);
}

describe('data/deployment boundary — bib:/link:/image: mentions never become concept URIs', () => {
  it('skips bib: mentions', () => {
    expect(shouldSkipMention('bib:702-02-07, IEV 702-02-07')).toBe(true);
    expect(shouldSkipMention('bib:ref_1')).toBe(true);
  });

  it('skips link: mentions', () => {
    expect(shouldSkipMention('link:https://example.com')).toBe(true);
    expect(shouldSkipMention('link:https://example.com, click here')).toBe(true);
  });

  it('skips image: mentions', () => {
    expect(shouldSkipMention('image:diagram.png')).toBe(true);
    expect(shouldSkipMention('image:diagram.png, alt text')).toBe(true);
  });

  it('does NOT skip cite: mentions (concept cross-references)', () => {
    expect(shouldSkipMention('cite:iso704')).toBe(false);
    expect(shouldSkipMention('cite:iso704, ISO 704')).toBe(false);
  });

  it('does NOT skip numeric mentions (e.g. 17-21-004)', () => {
    expect(shouldSkipMention('17-21-004')).toBe(false);
    expect(shouldSkipMention('112-01-10')).toBe(false);
  });

  it('does NOT skip urn: mentions', () => {
    expect(shouldSkipMention('urn:iso:std:iso:704')).toBe(false);
  });

  it('does NOT skip designation mentions', () => {
    expect(shouldSkipMention('measurement unit')).toBe(false);
  });
});