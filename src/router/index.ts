import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router';
import { installNonVerbalScroll } from './non-verbal-scroll-guard';

export const routes: RouteRecordRaw[] = [
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
    component: () => import('../views/PageView.vue'),
    props: true,
  },
  {
    path: '/dataset/:registerId/sources',
    name: 'sources',
    component: () => import('../views/SourcesView.vue'),
    props: true,
  },
  {
    path: '/group/:groupId',
    name: 'group',
    component: () => import('../views/GroupView.vue'),
    props: true,
  },
  {
    path: '/group/:groupId/about',
    name: 'group-about',
    component: () => import('../views/PageView.vue'),
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
    path: '/ontology',
    name: 'ontology',
    component: () => import('../views/OntologySchemaView.vue'),
  },
  {
    path: '/ontology/class/:classId',
    name: 'ontology-class',
    component: () => import('../views/OntologySchemaView.vue'),
  },
  {
    path: '/ontology/taxonomy/:taxonomyKey',
    name: 'ontology-taxonomy',
    component: () => import('../views/OntologySchemaView.vue'),
  },
  {
    path: '/ontology/shape/:shapeId',
    name: 'ontology-shape',
    component: () => import('../views/OntologySchemaView.vue'),
  },
  {
    path: '/ontology/property/:propertyId',
    name: 'ontology-property',
    component: () => import('../views/OntologySchemaView.vue'),
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
    path: '/relation-types',
    name: 'relation-types',
    component: () => import('../views/RelationTypesView.vue'),
  },
  {
    path: '/about',
    name: 'about-global',
    component: () => import('../views/PageView.vue'),
  },
  {
    path: '/stats',
    name: 'stats-global',
    component: () => import('../views/StatsView.vue'),
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

installNonVerbalScroll(router);

export default router;
