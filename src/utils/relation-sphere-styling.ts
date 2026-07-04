/**
 * Relation sphere styling — bridge between the project's semantic SSOTs
 * (taxonomy + color-theme) and the visual encoding the sphere needs.
 *
 * Single source: taxonomy drives category/type identity.
 * Color-theme drives light/dark color pairs.
 * This module adds only the sphere-specific concern: dasharray patterns.
 */
import {
  RELATIONSHIP_CATEGORIES,
  categorizeRelationship,
  relationshipLabel,
} from './relationship-categories';
import { colorPairForType, colorPairForCategory, type ColorPair } from './color-theme-integration';

export interface SphereRelationCategory {
  readonly key: string;
  readonly label: string;
  readonly color: string;
  readonly dasharray: string;
}

/** Dasharray per category — sphere-specific visual encoding. Sourced
 *  from colors.json `relationshipCategoryDash` block (added in #14). */
const DASHARRAY: Record<string, string> = {
  lifecycle:      'none',
  mapping:        '1 2',
  hierarchical:   '6 3 1 3',
  associative:    'none',
  comparative:    '2 2',
  definitional:   '8 4',
  spatiotemporal: '4 2 1 2',
  lexical:        '3 1',
  designation:    '1 3',
};

/** Build the sphere-category list from the taxonomy SSOT. */
export const SPHERE_RELATION_CATEGORIES: readonly SphereRelationCategory[] =
  RELATIONSHIP_CATEGORIES.map(cat => ({
    key: cat.id,
    label: cat.label,
    color: colorPairForCategory(cat.id).light,
    dasharray: DASHARRAY[cat.id] ?? 'none',
  }));

export function categorizeRelationForSphere(type: string): string {
  return categorizeRelationship(type).id;
}

export function sphereCategoryForType(type: string): SphereRelationCategory {
  const cat = categorizeRelationship(type);
  return SPHERE_RELATION_CATEGORIES.find(c => c.key === cat.id)
    ?? SPHERE_RELATION_CATEGORIES[3];
}

export function colorForTypeInMode(type: string, isDark: boolean): string {
  const pair = colorPairForType(type);
  return isDark ? pair.dark : pair.light;
}

export function relationLabel(type: string): string {
  return relationshipLabel(type);
}
