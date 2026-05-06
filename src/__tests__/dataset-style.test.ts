import { describe, it, expect } from 'vitest';
import { makeDsStyle, paletteColor } from '../utils/dataset-style';

describe('makeDsStyle', () => {
  it('returns color, light, and dark variants', () => {
    const style = makeDsStyle('#3366ff');
    expect(style.color).toBe('#3366ff');
    expect(style.light).toMatch(/^rgba\(51, 102, 255, 0\.1\)$/);
    expect(style.dark).toMatch(/^rgba\(51, 102, 255, 0\.85\)$/);
  });

  it('light variant has alpha 0.1', () => {
    const style = makeDsStyle('#d97706');
    expect(style.light).toContain('0.1)');
  });

  it('dark variant has alpha 0.85', () => {
    const style = makeDsStyle('#d97706');
    expect(style.dark).toContain('0.85)');
  });
});

describe('paletteColor', () => {
  it('returns correct color for index 0', () => {
    expect(paletteColor(0)).toBe('#3366ff');
  });

  it('returns correct color for index 3', () => {
    expect(paletteColor(3)).toBe('#8b5cf6');
  });

  it('cycles through palette for indices beyond length', () => {
    // Palette has 12 entries (indices 0-11), so index 12 wraps to 0
    expect(paletteColor(12)).toBe(paletteColor(0));
    expect(paletteColor(13)).toBe(paletteColor(1));
  });
});
