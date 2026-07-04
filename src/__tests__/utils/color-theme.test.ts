import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createColorTheme, type ColorPair } from '../../utils/color-theme';
import type { SiteColors } from '../../config/types';

const COLORS_JSON = JSON.parse(readFileSync(join(process.cwd(), 'data', 'colors.json'), 'utf8'));

describe('color system v2 — defaults', () => {
  it('every relationship category has both light and dark variants', () => {
    const entries = COLORS_JSON.relationshipCategory;
    for (const [key, pair] of Object.entries(entries)) {
      const p = pair as ColorPair;
      expect(p.light, `${key}.light missing`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.dark, `${key}.dark missing`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.light).not.toBe(p.dark);
    }
  });

  it('every group-kind has both light and dark variants', () => {
    const entries = COLORS_JSON.groupKind;
    for (const [key, pair] of Object.entries(entries)) {
      const p = pair as ColorPair;
      expect(p.light, `${key}.light missing`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.dark, `${key}.dark missing`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('every concept-status has both light and dark variants', () => {
    const entries = COLORS_JSON.conceptStatus;
    for (const [key, pair] of Object.entries(entries)) {
      const p = pair as ColorPair;
      expect(p.light, `${key}.light missing`).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(p.dark, `${key}.dark missing`).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('color system v2 — resolution', () => {
  it('falls back to category default when type has no override', () => {
    const theme = createColorTheme(undefined);
    const supersedes = theme.relationshipTypeColor('supersedes');
    const lifecycle = theme.relationshipCategoryColor('lifecycle');
    expect(supersedes).toEqual(lifecycle);
  });

  it('uses explicit type override when provided', () => {
    const overrides: SiteColors = {
      relationshipType: {
        supersedes: { light: '#FF0000', dark: '#FF5555' },
      },
    };
    const theme = createColorTheme(overrides);
    const result = theme.relationshipTypeColor('supersedes');
    expect(result).toEqual({ light: '#FF0000', dark: '#FF5555' });
  });

  it('uses string-form override (single hex applied to both modes)', () => {
    const overrides: SiteColors = {
      relationshipType: {
        supersedes: '#ABCDEF',
      },
    };
    const theme = createColorTheme(overrides);
    const result = theme.relationshipTypeColor('supersedes');
    expect(result).toEqual({ light: '#ABCDEF', dark: '#ABCDEF' });
  });

  it('falls back to associative category for unknown type', () => {
    const theme = createColorTheme(undefined);
    const result = theme.relationshipTypeColor('nonexistent_type');
    expect(result).toEqual(theme.relationshipCategoryColor('associative'));
  });

  it('dataset override takes precedence over declared color', () => {
    const overrides: SiteColors = {
      dataset: {
        'viml-2022': { light: '#FF0000', dark: '#FF5555' },
      },
    };
    const theme = createColorTheme(overrides);
    const declared = { light: '#0000FF', dark: '#00FF00' };
    const result = theme.datasetColor('viml-2022', declared);
    expect(result).toEqual({ light: '#FF0000', dark: '#FF5555' });
  });

  it('declared dataset color is used when no override', () => {
    const theme = createColorTheme(undefined);
    const declared = { light: '#0000FF', dark: '#00FF00' };
    const result = theme.datasetColor('viml-2022', declared);
    expect(result).toEqual(declared);
  });

  it('legacy single-hex declared color is applied to both modes', () => {
    const theme = createColorTheme(undefined);
    const result = theme.datasetColor('viml-2022', '#3366ff');
    expect(result.light).toBe('#3366ff');
    expect(result.dark).toBe('#3366ff');
  });

  it('concept status override works', () => {
    const overrides: SiteColors = {
      conceptStatus: {
        valid: '#00FF00',
      },
    };
    const theme = createColorTheme(overrides);
    const result = theme.conceptStatusColor('valid');
    expect(result).toEqual({ light: '#00FF00', dark: '#00FF00' });
  });

  it('group kind override works', () => {
    const overrides: SiteColors = {
      groupKind: {
        lineage: { light: '#111111', dark: '#222222' },
      },
    };
    const theme = createColorTheme(overrides);
    const result = theme.groupKindColor('lineage');
    expect(result).toEqual({ light: '#111111', dark: '#222222' });
  });
});

describe('color system v2 — README contract', () => {
  it('relationshipCategory defaults cover all 9 categories', () => {
    const expected = [
      'lifecycle', 'mapping', 'hierarchical', 'associative',
      'comparative', 'definitional', 'spatiotemporal', 'lexical', 'designation',
    ];
    const actual = Object.keys(COLORS_JSON.relationshipCategory);
    for (const e of expected) {
      expect(actual).toContain(e);
    }
  });

  it('groupKind defaults cover all 5 DatasetGroupKind values', () => {
    const expected = ['lineage', 'topic', 'family', 'collection', 'default'];
    const actual = Object.keys(COLORS_JSON.groupKind);
    for (const e of expected) {
      expect(actual).toContain(e);
    }
  });
});