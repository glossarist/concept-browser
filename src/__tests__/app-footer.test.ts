import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import AppFooter from '../components/AppFooter.vue';
import { createTestRouter, setupPinia } from './test-helpers';

describe('AppFooter', () => {
  let pinia: ReturnType<typeof setupPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = setupPinia();
    router = await createTestRouter('minimal', '/');
  });

  function mountFooter() {
    return mount(AppFooter, {
      global: { plugins: [pinia, router] },
    });
  }

  it('renders powered by text', () => {
    const wrapper = mountFooter();
    expect(wrapper.text()).toContain('Built with the');
    expect(wrapper.text()).toContain('Glossarist Concept Browser');
  });

  it('omits copyright when no config loaded', () => {
    const wrapper = mountFooter();
    expect(wrapper.text()).not.toContain('©');
  });

  it('defaults powered by link to glossarist.org', () => {
    const wrapper = mountFooter();
    const link = wrapper.findAll('a').find(a => a.text().includes('Glossarist Concept Browser'));
    expect(link).toBeDefined();
    expect(link!.attributes('href')).toBe('https://glossarist.org');
  });
});
