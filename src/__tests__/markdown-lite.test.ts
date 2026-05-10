import { describe, it, expect } from 'vitest';
import { renderMarkdown } from '../utils/markdown-lite';

describe('renderMarkdown', () => {
  it('returns empty string for empty input', () => {
    expect(renderMarkdown('')).toBe('');
  });

  it('wraps plain text in <p>', () => {
    expect(renderMarkdown('Hello world')).toBe('<p>Hello world</p>');
  });

  it('creates separate paragraphs on blank lines', () => {
    const result = renderMarkdown('First\n\nSecond');
    expect(result).toContain('<p>First</p>');
    expect(result).toContain('<p>Second</p>');
  });

  it('renders headings (level + 1, h1 reserved)', () => {
    expect(renderMarkdown('## Heading 2')).toContain('<h3>Heading 2</h3>');
    expect(renderMarkdown('### Heading 3')).toContain('<h4>Heading 3</h4>');
    expect(renderMarkdown('#### Heading 4')).toContain('<h5>Heading 4</h5>');
  });

  it('renders bold text', () => {
    expect(renderMarkdown('some **bold** text')).toContain('<strong>bold</strong>');
  });

  it('renders italic text', () => {
    expect(renderMarkdown('some *italic* text')).toContain('<em>italic</em>');
  });

  it('renders inline code', () => {
    expect(renderMarkdown('use `code` here')).toContain('<code>code</code>');
  });

  it('renders markdown links', () => {
    const result = renderMarkdown('[label](https://example.com)');
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('>label</a>');
  });

  it('renders unordered lists', () => {
    const result = renderMarkdown('- one\n- two');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li>one</li>');
    expect(result).toContain('<li>two</li>');
  });

  it('renders ordered lists', () => {
    const result = renderMarkdown('1. first\n2. second');
    expect(result).toContain('<ol>');
    expect(result).toContain('<li>first</li>');
  });

  it('renders blockquotes', () => {
    const result = renderMarkdown('> quoted text');
    expect(result).toContain('<blockquote>');
    expect(result).toContain('quoted text');
  });

  it('renders code fences', () => {
    const result = renderMarkdown('```\nlet x = 1;\n```');
    expect(result).toContain('<pre><code>');
    expect(result).toContain('let x = 1;');
  });

  it('renders code fences with language', () => {
    const result = renderMarkdown('```js\nconst x = 1;\n```');
    expect(result).toContain('class="language-js"');
  });

  it('escapes HTML in code fences', () => {
    const result = renderMarkdown('```\n<a href="evil">\n```');
    expect(result).toContain('&lt;a href="evil"&gt;');
  });

  it('renders horizontal rules', () => {
    const result = renderMarkdown('---');
    expect(result).toContain('<hr>');
  });

  it('handles multi-line paragraphs', () => {
    const result = renderMarkdown('line one\nline two\n\nnew paragraph');
    expect(result).toContain('<p>line one line two</p>');
    expect(result).toContain('<p>new paragraph</p>');
  });
});
