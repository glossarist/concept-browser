import { describe, it, expect } from 'vitest';
import {
  PAGE_TYPES,
  pageTypeOf,
  synthesizePages,
} from '../../config/page-types';

describe('page-types', () => {
  describe('PAGE_TYPES registry', () => {
    it('includes home (global index)', () => {
      expect(pageTypeOf('home')?.scope).toBe('global');
      expect(pageTypeOf('home')?.route).toBe('');
    });

    it('includes concepts (dataset index)', () => {
      expect(pageTypeOf('concepts')?.scope).toBe('dataset');
      expect(pageTypeOf('concepts')?.route).toBe('');
    });

    it('includes sources (always synthesized for datasets)', () => {
      const sources = pageTypeOf('sources');
      expect(sources?.scope).toBe('dataset');
      expect(sources?.featureFlag).toBeUndefined();
      expect(sources?.autoSynthesize).toBe(true);
    });

    it('each entry has unique type', () => {
      const types = PAGE_TYPES.map(p => p.type);
      expect(new Set(types).size).toBe(types.length);
    });

    it('each entry has unique (scope, route) for autoSynthesized', () => {
      const auto = PAGE_TYPES.filter(p => p.autoSynthesize);
      const keys = auto.map(p => `${p.scope}:${p.route}`);
      expect(new Set(keys).size).toBe(keys.length);
    });
  });

  describe('synthesizePages', () => {
    it('synthesizes global pages respecting default-on features', () => {
      const pages = synthesizePages('global', {}, new Set());
      const routes = pages.map(p => p.route);
      expect(routes).toContain('search');
      expect(routes).toContain('graph');
      expect(routes).toContain('ontology');
      expect(routes).not.toContain('news');
    });

    it('synthesizes news only when feature flag is truthy', () => {
      const without = synthesizePages('global', {}, new Set());
      const withFlag = synthesizePages('global', { news: true }, new Set());
      expect(without.find(p => p.type === 'news')).toBeUndefined();
      expect(withFlag.find(p => p.type === 'news')).toBeDefined();
    });

    it('respects feature off (search=false)', () => {
      const pages = synthesizePages('global', { search: false }, new Set());
      expect(pages.find(p => p.type === 'search')).toBeUndefined();
    });

    it('synthesizes dataset pages', () => {
      const pages = synthesizePages('dataset', {}, new Set());
      const types = pages.map(p => p.type);
      expect(types).toContain('concepts');
      expect(types).toContain('stats');
      expect(types).toContain('sources');
      expect(types).toContain('about');
    });

    it('skips routes already declared', () => {
      const pages = synthesizePages('dataset', {}, new Set(['stats']));
      expect(pages.find(p => p.type === 'stats')).toBeUndefined();
    });

    it('does not cross-contaminate scopes', () => {
      const global = synthesizePages('global', {}, new Set());
      const dataset = synthesizePages('dataset', {}, new Set());
      expect(global.find(p => p.scope === 'dataset')).toBeUndefined();
      expect(dataset.find(p => p.scope === 'global')).toBeUndefined();
    });
  });
});
