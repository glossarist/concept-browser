import { describe, it, expect } from 'vitest';
import { isSafeUrl, sanitizeUrl } from '../../utils/url-safety';

describe('isSafeUrl', () => {
  it('accepts http and https URLs', () => {
    expect(isSafeUrl('https://example.com')).toBe(true);
    expect(isSafeUrl('http://example.com')).toBe(true);
    expect(isSafeUrl('https://example.com/path?q=1')).toBe(true);
  });

  it('accepts mailto and tel URLs', () => {
    expect(isSafeUrl('mailto:foo@example.org')).toBe(true);
    expect(isSafeUrl('tel:+15551234567')).toBe(true);
  });

  it('accepts same-document and relative URLs', () => {
    expect(isSafeUrl('#anchor')).toBe(true);
    expect(isSafeUrl('/page')).toBe(true);
    expect(isSafeUrl('./page')).toBe(true);
    expect(isSafeUrl('../page')).toBe(true);
  });

  it('rejects javascript: URLs', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('javascript:/* */alert(1)')).toBe(false);
  });

  it('rejects data: URLs', () => {
    expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeUrl('data:image/png;base64,AAA')).toBe(false);
  });

  it('rejects file: URLs', () => {
    expect(isSafeUrl('file:///etc/passwd')).toBe(false);
  });

  it('rejects URLs with whitespace, angle brackets, or quotes', () => {
    expect(isSafeUrl('https://example.com/ foo')).toBe(false);
    expect(isSafeUrl('https://example.com/<script>')).toBe(false);
    expect(isSafeUrl('https://example.com/" onload="alert(1)')).toBe(false);
  });

  it('rejects malformed inputs', () => {
    expect(isSafeUrl('')).toBe(false);
    expect(isSafeUrl('   ')).toBe(false);
    expect(isSafeUrl(null as unknown as string)).toBe(false);
    expect(isSafeUrl(undefined as unknown as string)).toBe(false);
  });

  it('rejects unknown protocol schemes', () => {
    expect(isSafeUrl('vbscript:msgbox(1)')).toBe(false);
    expect(isSafeUrl('about:blank')).toBe(false);
  });
});

describe('sanitizeUrl', () => {
  it('returns the URL if safe', () => {
    expect(sanitizeUrl('https://example.com')).toBe('https://example.com');
  });

  it('returns empty string for unsafe URLs', () => {
    expect(sanitizeUrl('javascript:alert(1)')).toBe('');
    expect(sanitizeUrl('data:text/html,<script>')).toBe('');
  });
});
