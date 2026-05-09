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
});
