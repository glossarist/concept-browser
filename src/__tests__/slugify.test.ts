import { describe, it, expect } from 'vitest';
import { slugify } from '../utils/slugify';

describe('slugify', () => {
  it('lowercases text', () => {
    expect(slugify('Hello World')).toBe('hello-world');
  });

  it('strips slashes and joins surrounding text', () => {
    expect(slugify('foo bar/baz')).toBe('foo-barbaz');
  });

  it('strips non-word characters', () => {
    expect(slugify('géométrie (2D)')).toBe('gomtrie-2d');
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
});
