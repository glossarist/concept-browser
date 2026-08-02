import { describe, it, expect } from 'vitest';
import { ttlLit, ttlPrefixed, ttlIri, assertValidIri } from '../../../scripts/lib/turtle-escape';

describe('D1/D2 — Turtle escaping hardening', () => {
  describe('ttlLit', () => {
    it('escapes backslashes and quotes', () => {
      expect(ttlLit('has "quotes" and back\\slash')).toBe('"has \\"quotes\\" and back\\\\slash"');
    });

    it('escapes newlines, tabs, carriage returns', () => {
      expect(ttlLit('line1\nline2\ttab\rreturn')).toBe('"line1\\nline2\\ttab\\rreturn"');
    });

    it('returns empty literal for null/undefined', () => {
      expect(ttlLit(null)).toBe('""');
      expect(ttlLit(undefined)).toBe('""');
    });

    it('coerces non-strings to string', () => {
      expect(ttlLit(42)).toBe('"42"');
    });
  });

  describe('ttlPrefixed', () => {
    it('escapes forward slashes in local names per Turtle PN_LOCAL rules', () => {
      expect(ttlPrefixed('gloss:status/valid')).toBe('gloss:status\\/valid');
    });

    it('passes through names without slashes unchanged', () => {
      expect(ttlPrefixed('gloss:Concept')).toBe('gloss:Concept');
    });
  });

  describe('assertValidIri / ttlIri', () => {
    it('accepts a clean IRI', () => {
      expect(assertValidIri('https://example.org/path')).toBe('https://example.org/path');
    });

    it('rejects IRIs with angle brackets', () => {
      expect(() => assertValidIri('https://x.test/<bad>')).toThrow(/forbidden characters/);
    });

    it('rejects IRIs with double quotes', () => {
      expect(() => assertValidIri('https://x.test/"bad"')).toThrow(/forbidden characters/);
    });

    it('rejects IRIs with spaces', () => {
      expect(() => assertValidIri('https://x.test/bad path')).toThrow(/forbidden characters/);
    });

    it('rejects non-string IRIs', () => {
      expect(() => assertValidIri(42)).toThrow(/expected string/);
    });

    it('ttlIri wraps a clean IRI in angle brackets', () => {
      expect(ttlIri('https://example.org/x')).toBe('<https://example.org/x>');
    });

    it('ttlIri throws on invalid IRIs', () => {
      expect(() => ttlIri('https://x.test/<bad>')).toThrow();
    });
  });
});