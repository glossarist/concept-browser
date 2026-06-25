import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import ConceptRdfView from '../components/ConceptRdfView.vue';
import { Concept } from 'glossarist';

function makeConcept(): Concept {
  return Concept.fromJSON({
    id: '3.1.1',
    uri: 'https://glossarist.org/test/concept/3.1.1',
    status: 'valid',
    localizations: {
      eng: {
        language_code: 'eng',
        entry_status: 'valid',
        terms: [
          { type: 'expression', designation: 'atomic data unit', normative_status: 'preferred' },
          { type: 'expression', designation: 'ADU', normative_status: 'admitted' },
        ],
        definition: [{ content: 'A data unit that cannot be subdivided.' }],
        notes: [{ content: 'Note here.' }],
      },
    },
  });
}

async function mountRdfView() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'home', component: { template: '<div/>' } }],
  });
  const wrapper = mount(ConceptRdfView, {
    global: {
      plugins: [createPinia(), router],
    },
    props: {
      concept: makeConcept(),
      registerId: 'test',
      conceptUriValue: 'https://glossarist.org/test/concept/3.1.1',
    },
  });
  await router.isReady();
  return wrapper;
}

async function openRdfSourcePanel(wrapper: ReturnType<typeof mount>) {
  const toggle = wrapper.find('button.w-full');
  await toggle.trigger('click');
}

describe('ConceptRdfView — Turtle emission', () => {
  it('declares the skosxl: prefix (not xl:)', async () => {
    const wrapper = await mountRdfView();
    await openRdfSourcePanel(wrapper);
    const pre = wrapper.find('pre');
    const text = pre.text();
    expect(text).toContain('@prefix skosxl: <http://www.w3.org/2008/05/skos-xl#>');
    expect(text).not.toContain('@prefix xl:');
  });

  it('uses skosxl: consistently (no stray xl: references)', async () => {
    const wrapper = await mountRdfView();
    await openRdfSourcePanel(wrapper);
    const text = wrapper.find('pre').text();
    expect(text).not.toMatch(/\bxl:/);
    expect(text).toContain('skosxl:Label');
    expect(text).toContain('skosxl:literalForm');
  });

  it('emits BOTH skosxl:prefLabel (reified) AND skos:prefLabel (direct literal)', async () => {
    const wrapper = await mountRdfView();
    await openRdfSourcePanel(wrapper);
    const text = wrapper.find('pre').text();
    expect(text).toMatch(/skosxl:prefLabel\s+<[^>]+\/eng\/desig\//);
    expect(text).toMatch(/skos:prefLabel "atomic data unit"@eng/);
  });

  it('emits BOTH skosxl:altLabel AND skos:altLabel for non-preferred designations', async () => {
    const wrapper = await mountRdfView();
    await openRdfSourcePanel(wrapper);
    const text = wrapper.find('pre').text();
    expect(text).toMatch(/skosxl:altLabel\s+<[^>]+\/eng\/desig\//);
    expect(text).toMatch(/skos:altLabel "ADU"@eng/);
  });

  it('emits skos:definition as a direct language-tagged literal', async () => {
    const wrapper = await mountRdfView();
    await openRdfSourcePanel(wrapper);
    const text = wrapper.find('pre').text();
    expect(text).toMatch(/skos:definition "A data unit that cannot be subdivided\."@eng/);
  });

  it('emits gloss:hasDefinition with a language tag on the nested rdf:value', async () => {
    const wrapper = await mountRdfView();
    await openRdfSourcePanel(wrapper);
    const text = wrapper.find('pre').text();
    expect(text).toMatch(/gloss:hasDefinition \[ rdf:value "[^"]+"@eng \]/);
  });
});
