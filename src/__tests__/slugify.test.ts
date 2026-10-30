import { describe, it, expect } from 'vitest';
import { slugify } from '../utils/slugify';
import publishedSlugs from '../__fixtures__/isotc211-domain-slugs.json';

describe('slugify', () => {
  it('lowercases text', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips slashes and joins surrounding text', () => {
    expect(slugify('foo bar/baz')).toBe('foo-barbaz');
  });

  it('strips non-word characters', () => {
    expect(slugify('géométrie (2D)')).toBe('géométrie-2d');
  });

  it('collapses multiple spaces into single hyphen', () => {
    expect(slugify('a   b')).toBe('a-b');
  });

  it('handles empty string', () => {
    expect(slugify('')).toBe('');
  });

  it('preserves hyphens in input', () => {
    expect(slugify('iso-19107')).toBe('iso-19107');
  });

  describe('unicode labels', () => {
    it('keeps accented letters', () => {
      expect(slugify('dirección postal')).toBe('dirección-postal');
    });

    it('keeps non-Latin scripts', () => {
      expect(slugify('геопозиционирование')).toBe('геопозиционирование');
      expect(slugify('地理定位')).toBe('地理定位');
      expect(slugify('지리 위치')).toBe('지리-위치');
    });

    it('keeps Arabic combining marks', () => {
      expect(slugify('نظام الإحداثيات')).toBe('نظام-الإحداثيات');
    });

    it('is NFC-stable: composed and decomposed input give one slug', () => {
      expect(slugify('é')).toBe(slugify('é'));
    });

    it('gives distinct labels distinct slugs', () => {
      const labels = ['UML', 'dirección postal', 'direccion postal', 'геопозиционирование',
        '地理定位', '지리 위치', 'تحديد المواقع'];
      expect(new Set(labels.map(slugify)).size).toBe(labels.length);
    });

    it('is idempotent', () => {
      for (const l of ['dirección postal', 'геопозиционирование', '()', 'a b']) {
        expect(slugify(slugify(l))).toBe(slugify(l));
      }
    });
  });

  describe('labels without letters or digits', () => {
    it('never returns an empty or separator-only slug', () => {
      for (const l of ['()', '---', ' ', '!!', '/', '- -']) {
        expect(slugify(l)).toMatch(/^x-[0-9a-f]{8}$/);
      }
    });

    it('distinguishes different such labels', () => {
      expect(slugify('()')).not.toBe(slugify('[]'));
      expect(slugify('()')).toBe(slugify('()'));
    });

    it('still maps empty input to empty (callers guard on truthy)', () => {
      expect(slugify('')).toBe('');
    });
  });

  describe('existing ASCII URLs do not move', () => {
    // Verbatim copy of the pre-unicode implementation.
    const legacy = (t: string) => t.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s/]+/g, '-');

    it('matches every domain slug published in the isotc211 dataset', () => {
      const entries = Object.entries(publishedSlugs as Record<string, string>);
      expect(entries.length).toBeGreaterThan(150);
      for (const [label, slug] of entries) expect(slugify(label)).toBe(slug);
    });

    it('is byte-identical to the legacy output for ASCII input with a letter or digit', () => {
      let seed = 12345;
      const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
      for (let i = 0; i < 20000; i++) {
        const len = 1 + Math.floor(rnd() * 12);
        let t = '';
        for (let j = 0; j < len; j++) t += String.fromCharCode(9 + Math.floor(rnd() * 118));
        if (!/[A-Za-z0-9]/.test(t)) continue;
        expect(slugify(t)).toBe(legacy(t));
      }
    });
  });
});
