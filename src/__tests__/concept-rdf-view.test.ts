import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createRouter, createMemoryHistory } from 'vue-router';
import ConceptRdfView from '../components/ConceptRdfView.vue';
import { Concept } from 'glossarist';
import { CONCEPT_FIXTURES } from './__fixtures__/concepts';

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

async function mountFixture(uri: string, concept: Concept) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'home', component: { template: '<div/>' } }],
  });
  const wrapper = mount(ConceptRdfView, {
    global: { plugins: [createPinia(), router] },
    props: { concept, registerId: 'fixtures', conceptUriValue: uri },
  });
  await router.isReady();
  await openRdfSourcePanel(wrapper);
  return wrapper;
}

// Contract tests for the migrated view. The view delegates RDF emission
// to glossarist-js via useRdfDocument. These tests verify the view still
// renders, the panel still opens, and RDF is produced — without coupling
// to the specific turtle format details (which are tested in glossarist-js's
// own suite).
describe('ConceptRdfView — Turtle emission contract', () => {
  it('declares @prefix gloss: and skos: and skosxl:', async () => {
    const wrapper = await mountRdfView();
    await openRdfSourcePanel(wrapper);
    const text = wrapper.find('pre').text();
    expect(text).toContain('@prefix gloss: <https://www.glossarist.org/ontologies/>');
    expect(text).toContain('@prefix skos: <http://www.w3.org/2004/02/skos/core#>');
    expect(text).toContain('@prefix skosxl: <http://www.w3.org/2008/05/skos-xl#>');
  });

  it('uses skosxl: consistently (no stray xl: references)', async () => {
    const wrapper = await mountRdfView();
    await openRdfSourcePanel(wrapper);
    const text = wrapper.find('pre').text();
    expect(text).not.toMatch(/\bxl:/);
    expect(text).toContain('skosxl:Label');
    expect(text).toContain('skosxl:literalForm');
  });

  it('emits skosxl:prefLabel and skos:prefLabel both', async () => {
    const wrapper = await mountRdfView();
    await openRdfSourcePanel(wrapper);
    const text = wrapper.find('pre').text();
    // glossarist-js emits the skosxl:prefLabel link (object may be bnode or URI)
    expect(text).toMatch(/skosxl:prefLabel\s+/);
    // And the direct SKOS literal
    expect(text).toMatch(/skos:prefLabel "atomic data unit"@eng/);
  });

  it('emits skosxl:altLabel and skos:altLabel both for admitted', async () => {
    const wrapper = await mountRdfView();
    await openRdfSourcePanel(wrapper);
    const text = wrapper.find('pre').text();
    expect(text).toMatch(/skosxl:altLabel\s+/);
    expect(text).toMatch(/skos:altLabel "ADU"@eng/);
  });

  it('emits skos:definition with language tag', async () => {
    const wrapper = await mountRdfView();
    await openRdfSourcePanel(wrapper);
    const text = wrapper.find('pre').text();
    expect(text).toMatch(/skos:definition "A data unit that cannot be subdivided\."@eng/);
  });

  it('emits gloss:hasDefinition with DetailedDefinition typed resource', async () => {
    const wrapper = await mountRdfView();
    await openRdfSourcePanel(wrapper);
    const text = wrapper.find('pre').text();
    expect(text).toContain('gloss:DetailedDefinition');
    expect(text).toMatch(/rdf:value "[^"]+"@eng/);
  });
});

describe('ConceptRdfView — Layer 6 fixture corpus snapshots', () => {
  for (const fixture of CONCEPT_FIXTURES) {
    it(`${fixture.name}: mounts and renders RDF for the fixture concept`, async () => {
      const wrapper = await mountFixture(fixture.uri, fixture.concept);
      const text = wrapper.find('pre').text();
      expect(text).toContain('@prefix gloss:');
      expect(text).toContain('@prefix skos:');
      expect(text).toContain('@prefix skosxl:');
      expect(text).toContain(fixture.uri);
    });

    it(`${fixture.name}: contains at least one skos:prefLabel per localization`, async () => {
      const wrapper = await mountFixture(fixture.uri, fixture.concept);
      const text = wrapper.find('pre').text();
      for (const lang of fixture.concept.languages) {
        expect(text).toMatch(new RegExp(`skos:prefLabel "[^"]+"@${lang}`));
      }
    });
  }
});
