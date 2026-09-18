import { describe, it, expect } from 'vitest';
import {
  buildConceptUri,
  buildConceptUriPrefix,
  buildDatasetUriPrefix,
  buildSiteOrigin,
} from '../lib/concept-uri';

describe('buildSiteOrigin — deployment hosting coordinate', () => {
  it('prepends https:// to a scheme-less domain that carries a custom path', () => {
    expect(buildSiteOrigin('oimlsmart.github.io/vocab', 'https://identity.example/viml'))
      .toBe('https://oimlsmart.github.io/vocab');
  });

  it('keeps the configured path segment (/iala-vocab)', () => {
    expect(buildSiteOrigin('www.glossarist.org/iala-vocab', 'https://identity.example/iala'))
      .toBe('https://www.glossarist.org/iala-vocab');
  });

  it('handles an apex domain with no path', () => {
    expect(buildSiteOrigin('isotc204.geolexica.org', 'https://isotc204.geolexica.org'))
      .toBe('https://isotc204.geolexica.org');
  });

  it('normalizes a domain that already declares a scheme and trailing slash', () => {
    expect(buildSiteOrigin('https://www.example.org/site/', 'https://identity.example'))
      .toBe('https://www.example.org/site');
  });

  it('falls back to uriBase only when no domain is declared', () => {
    expect(buildSiteOrigin(undefined, 'https://identity.example/reg')).toBe('https://identity.example/reg');
    expect(buildSiteOrigin(null, 'https://identity.example/reg')).toBe('https://identity.example/reg');
  });

  it('keeps identity (uriBase) and hosting (domain) independent — /dataset/ routes build on either', () => {
    const sitePrefix = buildConceptUriPrefix(buildSiteOrigin('oimlsmart.github.io/vocab', 'https://identity.example/viml'), 'viml-2013');
    expect(sitePrefix).toBe('https://oimlsmart.github.io/vocab/dataset/viml-2013/concept/');
    const identityPrefix = buildConceptUriPrefix('https://identity.example/viml', 'viml-2013');
    expect(identityPrefix).toBe('https://identity.example/viml/dataset/viml-2013/concept/');
    expect(buildConceptUri('https://identity.example/viml', 'viml-2013', '0.01'))
      .toBe('https://identity.example/viml/dataset/viml-2013/concept/0.01');
    expect(buildDatasetUriPrefix('https://identity.example/viml', 'viml-2013'))
      .toBe('https://identity.example/viml/dataset/viml-2013/');
  });
});
