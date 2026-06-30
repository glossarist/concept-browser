import { describe, it, expect } from 'vitest';
import { computed, ref, nextTick } from 'vue';
import { Concept } from 'glossarist';
import { useRdfDocument } from '../../components/concept-rdf/use-rdf-document';
import { RDF_PREFIXES, findPrefix } from '../../components/concept-rdf/rdf-prefixes';

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

describe('useRdfDocument — Turtle emission contract', () => {
  it('declares skosxl: prefix and never xl:', () => {
    const c = ref(makeConcept());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(turtle.value).toContain('@prefix skosxl: <http://www.w3.org/2008/05/skos-xl#>');
    expect(turtle.value).not.toContain('@prefix xl:');
    expect(turtle.value).not.toMatch(/\bxl:/);
  });

  it('emits BOTH skosxl:prefLabel AND skos:prefLabel', () => {
    const c = ref(makeConcept());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(turtle.value).toMatch(/skosxl:prefLabel\s+<[^>]+\/eng\/desig\//);
    expect(turtle.value).toMatch(/skos:prefLabel "atomic data unit"@eng/);
  });

  it('emits BOTH skosxl:altLabel AND skos:altLabel for admitted designations', () => {
    const c = ref(makeConcept());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(turtle.value).toMatch(/skosxl:altLabel\s+<[^>]+\/eng\/desig\//);
    expect(turtle.value).toMatch(/skos:altLabel "ADU"@eng/);
  });

  it('emits skos:definition with language tag', () => {
    const c = ref(makeConcept());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(turtle.value).toMatch(/skos:definition "A data unit that cannot be subdivided\."@eng/);
  });

  it('emits gloss:hasDefinition as a typed gloss:DetailedDefinition with rdf:value', () => {
    const c = ref(makeConcept());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(turtle.value).toMatch(/gloss:hasDefinition \[ (a|rdf:type) gloss:DetailedDefinition ; rdf:value "[^"]+"@eng \]/);
  });

  it('terminates the concept resource with a full stop (not a trailing semicolon)', () => {
    const c = ref(makeConcept());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    const block = turtle.value.split('\n\n')[1] ?? '';
    expect(block).toMatch(/<[^>]+> a gloss:Concept, skos:Concept ;[\s\S]+gloss:hasLocalization <[^>]+>/);
    expect(block).toMatch(/\.$/);
    expect(block).not.toMatch(/;\s*$/);
  });

  it('attaches provenance triples to the concept resource', () => {
    const c = ref(makeConcept());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(turtle.value).toMatch(/prov:wasGeneratedBy <activity\/serializers\/concept-browser\//);
    expect(turtle.value).toMatch(/prov:generatedAtTime "[^"]+"\^\^xsd:dateTime/);
  });
});

describe('useRdfDocument — JSON-LD emission contract', () => {
  it('produces a parseable JSON-LD document with @context and @graph', () => {
    const c = ref(makeConcept());
    const { jsonld } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    const doc = JSON.parse(jsonld.value);
    expect(doc['@context']).toBeDefined();
    expect(Array.isArray(doc['@graph'])).toBe(true);
    expect(doc['@context'].skosxl).toBe('http://www.w3.org/2008/05/skos-xl#');
  });

  it('emits the concept node and at least one localized concept', () => {
    const c = ref(makeConcept());
    const { jsonld } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    const doc = JSON.parse(jsonld.value);
    const types = doc['@graph'].map((n: any) => n['@type']);
    expect(types.some((t: any) => Array.isArray(t) && t.includes('gloss:Concept'))).toBe(true);
    expect(types.some((t: any) => Array.isArray(t) && t.includes('gloss:LocalizedConcept'))).toBe(true);
  });
});

describe('useRdfDocument — non-verbal representation emission (WS K)', () => {
  it('emits gloss:hasNonVerbalRep for image-backed NVR with canonical predicates', () => {
    const c = ref(makeConceptWithNonVerbal());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(turtle.value).toMatch(/gloss:hasNonVerbalRep \[/);
    expect(turtle.value).toMatch(/(a|rdf:type) gloss:NonVerbalRepresentation ;/);
    expect(turtle.value).toMatch(/gloss:representationType "image"/);
    expect(turtle.value).toMatch(/gloss:representationRef "fig_A\.23\.svg"\^\^xsd:anyURI/);
    expect(turtle.value).toMatch(/gloss:caption "Angle of repose diagram"@eng/);
    expect(turtle.value).toMatch(/dcterms:description "Schematic diagram showing the angle"@eng/);
  });

  it('emits formula NVR as a gloss:DetailedDefinition with rdf:value (canonical shape)', () => {
    const c = ref(makeConceptWithNonVerbal());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(turtle.value).toMatch(/gloss:hasNonVerbalRep \[[\s\S]*(a|rdf:type) gloss:DetailedDefinition ; rdf:value "tan\(θ\) = μ"@eng/);
  });

  it('emits gloss:hasNonVerbalRep array in JSON-LD', () => {
    const c = ref(makeConceptWithNonVerbal());
    const { jsonld } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    const doc = JSON.parse(jsonld.value);
    const lcNode = doc['@graph'].find((n: any) => Array.isArray(n['@type']) && n['@type'].includes('gloss:LocalizedConcept'));
    expect(lcNode).toBeDefined();
    expect(Array.isArray(lcNode['gloss:hasNonVerbalRep'])).toBe(true);
    expect(lcNode['gloss:hasNonVerbalRep']).toHaveLength(2);
    const figure = lcNode['gloss:hasNonVerbalRep'].find((n: any) => {
      const t = n['@type'];
      return Array.isArray(t) ? t.includes('gloss:NonVerbalRepresentation') : t === 'gloss:NonVerbalRepresentation';
    });
    expect(figure).toBeDefined();
    expect(figure['gloss:representationType']).toBe('image');
    expect(figure['gloss:caption']['@value']).toBe('Angle of repose diagram');
    expect(figure['dcterms:description']['@value']).toBe('Schematic diagram showing the angle');
    const refRaw = figure['gloss:representationRef'];
    const refArr = Array.isArray(refRaw) ? refRaw : [refRaw];
    expect(refArr[0]['@value']).toBe('fig_A.23.svg');
  });

  it('includes non-verbal reps in the sections view', () => {
    const c = ref(makeConceptWithNonVerbal());
    const { sections } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    const lcSection = sections.value.find(s => s.classId === 'gloss:LocalizedConcept');
    expect(lcSection).toBeDefined();
    const nvrProps = lcSection!.props.filter(p => p.predicate === 'gloss:hasNonVerbalRep');
    expect(nvrProps).toHaveLength(2);
    expect(nvrProps.some(p => p.values.some(v => v.includes('image') || v.includes('figure')))).toBe(true);
    expect(nvrProps.some(p => p.values.some(v => v.includes('formula') || v.includes('tan')))).toBe(true);
  });

  it('omits gloss:hasNonVerbalRep when the concept has no non-verbal reps', () => {
    const c = ref(makeConcept());
    const { turtle, jsonld } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(turtle.value).not.toMatch(/gloss:hasNonVerbalRep/);
    const doc = JSON.parse(jsonld.value);
    const lcNode = doc['@graph'].find((n: any) => Array.isArray(n['@type']) && n['@type'].includes('gloss:LocalizedConcept'));
    expect(lcNode['gloss:hasNonVerbalRep']).toBeUndefined();
  });
});

describe('useRdfDocument — reactivity', () => {
  it('recomputes turtle when the concept changes', async () => {
    const c = ref(makeConcept());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    const before = turtle.value;
    expect(before).toContain('atomic data unit');

    const next = Concept.fromJSON({
      id: '4.5.6',
      uri: 'https://glossarist.org/test/concept/4.5.6',
      status: 'valid',
      localizations: {
        eng: {
          language_code: 'eng',
          entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'different designation', normative_status: 'preferred' }],
          definition: [{ content: 'Different definition.' }],
        },
      },
    });
    c.value = next;
    await nextTick();
    expect(turtle.value).not.toBe(before);
    expect(turtle.value).toContain('different designation');
  });

  it('returns one section per concept + localized concept + designation', () => {
    const c = ref(makeConcept());
    const { sections } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    const labels = sections.value.map(s => s.classId);
    expect(labels).toContain('gloss:Concept');
    expect(labels).toContain('gloss:LocalizedConcept');
    expect(labels.filter(l => l === 'gloss:Expression').length).toBe(2);
  });

  it('emits a type chain ending in gloss:Concept', () => {
    const c = ref(makeConcept());
    const { typeChain } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    expect(typeChain.value[typeChain.value.length - 1]).toBe('gloss:Concept');
  });

  it('can be consumed inside another computed without re-triggering the emitter', () => {
    const c = ref(makeConcept());
    const { turtle } = useRdfDocument(() => c.value, () => c.value.uri ?? '');
    const upper = computed(() => turtle.value.split('\n').length);
    const initial = upper.value;
    expect(initial).toBeGreaterThan(5);
    // No mutation: reading upper twice doesn't recompute turtle.
    expect(upper.value).toBe(initial);
  });
});

describe('rdf-prefixes legend', () => {
  it('declares all canonical prefixes used by the emitter', () => {
    const declared = new Set(RDF_PREFIXES.map(p => p.prefix));
    for (const required of ['gloss', 'skos', 'skosxl', 'rdf', 'dcterms']) {
      expect(declared.has(required)).toBe(true);
    }
  });

  it('lookup returns the matching prefix entry', () => {
    expect(findPrefix('skosxl')?.iri).toBe('http://www.w3.org/2008/05/skos-xl#');
  });

  it('returns undefined for unknown prefixes', () => {
    expect(findPrefix('does-not-exist')).toBeUndefined();
  });

  it('skosxl prefix resolves to the canonical IRI (settlement decision)', () => {
    const skosxl = findPrefix('skosxl');
    expect(skosxl).toBeDefined();
    expect(skosxl!.iri).toBe('http://www.w3.org/2008/05/skos-xl#');
  });
});
