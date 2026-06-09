import { describe, it, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import { createPinia, setActivePinia } from 'pinia';
import CitationDisplay from '../components/CitationDisplay.vue';
import { getFactory, resetFactory } from '../adapters/factory';
import { ReferenceResolver } from '../adapters/ReferenceResolver';

// Minimal Citation type matching the glossarist Citation interface
function makeCitation(source: string, referenceFrom: string, type = 'clause') {
  return {
    ref: { source },
    locality: { type, referenceFrom },
  };
}

describe('CitationDisplay — source reference linking', () => {
  let router: any;

  beforeEach(async () => {
    resetFactory();
    const factory = getFactory();
    // Register dataset patterns
    factory.resolver.registerDataset('vim-2012', ['urn:oiml:pub:v:2:2012*']);
    factory.resolver.registerDataset('viml-2022', ['urn:oiml:pub:v:1:2022*']);
    // Register source refs
    factory.resolver.registerSourceRef('OIML V 2-200:2012', 'vim-2012', 'urn:oiml:pub:v:2:2012');
    factory.resolver.registerSourceRef('OIML V2-200:2012', 'vim-2012', 'urn:oiml:pub:v:2:2012');
    factory.resolver.registerSourceRef('VIM', 'vim-2012', 'urn:oiml:pub:v:2:2012');

    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<div/>' } },
        { name: 'concept', path: '/dataset/:registerId/concept/:conceptId', component: { template: '<div/>' } },
      ],
    });
    await router.push('/');
    setActivePinia(createPinia());
  });

  function mountCitation(citation: any, registerId?: string) {
    return mount(CitationDisplay, {
      props: { citation, registerId },
      global: { plugins: [router] },
    });
  }

  it('renders source text as plain span when citation cannot be resolved', () => {
    const wrapper = mountCitation(makeCitation('Unknown Source', '1.1'));
    expect(wrapper.find('button.concept-link').exists()).toBe(false);
    expect(wrapper.text()).toContain('Unknown Source');
  });

  it('renders source text as clickable button when citation resolves', () => {
    const wrapper = mountCitation(makeCitation('OIML V2-200:2012', '2.2'), 'viml-2022');
    expect(wrapper.find('button.concept-link').exists()).toBe(true);
    expect(wrapper.text()).toContain('OIML V2-200:2012');
  });

  it('renders locality as clickable when citation resolves', () => {
    const wrapper = mountCitation(makeCitation('OIML V2-200:2012', '2.2'), 'viml-2022');
    expect(wrapper.text()).toContain('2.2');
    // The clause type and referenceFrom should be inside a button
    const buttons = wrapper.findAll('button.concept-link');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
  });

  it('renders locality as plain text when citation does not resolve', () => {
    const wrapper = mountCitation(makeCitation('Unknown', '1.1'));
    expect(wrapper.text()).toContain('1.1');
    expect(wrapper.find('button.concept-link').exists()).toBe(false);
  });

  it('renders nothing when citation has no ref', () => {
    const wrapper = mountCitation({ ref: null, locality: null });
    expect(wrapper.find('button').exists()).toBe(false);
  });

  it('renders ref.id when present alongside ref.source', () => {
    const wrapper = mountCitation({
      ref: { source: 'Unknown', id: 'ABC-123' },
      locality: null,
    });
    expect(wrapper.text()).toContain('ABC-123');
  });

  it('renders ref.version when present', () => {
    const wrapper = mountCitation({
      ref: { source: 'ISO 9000', version: '2015' },
      locality: null,
    });
    expect(wrapper.text()).toContain('2015');
  });

  it('shows target hint for resolved cross-dataset citation', () => {
    const wrapper = mountCitation(makeCitation('VIM', '2.2'), 'viml-2022');
    const hint = wrapper.text();
    expect(hint).toContain('→');
  });

  it('resolves via ref alias', () => {
    const wrapper = mountCitation(makeCitation('VIM', '2.2'), 'viml-2022');
    expect(wrapper.find('button.concept-link').exists()).toBe(true);
  });

  it('renders citation with both source and locality resolved', () => {
    const wrapper = mountCitation(makeCitation('OIML V 2-200:2012', '5.1'), 'viml-2022');
    expect(wrapper.find('button.concept-link').exists()).toBe(true);
    expect(wrapper.text()).toContain('OIML V 2-200:2012');
    expect(wrapper.text()).toContain('5.1');
  });

  it('shows cross-dataset arrow indicator for cross-dataset citations', () => {
    const wrapper = mountCitation(makeCitation('VIM', '2.2'), 'viml-2022');
    expect(wrapper.text()).toContain('↗');
  });

  it('does not show cross-dataset arrow for same-dataset citations', () => {
    // Same dataset: registerId matches resolved target
    const wrapper = mountCitation(makeCitation('OIML V 2-200:2012', '2.2'), 'vim-2012');
    expect(wrapper.text()).not.toContain('↗');
  });

  it('does not show cross-dataset arrow for unresolved citations', () => {
    const wrapper = mountCitation(makeCitation('Unknown', '1.1'));
    expect(wrapper.text()).not.toContain('↗');
  });

  it('renders hover preview elements for resolved citations', () => {
    const wrapper = mountCitation(makeCitation('VIM', '2.2'), 'viml-2022');
    // The component should have mouseenter handlers on the button
    const buttons = wrapper.findAll('button.concept-link');
    expect(buttons.length).toBeGreaterThanOrEqual(1);
    // Teleport content is not rendered in test env, but the template structure is present
    expect(wrapper.html()).toContain('Hover preview');
  });

  it('does not render preview elements for unresolved citations', () => {
    const wrapper = mountCitation(makeCitation('Unknown', '1.1'));
    expect(wrapper.html()).not.toContain('citation-preview');
  });
});
