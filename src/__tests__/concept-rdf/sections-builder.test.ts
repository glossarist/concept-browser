import { describe, it, expect } from 'vitest';
import { buildSections } from '../../components/concept-rdf/sections-builder';
import { RdfGraph } from '../../components/concept-rdf/rdf-graph';
import type { RdfResource } from '../../components/concept-rdf/rdf-graph';
import { lit, iri, blank, triple } from '../../components/concept-rdf/rdf-graph';

function freshGraph(): RdfGraph {
  return new RdfGraph();
}

describe('buildSections', () => {
  it('produces one ClassInstance per resource', () => {
    const g = freshGraph();
    g.declare('https://ex/a', { classId: 'gloss:Concept', classLabel: 'Concept', label: 'A' });
    g.declare('https://ex/b', { classId: 'gloss:LocalizedConcept', classLabel: 'Localized', label: 'B' });

    const sections = buildSections(g);
    expect(sections).toHaveLength(2);
    expect(sections[0].classId).toBe('gloss:Concept');
    expect(sections[1].classId).toBe('gloss:LocalizedConcept');
  });

  it('carries the resource label as the section label', () => {
    const g = freshGraph();
    g.declare('https://ex/a', { label: '3.1.1', classId: 'gloss:Concept', classLabel: 'Concept' });
    const sections = buildSections(g);
    expect(sections[0].label).toBe('3.1.1');
  });

  it('produces one PropValue per triple', () => {
    const g = freshGraph();
    g.declare('https://ex/a', { classId: 'x', classLabel: 'X', label: 'a' })
      .literal('gloss:identifier', '1')
      .literal('gloss:note', 'one')
      .literal('gloss:note', 'two');

    const props = buildSections(g)[0].props;
    expect(props).toHaveLength(3);
  });

  it('marks blank node triples as nested', () => {
    const g = freshGraph();
    g.declare('https://ex/a', { classId: 'x', classLabel: 'X', label: 'a' })
      .blank('gloss:hasSource', [triple('rdf:value', lit('ISO 1'))])
      .literal('gloss:identifier', '1');

    const props = buildSections(g)[0].props;
    const sourceProp = props.find(p => p.predicate === 'gloss:hasSource')!;
    expect(sourceProp.nested).toBe(true);
    expect(sourceProp.values[0]).toContain('rdf:value');
    expect(sourceProp.values[0]).toContain('ISO 1');
  });

  it('dedupes identical predicate+value pairs within a section', () => {
    const g = freshGraph();
    g.declare('https://ex/a', { classId: 'x', classLabel: 'X', label: 'a' })
      .literal('gloss:note', 'one')
      .literal('gloss:note', 'one');

    const props = buildSections(g)[0].props;
    expect(props).toHaveLength(1);
  });

  it('keeps separate nested and non-nested entries for the same predicate', () => {
    const g = freshGraph();
    g.declare('https://ex/a', { classId: 'x', classLabel: 'X', label: 'a' })
      .literal('gloss:hasSource', 'plain string')
      .blank('gloss:hasSource', [triple('rdf:value', lit('structured'))]);

    const props = buildSections(g)[0].props;
    const sources = props.filter(p => p.predicate === 'gloss:hasSource');
    expect(sources).toHaveLength(2);
    expect(sources.some(p => p.nested === true)).toBe(true);
    expect(sources.some(p => !p.nested)).toBe(true);
  });

  it('formats IRI objects as the raw value', () => {
    const g = freshGraph();
    g.declare('https://ex/a', { classId: 'x', classLabel: 'X', label: 'a' })
      .iri('gloss:related', 'https://ex/other');

    const props = buildSections(g)[0].props;
    expect(props[0].values[0]).toBe('https://ex/other');
  });

  it('formats language-tagged literals as the bare value', () => {
    const g = freshGraph();
    g.declare('https://ex/a', { classId: 'x', classLabel: 'X', label: 'a' })
      .literal('skos:prefLabel', 'term', { lang: 'eng' });

    const props = buildSections(g)[0].props;
    expect(props[0].values[0]).toBe('term');
  });
});
