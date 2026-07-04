/**
 * useColorTheme — emits CSS custom properties for every colorable
 * semantic category, scoped per dataset/group via [data-ds] / [data-group]
 * attribute selectors.
 *
 * Components consume via `var(--rel-lifecycle-light)` etc. Theme
 * switching is a single class swap on `<html>` — no JS recompute.
 */
import { watchEffect, onScopeDispose } from 'vue';
import { useSiteConfig } from '../config/use-site-config';
import { useVocabularyStore } from '../stores/vocabulary';
import { createColorTheme, type ColorPair } from '../utils/color-theme';
import type { DatasetColorSpec } from '../config/types';

function kebab(s: string): string {
  return s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase().replace(/[^a-z0-9-]/g, '-');
}

function setVar(root: HTMLElement, name: string, value: string): void {
  root.style.setProperty(name, value);
}

function emitPair(root: HTMLElement, prefix: string, key: string, pair: ColorPair): void {
  const safeKey = kebab(key);
  setVar(root, `--${prefix}-${safeKey}-light`, pair.light);
  setVar(root, `--${prefix}-${safeKey}-dark`, pair.dark);
}

export function useColorTheme(): void {
  const { config } = useSiteConfig();
  const store = useVocabularyStore();

  const disposers: Array<() => void> = [];

  watchEffect(() => {
    const siteColors = config.value?.colors;
    const theme = createColorTheme(siteColors);
    const root = document.documentElement;

    /* Global category + type colors — emit on :root */
    for (const cat of Object.keys(theme.defaults.relationshipCategory)) {
      emitPair(root, 'rel-cat', cat, theme.relationshipCategoryColor(cat));
    }
    for (const type of Object.keys(theme.defaults.relationshipType)) {
      emitPair(root, 'rel-type', type, theme.relationshipTypeColor(type));
    }
    for (const status of Object.keys(theme.defaults.conceptStatus)) {
      emitPair(root, 'concept-status', status, theme.conceptStatusColor(status));
    }
    for (const kind of Object.keys(theme.defaults.groupKind)) {
      emitPair(root, 'group-kind', kind, theme.groupKindColor(kind));
    }
  });

  /* Per-dataset colors — emit on [data-ds="<id>"] scoped wrappers.
     Uses a stable wrapper element so the variables don't leak globally. */
  watchEffect(() => {
    const siteColors = config.value?.colors;
    const theme = createColorTheme(siteColors);

    for (const ds of store.datasetList) {
      const declared = ds.manifest?.color as DatasetColorSpec | undefined;
      const pair = theme.datasetColor(ds.id, declared);
      const scopeId = `ds-color-scope-${ds.id.replace(/[^a-zA-Z0-9]/g, '_')}`;
      let scope = document.getElementById(scopeId);
      if (!scope) {
        scope = document.createElement('div');
        scope.id = scopeId;
        scope.setAttribute('data-ds', ds.id);
        scope.style.display = 'none';
        document.head.appendChild(scope);
        disposers.push(() => scope?.remove());
      }
      setVar(scope, '--ds-light', pair.light);
      setVar(scope, '--ds-dark', pair.dark);
    }
  });

  onScopeDispose(() => {
    for (const dispose of disposers) dispose();
  });
}
