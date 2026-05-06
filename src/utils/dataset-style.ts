import { useVocabularyStore } from '../stores/vocabulary';

const PALETTE = [
  '#3366ff', '#0d9488', '#d97706', '#8b5cf6',
  '#ec4899', '#059669', '#dc2626', '#6366f1',
  '#0891b2', '#65a30d', '#be185d', '#7c3aed',
];

export interface DsStyle {
  color: string;
  light: string;
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

export function useDsStyle() {
  const cache = new Map<string, DsStyle>();

  function getStyle(registerId: string): DsStyle {
    const cached = cache.get(registerId);
    if (cached) return cached;

    const store = useVocabularyStore();
    const ds = store.datasetList.find(d => d.id === registerId);
    const color = ds?.manifest.color || paletteColor(store.datasetList.findIndex(d => d.id === registerId));
    const style = makeDsStyle(color);
    cache.set(registerId, style);
    return style;
  }

  function getColor(registerId: string): string {
    return getStyle(registerId).color;
  }

  return { getStyle, getColor, paletteColor, makeDsStyle };
}
