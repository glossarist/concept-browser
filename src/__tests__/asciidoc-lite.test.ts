import { describe, it, expect } from 'vitest';
import { renderAsciiDocLite } from '../utils/asciidoc-lite';

describe('renderAsciiDocLite', () => {
  it('returns empty string for empty input', () => {
    expect(renderAsciiDocLite('')).toBe('');
  });

  it('wraps plain text in <p>', () => {
    expect(renderAsciiDocLite('Hello world')).toBe('<p>Hello world</p>');
  });

  it('creates separate paragraphs on blank lines', () => {
    const result = renderAsciiDocLite('First\n\nSecond');
    expect(result).toContain('<p>First</p>');
    expect(result).toContain('<p>Second</p>');
  });

  it('renders headings (level + 1, h1 reserved)', () => {
    expect(renderAsciiDocLite('== Heading 2')).toContain('<h3>Heading 2</h3>');
    expect(renderAsciiDocLite('=== Heading 3')).toContain('<h4>Heading 3</h4>');
    expect(renderAsciiDocLite('===== Heading 5')).toContain('<h6>Heading 5</h6>');
  });

  it('renders bold text', () => {
    expect(renderAsciiDocLite('some *bold* text')).toContain('<strong>bold</strong>');
  });

  it('renders italic text', () => {
    expect(renderAsciiDocLite('some _italic_ text')).toContain('<em>italic</em>');
  });

  it('renders monospace text', () => {
    expect(renderAsciiDocLite('use `code` here')).toContain('<code>code</code>');
  });

  it('renders AsciiDoc links with label', () => {
    const result = renderAsciiDocLite('see https://example.com[label] here');
    expect(result).toContain('<a href="https://example.com"');
    expect(result).toContain('>label</a>');
  });

  it('renders bare URLs as links', () => {
    const result = renderAsciiDocLite('visit https://example.com now');
    expect(result).toContain('<a href="https://example.com"');
  });

  it('renders unordered lists', () => {
    const result = renderAsciiDocLite('* item one\n* item two');
    expect(result).toContain('<ul>');
    expect(result).toContain('<li');
    expect(result).toContain('item one');
    expect(result).toContain('item two');
  });

  it('renders ordered lists', () => {
    const result = renderAsciiDocLite('. first\n. second');
    expect(result).toContain('<ol>');
    expect(result).toContain('first');
    expect(result).toContain('second');
  });

  it('renders source blocks with ---- delimiter', () => {
    const result = renderAsciiDocLite('----\nlet x = 1;\n----');
    expect(result).toContain('<pre><code>');
    expect(result).toContain('let x = 1;');
  });

  it('renders source blocks with .... delimiter', () => {
    const result = renderAsciiDocLite('....\nsome text\n....');
    expect(result).toContain('<pre><code>');
    expect(result).toContain('some text');
  });

  it('escapes HTML in source blocks', () => {
    const result = renderAsciiDocLite('----\n<a href="evil">\n----');
    expect(result).toContain('&lt;a href="evil"&gt;');
    expect(result).not.toContain('<a href="evil">');
  });

  it('handles multi-line paragraphs', () => {
    const result = renderAsciiDocLite('line one\nline two\n\nnew paragraph');
    expect(result).toContain('<p>line one line two</p>');
    expect(result).toContain('<p>new paragraph</p>');
  });

  it('handles nested list levels', () => {
    const result = renderAsciiDocLite('* top\n** nested');
    expect(result).toContain('list-level-1');
    expect(result).toContain('list-level-2');
  });
});
