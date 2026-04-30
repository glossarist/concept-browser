import { useVocabularyStore } from '../stores/vocabulary';

/**
 * Deterministic palette for datasets. First 3 match the original colors
 * for backwards compatibility; remaining slots extend for any new dataset.
 */
const PALETTE = [
  '#3366ff', // blue — IEV
  '#0d9488', // teal — TC211
  '#d97706', // amber — TC204
  '#8b5cf6', // violet
  '#ec4899', // pink
  '#059669', // emerald
  '#dc2626', // red
  '#6366f1', // indigo
  '#0891b2', // cyan
  '#65a30d', // lime
  '#be185d', // rose
  '#7c3aed', // purple
];

export interface DsStyle {
  /** Primary color hex */
  color: string;
  /** Light tint for backgrounds (rgba) */
  light: string;
  /** Darker shade for text on light bg */
  dark: string;
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function makeDsStyle(color: string): DsStyle {
  return {
    color,
    light: hexToRgba(color, 0.1),
    dark: hexToRgba(color, 0.85),
  };
}

export function paletteColor(index: number): string {
  return PALETTE[index % PALETTE.length];
}

/**
 * Composable that resolves a dataset's style from the store.
 * Falls back to palette assignment by index when no manifest color is set.
 */
export function useDsStyle() {
  const store = useVocabularyStore();

  function getStyle(registerId: string): DsStyle {
    const ds = store.datasetList.find(d => d.id === registerId);
    const color = ds?.manifest.color || paletteColor(store.datasetList.findIndex(d => d.id === registerId));
    return makeDsStyle(color);
  }

  function getColor(registerId: string): string {
    return getStyle(registerId).color;
  }

  return { getStyle, getColor, paletteColor, makeDsStyle };
}
