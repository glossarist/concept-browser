import { describe, it, expect, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import AboutView from '../views/AboutView.vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { createTestRouter, setupPinia, makeManifest, makeAdapterStub } from './test-helpers';

const testManifest = makeManifest({
  title: 'Test Dataset',
  description: 'A test dataset for terminology',
  languages: ['eng', 'fra'],
  conceptCount: 100,
  tags: ['terminology', 'iso'],
  sourceRepo: 'https://github.com/glossarist/test-dataset',
});

describe('AboutView', () => {
  let pinia: ReturnType<typeof setupPinia>;
  let router: Awaited<ReturnType<typeof createTestRouter>>;

  beforeEach(async () => {
    pinia = setupPinia();
    router = await createTestRouter('dataset', '/dataset/test/about');
    const store = useVocabularyStore();
    store.manifests.set('test', testManifest);
    store.datasets.set('test', makeAdapterStub());
  });

  function mountAbout() {
    return mount(AboutView, {
      global: { plugins: [pinia, router] },
      props: { registerId: 'test' },
    });
  }

  it('renders About heading', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('About');
  });

  it('shows description', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('A test dataset for terminology');
  });

  it('shows owner', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('ISO');
  });

  it('shows concept count', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('100');
  });

  it('shows language count', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('English');
    expect(wrapper.text()).toContain('French');
  });

  it('shows last updated date', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('2025-01-01');
  });

  it('shows source repo link', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('glossarist/test-dataset');
  });

  it('shows tags', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('terminology');
    expect(wrapper.text()).toContain('iso');
  });

  it('renders breadcrumb navigation', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('Home');
    expect(wrapper.text()).toContain('Test Dataset');
    expect(wrapper.text()).toContain('About');
  });

  it('shows schema version', async () => {
    const wrapper = mountAbout();
    await flushPromises();
    expect(wrapper.text()).toContain('1.0');
  });
});
