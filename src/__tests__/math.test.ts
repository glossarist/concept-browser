import { describe, it, expect } from 'vitest';
import { renderMath, cleanContent } from '../utils/math';

describe('renderMath', () => {
  it('passes through plain text unchanged', () => {
    expect(renderMath('hello world')).toBe('hello world');
  });

  it('passes through pre-rendered MathML unchanged', () => {
    const preRendered = 'value <span class="math-inline"><math><mi>x</mi></math></span> here';
    expect(renderMath(preRendered)).toBe(preRendered);
  });

  it('still converts italic in mixed pre-rendered MathML content', () => {
    const preRendered = '<span class="math-inline"><math><mi>x</mi></math></span> and *italic*';
    expect(renderMath(preRendered)).toBe(
      '<span class="math-inline"><math><mi>x</mi></math></span> and <em>italic</em>',
    );
  });

  it('converts *text* to <em> (italic) for non-pre-rendered content', () => {
    expect(renderMath('some *italic* text')).toBe('some <em>italic</em> text');
  });

  it('converts ~text~ to <sub> (subscript)', () => {
    expect(renderMath('H~2~O')).toBe('H<sub>2</sub>O');
  });

  it('converts bullet lines to <ul><li>', () => {
    const result = renderMath('* first item\n\n* second item');
    expect(result).toContain('<ul class="concept-list">');
    expect(result).toContain('<li>first item</li>');
    expect(result).toContain('<li>second item</li>');
  });

  it('converts AsciiDoc pipe-delimited tables to <table>', () => {
    const input = 'Intro text\n\n|===\n| a | b | c\n| d | e | f\n|===';
    const result = renderMath(input);
    expect(result).toContain('<table class="concept-table">');
    expect(result).toContain('<thead><tr><th>a</th><th>b</th><th>c</th></tr></thead>');
    expect(result).toContain('<tbody><tr><td>d</td><td>e</td><td>f</td></tr></tbody>');
    expect(result).not.toContain('|===');
  });

  it('resolves URN inline refs via xrefResolver', () => {
    const resolver = (uri: string, term: string) => `[${term}→${uri}]`;
    const result = renderMath(
      'a {{urn:iso:std:iso:14812:3.1.1.1,entity}} reference',
      resolver,
    );
    expect(result).toBe('a [entity→urn:iso:std:iso:14812:3.1.1.1] reference');
  });

  it('resolves single-braced URN inline refs', () => {
    const resolver = (uri: string, term: string) => `[${term}→${uri}]`;
    const result = renderMath(
      'a {urn:iso:std:iso:14812:3.1.1.1,entity} reference',
      resolver,
    );
    expect(result).toBe('a [entity→urn:iso:std:iso:14812:3.1.1.1] reference');
  });

  it('shows term without resolver', () => {
    const result = renderMath('a {{urn:iso:std:iso:14812:3.1.1.1,entity}} ref');
    expect(result).toBe('a entity ref');
  });

  it('uses display text from three-part URN refs', () => {
    const result = renderMath('a {{urn:iso:std:iso:14812:3.1.1.6,person,Person}} ref');
    expect(result).toBe('a Person ref');
  });

  it('resolves three-part URN refs with display text via xrefResolver', () => {
    const resolver = (uri: string, term: string) => `[${term}→${uri}]`;
    const result = renderMath(
      '{{urn:iso:std:iso:14812:3.1.1.6,person,Person}}, object, event',
      resolver,
    );
    expect(result).toBe('[Person→urn:iso:std:iso:14812:3.1.1.6], object, event');
  });

  it('resolves single-braced three-part URN refs', () => {
    const resolver = (uri: string, term: string) => `[${term}→${uri}]`;
    const result = renderMath(
      '{urn:iso:std:iso:14812:3.5.3.4,user,users} are people',
      resolver,
    );
    expect(result).toBe('[users→urn:iso:std:iso:14812:3.5.3.4] are people');
  });

  it('strips remaining {{...}} to just the term', () => {
    const result = renderMath('see {{some term, unknown ref}}');
    expect(result).toBe('see some term');
  });

  it('resolves cross-refs even in pre-rendered content', () => {
    const resolver = (uri: string, term: string) => `[${term}→${uri}]`;
    const preRendered = '<span class="math-inline"><math><mi>x</mi></math></span> and {{urn:iso:std:iso:14812:3.1.1.1,entity}}';
    expect(renderMath(preRendered, resolver)).toBe(
      '<span class="math-inline"><math><mi>x</mi></math></span> and [entity→urn:iso:std:iso:14812:3.1.1.1]',
    );
  });

  it('handles empty input', () => {
    expect(renderMath('')).toBe('');
  });

  it('handles null-ish input', () => {
    expect(renderMath(null as any)).toBe('');
    expect(renderMath(undefined as any)).toBe('');
  });

  // stem:[...] placeholder tests
  it('outputs math-pending placeholder for stem:[expr]', () => {
    const result = renderMath('value stem:[x^2] here');
    expect(result).toContain('class="math-pending"');
    expect(result).toContain('data-expr="x^2"');
    expect(result).toContain('data-format="asciimath"');
    expect(result).toContain('x^2');
  });

  it('outputs math-pending with math-bold for *stem:[expr]', () => {
    const result = renderMath('*stem:[alpha]');
    expect(result).toContain('class="math-pending math-bold"');
    expect(result).toContain('data-expr="alpha"');
  });

  it('outputs math-pending placeholder for latexmath:[expr]', () => {
    const result = renderMath('equation latexmath:[\\frac{a}{b}] end');
    expect(result).toContain('class="math-pending"');
    expect(result).toContain('data-expr="\\frac{a}{b}"');
    expect(result).toContain('data-format="latex"');
  });

  it('handles multiple stem: expressions in one string', () => {
    const result = renderMath('stem:[m] out of stem:[n] redundancy');
    const matches = result.match(/class="math-pending"/g);
    expect(matches).toHaveLength(2);
    expect(result).toContain('data-expr="m"');
    expect(result).toContain('data-expr="n"');
  });

  it('handles nested brackets in stem:', () => {
    const result = renderMath('stem:[a_[i]]');
    expect(result).toContain('data-expr="a_[i]"');
  });

  it('handles stem: in designation text', () => {
    const result = renderMath('stem:[n]-ary digit');
    expect(result).toContain('data-expr="n"');
    expect(result).toContain('-ary digit');
  });

  it('escapes special HTML in stem: expressions', () => {
    const result = renderMath('stem:[a<b]');
    expect(result).toContain('data-expr="a&lt;b"');
  });
});

