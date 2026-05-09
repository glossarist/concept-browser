import { describe, it, expect, vi } from 'vitest';

// Mock @plurimath/plurimath for test environment
vi.mock('@plurimath/plurimath', () => {
  return {
    default: class MockPlurimath {
      private data: string;
      private format: string;
      constructor(data: string, format: string) {
        this.data = data;
        this.format = format;
      }
      toMathml() {
        return `<math xmlns="http://www.w3.org/1998/Math/MathML"><mi>${this.data}</mi></math>`;
      }
    },
  };
});

import { renderMath, cleanContent } from '../utils/math';

describe('renderMath', () => {
  it('passes through plain text unchanged', () => {
    expect(renderMath('hello world')).toBe('hello world');
  });

  it('renders stem:[x^2] to MathML span', () => {
    const result = renderMath('the value stem:[x^2]');
    expect(result).toContain('math-inline');
    expect(result).toContain('<math');
    expect(result).not.toContain('math-bold');
  });

  it('renders *stem:[x]* (bold math) with math-bold class', () => {
    const result = renderMath('the value *stem:[x]*');
    expect(result).toContain('math-inline');
    expect(result).toContain('math-bold');
  });

  it('renders latexmath:[...] with nested brackets', () => {
    const result = renderMath('coords latexmath:[[u_0, u_1] \\leq 1.0] here');
    expect(result).toContain('math-inline');
    expect(result).toContain('<math');
    expect(result).toContain('u_0');
    expect(result).not.toContain('latexmath:');
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

  it('strips latexmath:[...] with nested brackets', () => {
    expect(cleanContent('coords latexmath:[[u_0, u_1] \\leq 1.0] end')).toBe('coords [u_0, u_1] \\leq 1.0 end');
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
