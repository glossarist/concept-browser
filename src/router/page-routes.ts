import type { RouteRecordRaw } from 'vue-router';
import type { PageConfig } from '../config/types';

const pageComponents: Record<string, () => Promise<any>> = {
  news: () => import('../views/NewsView.vue'),
  contributors: () => import('../views/ContributorsView.vue'),
  about: () => import('../views/AboutView.vue'),
  stats: () => import('../views/StatsView.vue'),
};

export function buildPageRoutes(pages: PageConfig[]): RouteRecordRaw[] {
  const routes: RouteRecordRaw[] = [];

  for (const page of pages) {
    const component = pageComponents[page.type];
    if (!component) continue;

    if (page.datasetScoped) {
      routes.push({
        path: `/dataset/:registerId/${page.route}`,
        name: page.route,
        component,
        props: true,
      });
    } else {
      routes.push({
        path: `/${page.route}`,
        name: page.route,
        component,
      });
    }
  }

  return routes;
}
