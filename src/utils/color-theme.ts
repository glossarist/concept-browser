/**
 * Color theme SSOT. Loads `data/colors.json` defaults and merges per-
 * deployment overrides from `site-config.json` `colors` block.
 *
 * Pure data + pure accessors — no Vue reactivity. Reactive consumption
 * is via the `useColorTheme()` composable.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { DatasetColorSpec, SiteColors } from '../config/types';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COLORS_PATH = join(__dirname, '..', '..', 'data', 'colors.json');

export interface ColorPair {
  readonly light: string;
  readonly dark: string;
}

interface ColorDefaults {
  readonly relationshipCategory: Record<string, ColorPair>;
  readonly relationshipType: Record<string, ColorPair>;
  readonly conceptStatus: Record<string, ColorPair>;
  readonly groupKind: Record<string, ColorPair>;
}

let cachedDefaults: ColorDefaults | undefined;

function loadDefaults(): ColorDefaults {
  if (cachedDefaults) return cachedDefaults;
  const raw = JSON.parse(readFileSync(COLORS_PATH, 'utf8'));
  cachedDefaults = {
    relationshipCategory: raw.relationshipCategory,
    relationshipType: raw.relationshipType,
    conceptStatus: raw.conceptStatus,
    groupKind: raw.groupKind,
  };
  return cachedDefaults!;
}

function normalize(spec: DatasetColorSpec | undefined): ColorPair | undefined {
  if (spec == null) return undefined;
  if (typeof spec === 'string') return { light: spec, dark: spec };
  return { light: spec.light, dark: spec.dark };
}

function resolvePair(
  key: string | undefined,
  overrides: Record<string, DatasetColorSpec> | undefined,
  defaults: Record<string, ColorPair>,
  fallback: ColorPair,
): ColorPair {
  if (key && overrides) {
    const ov = normalize(overrides[key]);
    if (ov) return ov;
  }
  if (key && defaults[key]) return defaults[key];
  return fallback;
}

export function createColorTheme(siteColors?: SiteColors) {
  const defaults = loadDefaults();

  function relationshipCategoryColor(categoryId: string): ColorPair {
    return resolvePair(
      categoryId,
      siteColors?.relationshipCategory,
      defaults.relationshipCategory,
      defaults.relationshipCategory.associative,
    );
  }

  function relationshipTypeColor(typeId: string, categoryId?: string): ColorPair {
    const ov = normalize(siteColors?.relationshipType?.[typeId]);
    if (ov) return ov;
    if (defaults.relationshipType[typeId]) return defaults.relationshipType[typeId];
    if (categoryId) return relationshipCategoryColor(categoryId);
    return defaults.relationshipCategory.associative;
  }

  function conceptStatusColor(statusId: string): ColorPair {
    return resolvePair(
      statusId,
      siteColors?.conceptStatus,
      defaults.conceptStatus,
      { light: '#6B6E7D', dark: '#9CA3AF' },
    );
  }

  function groupKindColor(kind: string): ColorPair {
    return resolvePair(
      kind,
      siteColors?.groupKind,
      defaults.groupKind,
      defaults.groupKind.default,
    );
  }

  function datasetColor(datasetId: string, declared?: DatasetColorSpec): ColorPair {
    const ov = normalize(siteColors?.dataset?.[datasetId]);
    if (ov) return ov;
    const declaredPair = normalize(declared);
    if (declaredPair) return declaredPair;
    return { light: '#3366ff', dark: '#60A5FA' };
  }

  function groupColor(groupId: string, declared?: DatasetColorSpec): ColorPair {
    const ov = normalize(siteColors?.group?.[groupId]);
    if (ov) return ov;
    const declaredPair = normalize(declared);
    if (declaredPair) return declaredPair;
    return groupKindColor('default');
  }

  return {
    relationshipCategoryColor,
    relationshipTypeColor,
    conceptStatusColor,
    groupKindColor,
    datasetColor,
    groupColor,
    defaults,
  };
}

export type ColorTheme = ReturnType<typeof createColorTheme>;

export const FALLBACK_COLOR_PAIR: ColorPair = { light: '#6B6E7D', dark: '#9CA3AF' };
