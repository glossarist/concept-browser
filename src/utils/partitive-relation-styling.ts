/**
 * Partitive relation styling — colors for one-to-many decompositions.
 *
 * Independent of relationship-categories.ts (which handles binary edges).
 * Partitive relations have their own visual language:
 *   - completeness (complete/partial) affects opacity
 *   - plurality (type-shared, uncertain) adds accent badges
 *
 * v2 redesign: replaces v1 hyperedge-styling.ts per
 * concept-model/TODO.partitive-relation-v2.
 */

import type { TypeSharedPluralityWire } from '../adapters/types';

const BASE_LIGHT = '#0d9488';
const BASE_DARK = '#2dd4bf';
const ACCENT_SHARED_LIGHT = '#3b82f6';
const ACCENT_SHARED_DARK = '#60a5fa';
const ACCENT_UNCERTAIN_LIGHT = '#f59e0b';
const ACCENT_UNCERTAIN_DARK = '#fbbf24';

export interface PartitiveRelationStyle {
  color: string;
  badgeClass: string;
  opacity: number;
}

export function partitiveRelationStyle(
  completeness: 'complete' | 'partial',
  plurality: TypeSharedPluralityWire | null,
  isDark: boolean,
): PartitiveRelationStyle {
  const base = isDark ? BASE_DARK : BASE_LIGHT;
  const opacity = completeness === 'partial' ? 0.6 : 1.0;

  let badgeClass = 'badge-teal';
  if (plurality?.isShared) {
    badgeClass = 'badge-blue';
    if (plurality.isUncertain) {
      badgeClass = 'badge-yellow';
    }
  }

  return { color: base, badgeClass, opacity };
}

export function pluralityColor(
  plurality: TypeSharedPluralityWire,
  isDark: boolean,
): string {
  if (plurality.isUncertain) return isDark ? ACCENT_UNCERTAIN_DARK : ACCENT_UNCERTAIN_LIGHT;
  if (plurality.isShared) return isDark ? ACCENT_SHARED_DARK : ACCENT_SHARED_LIGHT;
  return isDark ? BASE_DARK : BASE_LIGHT;
}

export function completenessLabel(completeness: 'complete' | 'partial'): string {
  return completeness === 'partial' ? 'Partial' : 'Complete';
}

export function certaintyLabel(certainty: 'confirmed' | 'possible'): string {
  return certainty === 'possible' ? 'Possible' : 'Confirmed';
}
