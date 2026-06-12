import { describe, it, expect } from 'vitest';
import { escapeHtml, escapeAttr } from '../utils/escape';

describe('escapeHtml', () => {
  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes less-than', () => {
    expect(escapeHtml('a < b')).toBe('a &lt; b');
  });

  it('escapes greater-than', () => {
    expect(escapeHtml('a > b')).toBe('a &gt; b');
  });

  it('escapes all three special characters', () => {
    expect(escapeHtml('<script>alert("xss")</script>')).toBe(
      '&lt;script&gt;alert("xss")&lt;/script&gt;',
    );
  });

  it('returns empty string for empty input', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('escapes multiple ampersands', () => {
    expect(escapeHtml('a&b&c')).toBe('a&amp;b&amp;c');
  });

  it('handles already-escaped content (double-escaping)', () => {
    // escapeHtml does not detect already-escaped entities — by design
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });

  it('handles unicode text', () => {
    expect(escapeHtml('日本語 < 한국어')).toBe('日本語 &lt; 한국어');
  });

  it('handles long strings', () => {
    const input = 'x'.repeat(10000) + '<' + 'y'.repeat(10000);
    const result = escapeHtml(input);
    expect(result).toContain('&lt;');
    expect(result.length).toBe(input.length + 3); // '<' → '&lt;' adds 3 chars
  });
});

describe('escapeAttr', () => {
  it('escapes double quotes', () => {
    expect(escapeAttr('a "b" c')).toBe('a &quot;b&quot; c');
  });

  it('escapes HTML entities and quotes', () => {
    expect(escapeAttr('<a href="x">')).toBe('&lt;a href=&quot;x&quot;&gt;');
  });

  it('returns empty string for empty input', () => {
    expect(escapeAttr('')).toBe('');
  });

  it('leaves plain text unchanged', () => {
    expect(escapeAttr('hello')).toBe('hello');
  });

  it('handles single quotes (passed through)', () => {
    expect(escapeAttr("it's")).toBe("it's");
  });

  it('handles combined special characters', () => {
    expect(escapeAttr('a&b<c"d')).toBe('a&amp;b&lt;c&quot;d');
  });
});
