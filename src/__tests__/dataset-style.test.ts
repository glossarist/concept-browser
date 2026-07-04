import { describe, it, expect } from 'vitest';
import { makeDsStyle, paletteColor } from '../utils/dataset-style';

describe('makeDsStyle', () => {
  it('returns color, light, and dark variants', () => {
    const style = makeDsStyle('#3366ff');
    expect(style.color).toBe('#3366ff');
    expect(style.light).toBe('#3366ff');
    expect(style.dark).toMatch(/^rgba\(51, 102, 255, 0\.85\)$/);
  });

  it('lightAlpha produces rgba with the given alpha', () => {
    const style = makeDsStyle('#d97706');
    expect(style.lightAlpha(0.1)).toContain('0.1)');
  });

  it('darkAlpha produces rgba with the given alpha', () => {
    const style = makeDsStyle('#d97706');
    expect(style.darkAlpha(0.85)).toContain('0.85)');
  });

  it('accepts { light, dark } color spec', () => {
    const style = makeDsStyle({ light: '#FF0000', dark: '#FF5555' });
    expect(style.light).toBe('#FF0000');
    expect(style.dark).toBe('#FF5555');
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
    expect(paletteColor(12)).toBe(paletteColor(0));
    expect(paletteColor(13)).toBe(paletteColor(1));
  });
});