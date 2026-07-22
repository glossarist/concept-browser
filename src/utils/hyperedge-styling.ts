/**
 * Hyperedge styling — colors for partitive decompositions.
 *
 * Independent of relationship-categories.ts (which handles binary edges).
 * Hyperedges have their own visual language: teal base color, enumeration
 * affects opacity, markers add accent badges.
 */

const BASE_LIGHT = '#0d9488';
const BASE_DARK = '#2dd4bf';
const ACCENT_DOUBLE_LIGHT = '#3b82f6';
const ACCENT_DOUBLE_DARK = '#60a5fa';
const ACCENT_DASHED_LIGHT = '#f59e0b';
const ACCENT_DASHED_DARK = '#fbbf24';

export interface HyperedgeStyle {
  color: string;
  badgeClass: string;
  opacity: number;
}

export function hyperedgeStyle(
  enumeration: 'closed' | 'open',
  markers: string[],
  isDark: boolean,
): HyperedgeStyle {
  const base = isDark ? BASE_DARK : BASE_LIGHT;
  const opacity = enumeration === 'open' ? 0.6 : 1.0;

  let badgeClass = 'badge-teal';
  if (markers.includes('double')) {
    badgeClass = isDark ? 'badge-blue' : 'badge-blue';
  } else if (markers.includes('dashed')) {
    badgeClass = 'badge-yellow';
  }

  return { color: base, badgeClass, opacity };
}

export function markerColor(marker: string, isDark: boolean): string {
  if (marker === 'double') return isDark ? ACCENT_DOUBLE_DARK : ACCENT_DOUBLE_LIGHT;
  if (marker === 'dashed') return isDark ? ACCENT_DASHED_DARK : ACCENT_DASHED_LIGHT;
  return isDark ? BASE_DARK : BASE_LIGHT;
}

export function enumerationLabel(enumeration: 'closed' | 'open'): string {
  return enumeration === 'open' ? 'Open (partial)' : 'Closed (complete)';
}
