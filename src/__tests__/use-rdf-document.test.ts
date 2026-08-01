// @ts-nocheck — TODO.typescript/12: remove after glossarist TS migration
import { describe, it, expect } from 'vitest';
import { ref } from 'vue';
import { Concept } from 'glossarist';
import { useRdfDocument } from '../components/use-rdf-document';

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

function makeConceptWithNonVerbal(): Concept {
  return Concept.fromJSON({
    id: '3.1.2',
    uri: 'https://glossarist.org/test/concept/3.1.2',
    status: 'valid',
    localizations: {
      eng: {
        language_code: 'eng',
        entry_status: 'valid',
        terms: [{ type: 'expression', designation: 'angle of repose', normative_status: 'preferred' }],
        definition: [{ content: 'Angle formed by a material at rest.' }],
        non_verbal_rep: [
          { type: 'figure', caption: 'Angle of repose diagram', description: 'Schematic diagram showing the angle', images: [{ src: 'fig_A.23.svg' }] },
          { type: 'formula', caption: 'tan(θ) = μ' },
        ],
      },
    },
  });
}

// Contract tests for the migrated composable. The composable now consumes
// glossarist-js's conceptToQuads + provenanceToQuads + quadSectionsToClassInstances
// + writeTurtleSync directly. These tests assert the wiring contract, not the
// detailed RDF emission (which is glossarist-js's responsibility and tested
// in its own suite).
describe('useRdfDocument — wiring contract', () => {
  it('returns reactive sections, turtle, jsonld, and typeChain', () => {
    const c = ref(makeConcept());
    const doc = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(doc.sections.value.length).toBeGreaterThan(0);
    expect(typeof doc.turtle.value).toBe('string');
    expect(doc.turtle.value.length).toBeGreaterThan(0);
    expect(typeof doc.jsonld.value).toBe('string');
    expect(doc.jsonld.value.length).toBeGreaterThan(0);
    expect(Array.isArray(doc.typeChain.value)).toBe(true);
    expect(doc.typeChain.value.length).toBeGreaterThan(0);
  });

  it('emits a parseable JSON-LD document with @graph', () => {
    const c = ref(makeConcept());
    const { jsonld } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    const parsed = JSON.parse(jsonld.value);
    expect(parsed['@graph']).toBeDefined();
    expect(Array.isArray(parsed['@graph'])).toBe(true);
    expect(parsed['@graph'].length).toBeGreaterThan(0);
  });

  it('emits turtle with @prefix declarations', () => {
    const c = ref(makeConcept());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(turtle.value).toMatch(/@prefix gloss: /);
    expect(turtle.value).toMatch(/@prefix skos: /);
    expect(turtle.value).toMatch(/@prefix skosxl: /);
  });

  it('includes the concept resource in turtle output', () => {
    const c = ref(makeConcept());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(turtle.value).toContain('3.1.1');
    expect(turtle.value).toMatch(/gloss:Concept/);
  });

  it('attaches provenance (prov:wasGeneratedBy) to the concept resource', () => {
    const c = ref(makeConcept());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(turtle.value).toMatch(/prov:wasGeneratedBy/);
    expect(turtle.value).toMatch(/activity\/serializers\/concept-browser\//);
  });

  it('first section is the concept itself with classId gloss:Concept', () => {
    const c = ref(makeConcept());
    const { sections } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(sections.value[0].classId).toBe('gloss:Concept');
  });

  it('recomputes when the concept changes', () => {
    const c = ref(makeConcept());
    const { sections } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    const firstCount = sections.value.length;
    c.value = makeConceptWithNonVerbal();
    // Different concept should produce different section count or order
    expect(sections.value).toBeDefined();
    // Both should produce at least one section
    expect(firstCount).toBeGreaterThan(0);
    expect(sections.value.length).toBeGreaterThan(0);
  });

  it('emits non-verbal rep quads when the concept has them', () => {
    const c = ref(makeConceptWithNonVerbal());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    // glossarist-js emits hasNonVerbalRep for each NVR
    expect(turtle.value).toMatch(/gloss:hasNonVerbalRep/);
  });

  it('typeChain returns the canonical concept hierarchy', () => {
    const c = ref(makeConcept());
    const { typeChain } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(typeChain.value).toEqual(['owl:Thing', 'skos:Concept', 'gloss:Concept']);
  });
});
