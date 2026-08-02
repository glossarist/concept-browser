import { describe, it, expect } from 'vitest';
import { renderContent } from '../../utils/content-renderer';

describe('content-renderer XSS protection', () => {
  it('blocks javascript: URLs in {{link:}} (no anchor tag)', () => {
    const html = renderContent('{{link:javascript:alert(1)}}', {});
    expect(html).not.toContain('<a');
    expect(html).not.toContain('href=');
  });

  it('blocks javascript: URLs in {{link:}} with label (renders as text)', () => {
    const html = renderContent('{{link:javascript:alert(1), click me}}', {});
    expect(html).not.toContain('<a');
    expect(html).not.toContain('href=');
    expect(html).toContain('click me');
  });

  it('blocks data: URLs in {{link:}} (no anchor tag)', () => {
    const html = renderContent('{{link:data:text/html,<script>alert(1)</script>}}', {});
    expect(html).not.toContain('<a');
    expect(html).not.toContain('href=');
    expect(html).not.toContain('<script>');
  });

  it('allows https: URLs in {{link:}}', () => {
    const html = renderContent('{{link:https://example.com}}', {});
    expect(html).toContain('href="https://example.com"');
  });

  it('blocks javascript: URLs in {{image:}} (no img tag)', () => {
    const html = renderContent('{{image:javascript:alert(1)}}', {});
    expect(html).not.toContain('<img');
  });

  it('blocks data: URLs in {{image:}} (no img tag with executable src)', () => {
    const html = renderContent('{{image:data:text/html,<script>}}', {});
    expect(html).not.toContain('<img');
    expect(html).not.toContain('data:text/html');
  });

  it('allows relative paths in {{image:}}', () => {
    const html = renderContent('{{image:diagram.png}}', {});
    expect(html).toContain('src="diagram.png"');
  });

  it('escapes HTML in unordered list items', () => {
    const html = renderContent('* <script>alert(1)</script>\n* safe item', {});
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });

  it('escapes HTML in ordered list items', () => {
    const html = renderContent('1. <img onerror=alert(1)>\n2. safe', {});
    expect(html).not.toContain('<img onerror');
    expect(html).toContain('&lt;img');
  });
});
