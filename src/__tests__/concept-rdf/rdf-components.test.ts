import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createRouter, createMemoryHistory } from 'vue-router';
import RdfSourcePanel from '../../components/concept-rdf/RdfSourcePanel.vue';
import RdfInstanceSection from '../../components/concept-rdf/RdfInstanceSection.vue';

function makeRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'home', component: { template: '<div/>' } }],
  });
}

async function mountPanel(props: Partial<InstanceType<typeof RdfSourcePanel>['$props']> = {}) {
  const router = makeRouter();
  const wrapper = mount(RdfSourcePanel, {
    global: { plugins: [router] },
    props: {
      turtle: '@prefix skos: <http://www.w3.org/2004/02/skos/core#> .',
      jsonld: '{"@context": {}}',
      resourceCount: 3,
      ...props,
    },
  });
  await router.isReady();
  return wrapper;
}

describe('RdfSourcePanel', () => {
  it('is collapsed by default', async () => {
    const wrapper = await mountPanel();
    expect(wrapper.find('pre').exists()).toBe(false);
    expect(wrapper.find('button.w-full').attributes('aria-expanded')).toBe('false');
  });

  it('reveals the <pre> on click and applies dir="auto" for RTL safety', async () => {
    const wrapper = await mountPanel();
    await wrapper.find('button.w-full').trigger('click');
    const pre = wrapper.find('pre');
    expect(pre.exists()).toBe(true);
    expect(pre.attributes('dir')).toBe('auto');
  });

  it('defaults to Turtle when no defaultFormat is provided', async () => {
    const wrapper = await mountPanel();
    await wrapper.find('button.w-full').trigger('click');
    expect(wrapper.find('pre').text()).toContain('@prefix skos:');
  });

  it('switches to JSON-LD when the select changes', async () => {
    const wrapper = await mountPanel();
    await wrapper.find('button.w-full').trigger('click');
    await wrapper.find('select').setValue('jsonld');
    expect(wrapper.find('pre').text()).toContain('"@context"');
  });

  it('emits format-change when the user picks a format', async () => {
    const wrapper = await mountPanel();
    await wrapper.find('select').setValue('jsonld');
    const events = wrapper.emitted('format-change');
    expect(events).toBeDefined();
    expect(events![0]).toEqual(['jsonld']);
  });

  it('shows the resource count', async () => {
    const wrapper = await mountPanel({ resourceCount: 42 });
    expect(wrapper.text()).toContain('42 resources');
  });

  it('exposes the prefix legend inline once expanded', async () => {
    const wrapper = await mountPanel();
    await wrapper.find('button.w-full').trigger('click');
    expect(wrapper.text()).toContain('Prefixes');
  });
});

describe('RdfInstanceSection', () => {
  function makeSection(classId: string, label: string, props: Record<string, string[]>[]) {
    return {
      classId,
      classLabel: classId.replace('gloss:', ''),
      label,
      props: props.map(p => ({
        predicate: Object.keys(p)[0],
        values: Object.values(p)[0],
      })),
    };
  }

  it('renders the class id as a router-link', () => {
    const router = makeRouter();
    const wrapper = mount(RdfInstanceSection, {
      global: { plugins: [router] },
      props: { section: makeSection('gloss:Concept', '3.1.1', [{ 'gloss:identifier': ['3.1.1'] }]) },
    });
    const link = wrapper.find('a');
    expect(link.attributes('href')).toContain('/ontology/class/gloss-Concept');
  });

  it('renders a blue accent for gloss:Concept', () => {
    const router = makeRouter();
    const wrapper = mount(RdfInstanceSection, {
      global: { plugins: [router] },
      props: { section: makeSection('gloss:Concept', '3.1.1', []) },
    });
    expect(wrapper.find('div.w-1').classes()).toContain('bg-blue-500');
  });

  it('renders an emerald accent for gloss:LocalizedConcept', () => {
    const router = makeRouter();
    const wrapper = mount(RdfInstanceSection, {
      global: { plugins: [router] },
      props: { section: makeSection('gloss:LocalizedConcept', 'eng', []) },
    });
    expect(wrapper.find('div.w-1').classes()).toContain('bg-emerald-500');
  });

  it('renders an amber accent for designations', () => {
    const router = makeRouter();
    const wrapper = mount(RdfInstanceSection, {
      global: { plugins: [router] },
      props: { section: makeSection('gloss:Expression', 'ADU', []) },
    });
    expect(wrapper.find('div.w-1').classes()).toContain('bg-amber-500');
  });

  it('renders nested values with the nested style', () => {
    const router = makeRouter();
    const wrapper = mount(RdfInstanceSection, {
      global: { plugins: [router] },
      props: {
        section: {
          classId: 'gloss:Concept',
          classLabel: 'Concept',
          label: '3.1.1',
          props: [{ predicate: 'gloss:hasSource', values: ['ISO 704:2020'], nested: true }],
        },
      },
    });
    const spans = wrapper.findAll('span');
    const nested = spans.filter(s => s.classes().includes('border-l-2'));
    expect(nested.length).toBe(1);
    expect(nested[0].text()).toContain('ISO 704:2020');
  });
});
