import { useVocabularyStore } from '../stores/vocabulary';
import type { DatasetColorSpec } from '../config/types';
import { createColorTheme } from './color-theme';

const PALETTE = [
  '#3366ff', '#0d9488', '#d97706', '#8b5cf6',
  '#ec4899', '#059669', '#dc2626', '#6366f1',
  '#0891b2', '#65a30d', '#be185d', '#7c3aed',
];

export interface DsStyle {
  /** Single-hex backward-compat color (light mode). */
  color: string;
  /** Explicit light-mode color. */
  light: string;
  /** Explicit dark-mode color. */
  dark: string;
  /** Light-mode rgba with custom alpha. */
  lightAlpha: (a: number) => string;
  /** Dark-mode rgba with custom alpha. */
  darkAlpha: (a: number) => string;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function makeDsStyle(spec?: DatasetColorSpec, fallbackLight = '#3366ff'): DsStyle {
  const pair = normalizeSpec(spec, fallbackLight);
  return {
    color: pair.light,
    light: pair.light,
    dark: pair.dark,
    lightAlpha: (a: number) => hexToRgba(pair.light, a),
    darkAlpha: (a: number) => hexToRgba(pair.dark, a),
  };
}

function normalizeSpec(spec: DatasetColorSpec | undefined, fallback: string): { light: string; dark: string } {
  if (spec == null) {
    const dark = hexToRgba(fallback, 0.85);
    return { light: fallback, dark };
  }
  if (typeof spec === 'string') {
    const dark = hexToRgba(spec, 0.85);
    return { light: spec, dark };
  }
  return { light: spec.light, dark: spec.dark };
}

export function paletteColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

export function useDsStyle() {
  const cache = new Map<string, DsStyle>();

  function getStyle(registerId: string): DsStyle {
    const cached = cache.get(registerId);
    if (cached) return cached;

    const store = useVocabularyStore();
    const ds = store.datasetList.find(d => d.id === registerId);
    const declared = ds?.manifest?.color as DatasetColorSpec | undefined;
    const fallback = paletteColor(store.datasetList.findIndex(d => d.id === registerId));
    const style = makeDsStyle(declared, fallback);
    cache.set(registerId, style);
    return style;
  }

  function getColor(registerId: string): string {
    return getStyle(registerId).color;
  }

  return { getStyle, getColor, paletteColor, makeDsStyle };
}
