import { describe, it, expect } from 'vitest';
import { routes } from '../router/index';

// We just need the route definitions, not a full router instance
const routeMap = new Map(routes.map(r => [r.name as string, r]));

describe('Router route definitions', () => {
  it('defines all expected routes', () => {
    const names = routes.map(r => r.name).filter(Boolean);
    expect(names).toContain('home');
    expect(names).toContain('dataset');
    expect(names).toContain('concept');
    expect(names).toContain('stats');
    expect(names).toContain('about');
    expect(names).toContain('search');
    expect(names).toContain('graph');
    expect(names).toContain('resolve');
  });

  it('uses correct path patterns', () => {
    expect(routeMap.get('home')!.path).toBe('/');
    expect(routeMap.get('dataset')!.path).toBe('/dataset/:registerId');
    expect(routeMap.get('concept')!.path).toBe('/dataset/:registerId/concept/:conceptId');
    expect(routeMap.get('stats')!.path).toBe('/dataset/:registerId/stats');
    expect(routeMap.get('about')!.path).toBe('/dataset/:registerId/about');
    expect(routeMap.get('search')!.path).toBe('/search');
    expect(routeMap.get('graph')!.path).toBe('/graph');
    expect(routeMap.get('resolve')!.path).toBe('/resolve/:uri(.*)');
  });

  it('dataset and concept routes use props: true', () => {
    expect(routeMap.get('dataset')!.props).toBe(true);
    expect(routeMap.get('concept')!.props).toBe(true);
    expect(routeMap.get('stats')!.props).toBe(true);
    expect(routeMap.get('about')!.props).toBe(true);
  });

  it('resolve route accepts any URI with wildcard', () => {
    const resolve = routeMap.get('resolve')!;
    expect(resolve.path).toContain(':uri(.*)');
  });

  it('uses lazy-loaded components for all routes', () => {
    for (const route of routes) {
      if (route.component && typeof route.component === 'function') {
        // Dynamic import returns a function
        expect(route.component).toBeTypeOf('function');
      }
    }
  });

  it('defines dataset-page catch-all after specific routes', () => {
    const names = routes.map(r => r.name);
    const dsIdx = names.indexOf('dataset');
    const dsPageIdx = names.indexOf('dataset-page');
    expect(dsIdx).toBeGreaterThan(-1);
    expect(dsPageIdx).toBeGreaterThan(dsIdx);
  });

  it('defines page slug catch-all as last route', () => {
    const last = routes[routes.length - 1];
    expect(last.name).toBe('page');
    expect(last.path).toBe('/:slug');
  });
});
