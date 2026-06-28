import { describe, it, expect } from 'vitest';
import { RdfGraph } from '../../components/concept-rdf/rdf-graph';
import { PROV, DCTERMS } from '../../components/concept-rdf/predicates';
import {
  decorateWithProvenance,
  activityUri,
  runtimeProvenance,
  SERIALIZER_TOOL_ID,
  type ProvenanceOptions,
} from '../../components/concept-rdf/provenance';

const SUBJECT = 'https://glossarist.org/test/concept/1';

function opts(over: Partial<ProvenanceOptions> = {}): ProvenanceOptions {
  return {
    toolId: SERIALIZER_TOOL_ID,
    toolVersion: '0.0.0-test',
    generatedAt: '2026-06-27T00:00:00.000Z',
    canonicalUri: undefined,
    ...over,
  };
}

describe('activityUri', () => {
  it('produces an activity/serializers/<tool>/<version> IRI', () => {
    expect(activityUri(opts())).toBe('activity/serializers/concept-browser/0.0.0-test');
  });

  it('reflects toolId and toolVersion verbatim', () => {
    expect(activityUri(opts({ toolId: 'ruby-gem', toolVersion: '1.2.3' })))
      .toBe('activity/serializers/ruby-gem/1.2.3');
  });
});

describe('decorateWithProvenance', () => {
  it('attaches prov:wasGeneratedBy pointing at the activity IRI', () => {
    const g = new RdfGraph();
    decorateWithProvenance(g, SUBJECT, opts());
    const r = g.get(SUBJECT)!;
    const objs = r.triples.filter(t => t.predicate === PROV.wasGeneratedBy).map(t => t.object);
    expect(objs).toHaveLength(1);
    expect(objs[0].kind).toBe('iri');
    if (objs[0].kind === 'iri') {
      expect(objs[0].value).toBe('activity/serializers/concept-browser/0.0.0-test');
    }
  });

  it('attaches prov:generatedAtTime as an xsd:dateTime literal', () => {
    const g = new RdfGraph();
    decorateWithProvenance(g, SUBJECT, opts());
    const r = g.get(SUBJECT)!;
    const ts = r.triples.filter(t => t.predicate === PROV.generatedAtTime).map(t => t.object);
    expect(ts).toHaveLength(1);
    expect(ts[0]).toMatchObject({
      kind: 'literal',
      value: '2026-06-27T00:00:00.000Z',
      datatype: 'xsd:dateTime',
    });
  });

  it('declares the activity as a prov:Activity resource', () => {
    const g = new RdfGraph();
    decorateWithProvenance(g, SUBJECT, opts());
    const activity = g.get('activity/serializers/concept-browser/0.0.0-test');
    expect(activity).toBeDefined();
    expect(activity!.types).toContain(PROV.Activity);
  });

  it('links dcterms:isVersionOf to the canonical URI when one is provided', () => {
    const g = new RdfGraph();
    decorateWithProvenance(g, SUBJECT, opts({ canonicalUri: 'https://glossarist.org/test/concept' }));
    const r = g.get(SUBJECT)!;
    const isVersionOf = r.triples.filter(t => t.predicate === DCTERMS.isVersionOf);
    expect(isVersionOf).toHaveLength(1);
  });

  it('omits dcterms:isVersionOf when canonical equals subject (already canonical)', () => {
    const g = new RdfGraph();
    decorateWithProvenance(g, SUBJECT, opts({ canonicalUri: SUBJECT }));
    const r = g.get(SUBJECT)!;
    expect(r.triples.filter(t => t.predicate === DCTERMS.isVersionOf)).toHaveLength(0);
  });

  it('omits dcterms:isVersionOf when no canonical URI is given', () => {
    const g = new RdfGraph();
    decorateWithProvenance(g, SUBJECT, opts({ canonicalUri: undefined }));
    const r = g.get(SUBJECT)!;
    expect(r.triples.filter(t => t.predicate === DCTERMS.isVersionOf)).toHaveLength(0);
  });

  it('is idempotent — calling twice yields exactly one set of triples', () => {
    const g = new RdfGraph();
    const o = opts();
    decorateWithProvenance(g, SUBJECT, o);
    decorateWithProvenance(g, SUBJECT, o);
    const r = g.get(SUBJECT)!;
    expect(r.triples.filter(t => t.predicate === PROV.wasGeneratedBy)).toHaveLength(1);
    expect(r.triples.filter(t => t.predicate === PROV.generatedAtTime)).toHaveLength(1);
  });
});

describe('runtimeProvenance', () => {
  it('defaults toolId to the concept-browser constant', () => {
    const o = runtimeProvenance('1.2.3', SUBJECT, () => new Date('2026-06-27T00:00:00Z'));
    expect(o.toolId).toBe(SERIALIZER_TOOL_ID);
    expect(o.toolVersion).toBe('1.2.3');
    expect(o.generatedAt).toBe('2026-06-27T00:00:00.000Z');
    expect(o.canonicalUri).toBe(SUBJECT);
  });
});
