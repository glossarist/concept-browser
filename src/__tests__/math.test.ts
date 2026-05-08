import { describe, it, expect } from 'vitest';
import { renderMath, cleanContent } from '../utils/math';

describe('renderMath', () => {
  it('passes through plain text unchanged', () => {
    expect(renderMath('hello world')).toBe('hello world');
  });

  it('renders stem:[x^2] to KaTeX span', () => {
    const result = renderMath('the value stem:[x^2]');
    expect(result).toContain('math-inline');
    expect(result).toContain('katex');
    expect(result).not.toContain('math-bold');
  });

  it('renders *stem:[x]* (bold math) with math-bold class', () => {
    const result = renderMath('the value *stem:[x]*');
    expect(result).toContain('math-inline');
    expect(result).toContain('math-bold');
  });

  it('converts bullet lines to <ul><li>', () => {
    const result = renderMath('* first item\n\n* second item');
    expect(result).toContain('<ul class="concept-list">');
    expect(result).toContain('<li>first item</li>');
    expect(result).toContain('<li>second item</li>');
  });

  it('does NOT convert *stem:[...] lines to list items', () => {
    const result = renderMath('*stem:[x]*');
    expect(result).not.toContain('<ul');
    expect(result).toContain('math-bold');
  });

  it('converts *text* to <em> (italic)', () => {
    expect(renderMath('some *italic* text')).toBe('some <em>italic</em> text');
  });

  it('converts ~text~ to <sub> (subscript)', () => {
    expect(renderMath('H~2~O')).toBe('H<sub>2</sub>O');
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

  it('handles empty input', () => {
    expect(renderMath('')).toBe('');
  });

  it('handles null-ish input', () => {
    expect(renderMath(null as any)).toBe('');
    expect(renderMath(undefined as any)).toBe('');
  });
});

describe('cleanContent', () => {
  it('strips stem:[...] to raw math text', () => {
    expect(cleanContent('value stem:[x^2] here')).toBe('value x^2 here');
  });

  it('strips bold stem', () => {
    expect(cleanContent('value *stem:[x]* here')).toBe('value x here');
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
