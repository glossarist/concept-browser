import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import LearnIndexView from '../../../views/learn/LearnIndexView.vue';

async function makeRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/learn', name: 'learn', component: LearnIndexView },
      { path: '/learn/relationships', name: 'learn-relationships', component: { template: '<div/>' } },
      { path: '/learn/designations', name: 'learn-designations', component: { template: '<div/>' } },
      { path: '/learn/statuses', name: 'learn-statuses', component: { template: '<div/>' } },
    ],
  });
  await router.push('/learn');
  await router.isReady();
  return router;
}

describe('LearnIndexView', () => {
  beforeEach(() => setActivePinia(createPinia()));

  it('renders the page header with translated title', async () => {
    const router = await makeRouter();
    const w = mount(LearnIndexView, { global: { plugins: [router] } });
    expect(w.find('h1').text()).toContain('Learn');
  });

  it('renders exactly 3 topic cards for Phase 1', async () => {
    const router = await makeRouter();
    const w = mount(LearnIndexView, { global: { plugins: [router] } });
    /* Each RouterLink wraps a LearnCard. Phase 1 = 3 topics. */
    expect(w.findAllComponents({ name: 'LearnCard' }).length).toBe(3);
  });

  it('each topic card links to one of the Phase 1 routes', async () => {
    const router = await makeRouter();
    const w = mount(LearnIndexView, { global: { plugins: [router] } });
    const links = w.findAll('a').map(a => a.attributes('href'));
    expect(links).toEqual(expect.arrayContaining(['/learn/relationships', '/learn/designations', '/learn/statuses']));
  });
});
