import { describe, it, expect, vi } from 'vitest';

// Mock @plurimath/plurimath to avoid loading the 2.7MB Opal runtime in tests
vi.mock('@plurimath/plurimath', () => ({
  default: class MockPlurimath {
    constructor(private data: string, private format: string) {}
    toMathml() {
      if (this.data === 'ERROR') throw new Error('parse error');
      return `<math xmlns="http://www.w3.org/1998/Math/MathML" display="block"><mi>${this.data}</mi></math>`;
    }
    toAsciimath() { return this.data; }
    toLatex() { return this.data; }
    toHtml() { return this.data; }
    toOmml() { return this.data; }
    toDisplay() { return this.data; }
  },
}));

import { loadPlurimath, renderToMathML, mathToHtml } from '../utils/plurimath';

describe('loadPlurimath', () => {
  it('loads and returns the Plurimath class', async () => {
    const Plurimath = await loadPlurimath();
    expect(Plurimath).toBeDefined();
    const p = new Plurimath('x', 'asciimath');
    expect(p.toMathml()).toContain('<math');
  });

  it('returns the same instance on subsequent calls', async () => {
    const a = await loadPlurimath();
    const b = await loadPlurimath();
    expect(a).toBe(b);
  });
});

describe('renderToMathML', () => {
  it('returns MathML with inline display after loading', async () => {
    await loadPlurimath();
    const result = renderToMathML('x^2', 'asciimath');
    expect(result).toContain('<math');
    expect(result).toContain('display="inline"');
    expect(result).not.toContain('display="block"');
  });

  it('returns null on parse error', async () => {
    await loadPlurimath();
    expect(renderToMathML('ERROR', 'asciimath')).toBeNull();
  });
});

describe('mathToHtml', () => {
  it('wraps MathML in math-inline span', async () => {
    await loadPlurimath();
    const result = mathToHtml('x', 'asciimath', false);
    expect(result).toContain('class="math-inline"');
    expect(result).toContain('<math');
  });

  it('adds math-bold class when bold is true', async () => {
    await loadPlurimath();
    const result = mathToHtml('x', 'asciimath', true);
    expect(result).toContain('class="math-inline math-bold"');
  });

  it('returns fallback code element on error', async () => {
    await loadPlurimath();
    const result = mathToHtml('ERROR', 'asciimath', false);
    expect(result).toContain('class="math-fallback"');
    expect(result).toContain('ERROR');
  });
});
