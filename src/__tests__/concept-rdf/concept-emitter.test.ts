import { describe, it, expect } from 'vitest';
import { Concept } from 'glossarist';
import { emitConceptGraph } from '../../components/concept-rdf/concept-emitter';
import { GLOSS, SKOS, SKOSXL, DCTERMS, RDF, RDFS } from '../../components/concept-rdf/predicates';
import type { RdfBlankNode, RdfLiteral, RdfIri } from '../../components/concept-rdf/rdf-graph';

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
        examples: [{ content: 'Example here.' }],
      },
    },
  });
}

describe('emitConceptGraph', () => {
  it('produces one resource per concept + localized + designation', () => {
    const { graph } = emitConceptGraph(makeConcept(), 'https://glossarist.org/test/concept/3.1.1');
    const classIds = Array.from(graph.resources()).map(r => r.classId);
    expect(classIds).toContain(GLOSS.Concept);
    expect(classIds).toContain(GLOSS.LocalizedConcept);
    expect(classIds.filter(c => c === GLOSS.Expression).length).toBe(2);
  });

  it('declares the concept resource with both gloss:Concept and skos:Concept types', () => {
    const uri = 'https://glossarist.org/test/concept/3.1.1';
    const { graph } = emitConceptGraph(makeConcept(), uri);
    const concept = graph.get(uri)!;
    expect(concept.types).toContain(GLOSS.Concept);
    expect(concept.types).toContain(SKOS.Concept);
  });

  it('emits gloss:hasLocalization as the LAST triple on the concept (UI ordering contract)', () => {
    const uri = 'https://glossarist.org/test/concept/3.1.1';
    const { graph } = emitConceptGraph(makeConcept(), uri);
    const concept = graph.get(uri)!;
    const last = concept.triples[concept.triples.length - 1];
    expect(last.predicate).toBe(GLOSS.hasLocalization);
  });

  it('emits identifiers, status, and localization on the concept', () => {
    const uri = 'https://glossarist.org/test/concept/3.1.1';
    const { graph } = emitConceptGraph(makeConcept(), uri);
    const concept = graph.get(uri)!;
    const preds = concept.triples.map(t => t.predicate);
    expect(preds).toContain(GLOSS.identifier);
    expect(preds).toContain(GLOSS.hasStatus);
    expect(preds).toContain(GLOSS.hasLocalization);
  });

  it('emits both skosxl and skos predicates for each designation', () => {
    const { graph } = emitConceptGraph(makeConcept(), 'https://glossarist.org/test/concept/3.1.1');
    const lc = graph.get('https://glossarist.org/test/concept/3.1.1/eng')!;
    const preds = lc.triples.map(t => t.predicate);
    expect(preds).toContain(SKOSXL.prefLabel);
    expect(preds).toContain(SKOS.prefLabel);
    expect(preds).toContain(SKOSXL.altLabel);
    expect(preds).toContain(SKOS.altLabel);
  });

  it('emits skos:definition with a language tag', () => {
    const { graph } = emitConceptGraph(makeConcept(), 'https://glossarist.org/test/concept/3.1.1');
    const lc = graph.get('https://glossarist.org/test/concept/3.1.1/eng')!;
    const def = lc.triples.find(t => t.predicate === SKOS.definition);
    expect(def).toBeDefined();
    expect((def!.object as any).lang).toBe('eng');
  });

  it('emits a gloss:hasDefinition blank node reifying the definition', () => {
    const { graph } = emitConceptGraph(makeConcept(), 'https://glossarist.org/test/concept/3.1.1');
    const lc = graph.get('https://glossarist.org/test/concept/3.1.1/eng')!;
    const reified = lc.triples.find(t => t.predicate === GLOSS.hasDefinition);
    expect(reified).toBeDefined();
    expect(reified!.object.kind).toBe('blank');
  });

  it('emits notes and examples as typed gloss:DetailedDefinition blanks with language tag', () => {
    const { graph } = emitConceptGraph(makeConcept(), 'https://glossarist.org/test/concept/3.1.1');
    const lc = graph.get('https://glossarist.org/test/concept/3.1.1/eng')!;
    const note = lc.triples.find(t => t.predicate === GLOSS.hasNote);
    const example = lc.triples.find(t => t.predicate === GLOSS.hasExample);
    expect(note).toBeDefined();
    expect(note!.object.kind).toBe('blank');
    const noteBlank = note!.object as any;
    expect(noteBlank.triples.some((t: any) => t.predicate === RDF.type
      && t.object.kind === 'iri' && t.object.value === GLOSS.DetailedDefinition)).toBe(true);
    expect(noteBlank.triples.some((t: any) => t.predicate === RDF.value
      && t.object.lang === 'eng')).toBe(true);
    expect(example).toBeDefined();
  });

  it('emits a designation resource per term with the right class', () => {
    const { graph } = emitConceptGraph(makeConcept(), 'https://glossarist.org/test/concept/3.1.1');
    const desig1 = graph.get('https://glossarist.org/test/concept/3.1.1/eng/desig/atomic_data_unit');
    const desig2 = graph.get('https://glossarist.org/test/concept/3.1.1/eng/desig/ADU');
    expect(desig1).toBeDefined();
    expect(desig2).toBeDefined();
    expect(desig1!.classId).toBe(GLOSS.Expression);
    expect(desig1!.types).toContain(SKOSXL.Label);
  });

  it('returns the designation URI map keyed by lang#index', () => {
    const { designationUris } = emitConceptGraph(makeConcept(), 'https://glossarist.org/test/concept/3.1.1');
    expect(designationUris.get('eng#0')).toBe('https://glossarist.org/test/concept/3.1.1/eng/desig/atomic_data_unit');
    expect(designationUris.get('eng#1')).toBe('https://glossarist.org/test/concept/3.1.1/eng/desig/ADU');
  });
});

