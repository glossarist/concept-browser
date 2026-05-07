import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('../views/HomeView.vue'),
  },
  {
    path: '/dataset/:registerId',
    name: 'dataset',
    component: () => import('../views/DatasetView.vue'),
    props: true,
  },
  {
    path: '/dataset/:registerId/concept/:conceptId',
    name: 'concept',
    component: () => import('../views/ConceptView.vue'),
    props: true,
  },
  {
    path: '/dataset/:registerId/stats',
    name: 'stats',
    component: () => import('../views/StatsView.vue'),
    props: true,
  },
  {
    path: '/dataset/:registerId/about',
    name: 'about',
    component: () => import('../views/AboutView.vue'),
    props: true,
  },
  {
    path: '/search',
    name: 'search',
    component: () => import('../views/SearchView.vue'),
  },
  {
    path: '/graph',
    name: 'graph',
    component: () => import('../views/GraphView.vue'),
  },
  {
    path: '/news',
    name: 'news',
    component: () => import('../views/NewsView.vue'),
  },
  {
    path: '/contributors',
    name: 'contributors',
    component: () => import('../views/ContributorsView.vue'),
  },
  {
    path: '/resolve/:uri(.*)',
    name: 'resolve',
    component: () => import('../views/ResolveView.vue'),
  },
  // Catch-all for custom content pages (lowest priority)
  {
    path: '/dataset/:registerId/:page',
    name: 'dataset-page',
    component: () => import('../views/PageView.vue'),
    props: true,
  },
  {
    path: '/:slug',
    name: 'page',
    component: () => import('../views/PageView.vue'),
  },
];

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
});

export default router;
