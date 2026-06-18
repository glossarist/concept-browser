import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import type { NonVerbRep } from 'glossarist';
import NonVerbalRepDisplay from '../components/NonVerbalRepDisplay.vue';
import { resetFactory } from '../adapters/factory';

// glossarist-js's published `.d.ts` declares NonVerbRep's constructor with 0
// args, but the V3 runtime accepts a plain-data initializer. Cast through
// `unknown` at this boundary. See TODO.figures/19.
function makeRep(data: Record<string, unknown>): NonVerbRep {
  return data as unknown as NonVerbRep;
}

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'home', component: { template: '<div/>' } },
      { path: '/dataset/:registerId/concept/:conceptId', name: 'concept', component: { template: '<div/>' } },
    ],
  });
}

describe('NonVerbalRepDisplay.vue — V3 shape', () => {
  beforeEach(() => {
    resetFactory();
    setActivePinia(createPinia());
  });

  it('renders nothing when reps is empty', () => {
    const wrapper = mount(NonVerbalRepDisplay, {
      props: { reps: [], locale: 'eng', registerId: 'ds' },
    });
    expect(wrapper.find('.section-label').exists()).toBe(false);
  });

  it('renders a figure per rep', () => {
    const rep = makeRep({
      type: 'photograph',
      images: [{ src: 'fig.png', format: 'png' }],
      alt: { eng: 'A diagram' },
    });
    const wrapper = mount(NonVerbalRepDisplay, {
      props: { reps: [rep], locale: 'eng', registerId: 'ds' },
    });
    expect(wrapper.findAll('figure').length).toBe(1);
    expect(wrapper.text()).toContain('photograph');
  });

  it('renders the localized caption when present', () => {
    const rep = makeRep({
      type: 'photo',
      caption: { eng: 'Figure 1' },
    });
    const wrapper = mount(NonVerbalRepDisplay, {
      props: { reps: [rep], locale: 'eng', registerId: 'ds' },
    });
    expect(wrapper.text()).toContain('Figure 1');
  });

  it('renders sources when present', async () => {
    const rep = makeRep({
      type: 'photo',
      sources: [
        {
          type: 'authoritative',
          origin: {
            ref: { source: 'ISO 123' },
            locality: { type: 'clause', referenceFrom: '1.2' },
          },
        },
      ],
    });
    const router = makeRouter();
    await router.push('/');
    const wrapper = mount(NonVerbalRepDisplay, {
      props: { reps: [rep], locale: 'eng', registerId: 'ds' },
      global: { plugins: [router] },
    });
    expect(wrapper.text()).toContain('Sources');
    expect(wrapper.text()).toContain('ISO 123');
  });
});
