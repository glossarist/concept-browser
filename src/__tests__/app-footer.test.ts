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

  it('omits hosted by when branding.hostedBy is absent', () => {
    const wrapper = mountFooter();
    expect(wrapper.text()).not.toContain('Hosted by');
  });

  it('renders hosted by with logo when branding.hostedBy is configured', async () => {
    const inline = document.createElement('script');
    inline.id = 'site-config-json';
    inline.type = 'application/json';
    inline.textContent = JSON.stringify({
      title: 'Test Site',
      branding: {
        hostedBy: {
          name: 'Enosema Foundation',
          url: 'https://www.enosema.org',
          logo: 'https://www.enosema.org/logos/logo-text-white.svg',
        },
      },
    });
    document.head.appendChild(inline);

    const { useSiteConfig } = await import('../config/use-site-config');
    await useSiteConfig().loadConfig();

    const wrapper = mountFooter();
    expect(wrapper.text()).toContain('Hosted by');
    const link = wrapper.findAll('a').find(a => a.attributes('href') === 'https://www.enosema.org');
    expect(link).toBeDefined();
    expect(link!.attributes('href')).toBe('https://www.enosema.org');
    const img = link!.find('img');
    expect(img.attributes('src')).toBe('https://www.enosema.org/logos/logo-text-white.svg');
    expect(img.attributes('alt')).toBe('Enosema Foundation');
    inline.remove();
  });

});
