import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock plurimath module before importing v-math
vi.mock('../utils/plurimath', () => ({
  loadPlurimath: vi.fn(() => {
    // Simulate loading — resolve immediately
    return Promise.resolve(MockPlurimath);
  }),
  mathToHtml: vi.fn((expr: string, format: string, bold: boolean) => {
    if (expr === 'SKIP') return `<code class="math-fallback">${expr}</code>`;
    return `<span class="math-inline${bold ? ' math-bold' : ''}"><math><mi>${expr}</mi></math></span>`;
  }),
}));

class MockPlurimath {
  constructor() {}
}

import { vMath } from '../directives/v-math';
import { loadPlurimath, mathToHtml } from '../utils/plurimath';

const directive = vMath as import('vue').ObjectDirective<HTMLElement>;

describe('v-math directive', () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    vi.clearAllMocks();
  });

  it('does nothing when no math-pending elements exist', () => {
    container.innerHTML = '<p>plain text</p>';
    directive.mounted!(container, {} as any, {} as any, {} as any);
    expect(container.innerHTML).toBe('<p>plain text</p>');
  });

  it('triggers loadPlurimath when math-pending elements exist', async () => {
    container.innerHTML = '<span class="math-pending" data-expr="x^2" data-format="asciimath">x^2</span>';
    directive.mounted!(container, {} as any, {} as any, {} as any);
    expect(loadPlurimath).toHaveBeenCalled();
  });

  it('replaces math-pending elements after loading', async () => {
    container.innerHTML = '<span class="math-pending" data-expr="x^2" data-format="asciimath">x^2</span>';
    directive.mounted!(container, {} as any, {} as any, {} as any);

    await vi.waitFor(() => {
      expect(mathToHtml).toHaveBeenCalledWith('x^2', 'asciimath', false);
    });
  });

  it('handles bold math-pending elements', async () => {
    container.innerHTML = '<span class="math-pending math-bold" data-expr="alpha" data-format="asciimath">alpha</span>';
    directive.mounted!(container, {} as any, {} as any, {} as any);

    await vi.waitFor(() => {
      expect(mathToHtml).toHaveBeenCalledWith('alpha', 'asciimath', true);
    });
  });

  it('skips elements without data-expr', async () => {
    container.innerHTML = '<span class="math-pending">no expr</span>';
    directive.mounted!(container, {} as any, {} as any, {} as any);

    await vi.waitFor(() => {
      expect(mathToHtml).not.toHaveBeenCalled();
    });
  });

  it('uses default format asciimath when data-format is missing', async () => {
    container.innerHTML = '<span class="math-pending" data-expr="x">x</span>';
    directive.mounted!(container, {} as any, {} as any, {} as any);

    await vi.waitFor(() => {
      expect(mathToHtml).toHaveBeenCalledWith('x', 'asciimath', false);
    });
  });
});