describe('emitConceptGraph — structured source/citation (WS K6)', () => {
  function makeConceptWithSource() {
    return Concept.fromJSON({
      id: '3.1.2',
      uri: 'https://glossarist.org/test/concept/3.1.2',
      status: 'valid',
      sources: [
        {
          status: 'identical',
          type: 'authoritative',
          modification: 'revised 2024',
          origin: {
            ref: { source: 'ISO 704', id: '3.1', version: '2020' },
            locality: { type: 'clause', referenceFrom: '3.1' },
            link: 'https://example.org/iso-704',
            original: 'Original wording',
          },
        },
      ],
      localizations: {
        eng: {
          language_code: 'eng',
          entry_status: 'valid',
          terms: [{ type: 'expression', designation: 'cited term', normative_status: 'preferred' }],
          definition: [{ content: 'Definition with citation.' }],
        },
      },
    });
  }

  function firstSourceBlank(graph: any, uri: string): RdfBlankNode | undefined {
    const r = graph.get(uri)!;
    const t = r.triples.find((x: any) => x.predicate === GLOSS.hasSource);
    return t?.object?.kind === 'blank' ? (t.object as RdfBlankNode) : undefined;
  }

  it('types every source blank node as gloss:ConceptSource', () => {
    const uri = 'https://glossarist.org/test/concept/3.1.2';
    const { graph } = emitConceptGraph(makeConceptWithSource(), uri);
    const src = firstSourceBlank(graph, uri)!;
    expect(src).toBeDefined();
    const typeTriple = src.triples.find(t => t.predicate === RDF.type);
    expect((typeTriple!.object as RdfIri).value).toBe(GLOSS.ConceptSource);
  });

  it('emits the formatted bibliographic string on the nested gloss:Citation', () => {
    const uri = 'https://glossarist.org/test/concept/3.1.2';
    const { graph } = emitConceptGraph(makeConceptWithSource(), uri);
    const src = firstSourceBlank(graph, uri)!;
    const originSlot = src.triples.find(t => t.predicate === GLOSS.sourceOrigin);
    const cite = (originSlot!.object as RdfBlankNode).triples.find(t => t.predicate === DCTERMS.bibliographicCitation);
    expect(cite).toBeDefined();
    expect((cite!.object as RdfLiteral).value).toBe('ISO 704 3.1');
  });

  it('emits gloss:sourceStatus and gloss:sourceType as IRIs when present', () => {
    const uri = 'https://glossarist.org/test/concept/3.1.2';
    const { graph } = emitConceptGraph(makeConceptWithSource(), uri);
    const src = firstSourceBlank(graph, uri)!;
    const status = src.triples.find(t => t.predicate === GLOSS.sourceStatus);
    const type = src.triples.find(t => t.predicate === GLOSS.sourceType);
    expect((status!.object as RdfIri).value).toBe('gloss:srcstatus/identical');
    expect((type!.object as RdfIri).value).toBe('gloss:srctype/authoritative');
  });

  it('emits gloss:modification as a literal on the ConceptSource when modification is present', () => {
    const uri = 'https://glossarist.org/test/concept/3.1.2';
    const { graph } = emitConceptGraph(makeConceptWithSource(), uri);
    const src = firstSourceBlank(graph, uri)!;
    const mod = src.triples.find(t => t.predicate === GLOSS.modification);
    expect((mod!.object as RdfLiteral).value).toBe('revised 2024');
  });

  it('embeds a typed gloss:CitationRef with citationRefSource, citationRefId, citationRefVersion', () => {
    const uri = 'https://glossarist.org/test/concept/3.1.2';
    const { graph } = emitConceptGraph(makeConceptWithSource(), uri);
    const src = firstSourceBlank(graph, uri)!;
    const originSlot = src.triples.find(t => t.predicate === GLOSS.sourceOrigin)!;
    const cite = originSlot.object as RdfBlankNode;
    const refSlot = cite.triples.find(t => t.predicate === GLOSS.hasCitationRef)!;
    const ref = refSlot.object as RdfBlankNode;
    expect(ref.triples.find(t => t.predicate === RDF.type)?.object).toMatchObject({ kind: 'iri', value: GLOSS.CitationRef });
    expect(ref.triples.find(t => t.predicate === GLOSS.citationRefSource)?.object).toMatchObject({ kind: 'literal', value: 'ISO 704' });
    expect(ref.triples.find(t => t.predicate === GLOSS.citationRefId)?.object).toMatchObject({ kind: 'literal', value: '3.1' });
    expect(ref.triples.find(t => t.predicate === GLOSS.citationRefVersion)?.object).toMatchObject({ kind: 'literal', value: '2020' });
  });

  it('embeds a typed gloss:Locality with localityType and referenceFrom', () => {
    const uri = 'https://glossarist.org/test/concept/3.1.2';
    const { graph } = emitConceptGraph(makeConceptWithSource(), uri);
    const src = firstSourceBlank(graph, uri)!;
    const originSlot = src.triples.find(t => t.predicate === GLOSS.sourceOrigin)!;
    const cite = originSlot.object as RdfBlankNode;
    const locSlot = cite.triples.find(t => t.predicate === GLOSS.hasCitationLocality)!;
    const loc = locSlot.object as RdfBlankNode;
    expect(loc.triples.find(t => t.predicate === RDF.type)?.object).toMatchObject({ kind: 'iri', value: GLOSS.Locality });
    expect(loc.triples.find(t => t.predicate === GLOSS.localityType)?.object).toMatchObject({ kind: 'literal', value: 'clause' });
    expect(loc.triples.find(t => t.predicate === GLOSS.referenceFrom)?.object).toMatchObject({ kind: 'literal', value: '3.1' });
  });

  it('emits gloss:citationLink and gloss:citationOriginal on the nested Citation', () => {
    const uri = 'https://glossarist.org/test/concept/3.1.2';
    const { graph } = emitConceptGraph(makeConceptWithSource(), uri);
    const src = firstSourceBlank(graph, uri)!;
    const originSlot = src.triples.find(t => t.predicate === GLOSS.sourceOrigin)!;
    const cite = originSlot.object as RdfBlankNode;
    const link = cite.triples.find(t => t.predicate === GLOSS.citationLink);
    const original = cite.triples.find(t => t.predicate === GLOSS.citationOriginal);
    expect((link!.object as RdfLiteral).value).toBe('https://example.org/iso-704');
    expect((link!.object as any).datatype).toBe('xsd:anyURI');
    expect((original!.object as RdfLiteral).value).toBe('Original wording');
  });

  it('skips the source block entirely when the origin is empty', () => {
    const concept = Concept.fromJSON({
      id: '3.1.3',
      uri: 'https://glossarist.org/test/concept/3.1.3',
      status: 'valid',
      sources: [{ status: null, type: null, origin: null }],
      localizations: {
        eng: {
          language_code: 'eng',
          terms: [{ type: 'expression', designation: 'x', normative_status: 'preferred' }],
          definition: [{ content: 'def' }],
        },
      },
    });
    const uri = 'https://glossarist.org/test/concept/3.1.3';
    const { graph } = emitConceptGraph(concept, uri);
    // The type triple is always emitted, so the blank exists — but it has no citation/ref/locality.
    const r = graph.get(uri)!;
    const sourceTriples = r.triples.filter(t => t.predicate === GLOSS.hasSource);
    expect(sourceTriples).toHaveLength(1);
    const blank = sourceTriples[0].object as RdfBlankNode;
    expect(blank.triples).toHaveLength(1); // only the type triple
    expect(blank.triples[0].predicate).toBe(RDF.type);
  });
});