describe('cleanContent', () => {
  it('strips pre-rendered HTML/MathML tags', () => {
    expect(cleanContent('value <span class="math-inline"><math><mi>x</mi></math></span> here'))
      .toBe('value x here');
  });

  it('strips *text* to plain text', () => {
    expect(cleanContent('some *italic* text')).toBe('some italic text');
  });

  it('converts ~text~ to _text', () => {
    expect(cleanContent('H~2~O')).toBe('H_2O');
  });

  it('strips list markers', () => {
    const result = cleanContent('items:\n* one\n* two');
    expect(result).toContain('one');
    expect(result).toContain('two');
    expect(result).not.toContain('* ');
  });

  it('strips URN refs to just the term', () => {
    expect(cleanContent('a {{urn:iso:std:iso:14812:3.1.1.1,entity}} ref')).toBe('a entity ref');
  });

  it('strips three-part URN refs to the linked term (not display text)', () => {
    expect(cleanContent('{{urn:iso:std:iso:14812:3.1.1.6,person,Person}}, object')).toBe('person, object');
  });

  it('handles empty input', () => {
    expect(cleanContent('')).toBe('');
    expect(cleanContent(null as any)).toBe('');
  });

  it('strips stem: notation to plain expression', () => {
    expect(cleanContent('stem:[x^2]')).toBe('x^2');
  });

  it('strips *stem: bold notation', () => {
    expect(cleanContent('*stem:[alpha]')).toBe('alpha');
  });

  it('strips latexmath: notation', () => {
    expect(cleanContent('latexmath:[\\frac{a}{b}]')).toBe('\\frac{a}{b}');
  });

  it('strips stem: in running text', () => {
    expect(cleanContent('value stem:[m] out of stem:[n]')).toBe('value m out of n');
  });
});
