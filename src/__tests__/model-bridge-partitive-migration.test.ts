/**
 * Bridge reverse-map round-trip specs.
 *
 * Audit (AUDIT-2026-07-29 P2-1): pin that loading legacy
 * gl:multiplicity (or older gl:certainty) wire data produces a
 * glossarist-js v4 model with the correct MECE presence × count
 * fields. The migration path lives in model-bridge.ts and must
 * agree with multiplicityFromPair(p, c) at the SSOT level.
 *
 * This spec also covers the invalid-combination case: legacy data
 * carrying the vacuous (optional, at_least_one) combo via
 * gl:multiplicity cannot exist — there's no ISO 704 name for it —
 * so we don't test that path here.
 */
import { describe, it, expect } from 'vitest';
import { conceptFromJson } from '../adapters/model-bridge';

interface PartitiveMemberLike {
  presence: string;
  count: string;
  is_delimiting: boolean;
}

function loadPartitives(doc: Record<string, unknown>): PartitiveMemberLike[] {
  const concept = conceptFromJson(doc as any);
  const relations = (concept as any).relations ?? [];
  return relations.flatMap((r: any) =>
    ((r.members ?? r.partitives) ?? []).map((m: any) => ({
      presence: m.presence,
      count: m.count,
      is_delimiting: m.is_delimiting,
    })),
  );
}

const BASE_DOC = {
  '@type': 'gl:Concept',
  '@id': 'https://example.org/vim/concept/1.3',
  'gl:identifier': '1.3',
  'gl:localizedConcept': {},
};

function docWithRelation(members: unknown[]) {
  return {
    ...BASE_DOC,
    'gl:partitiveRelations': [
      {
        'gl:comprehensive': { 'gl:source': 'VIM', 'gl:id': '1.3' },
        'gl:hasPartitive': members,
        'gl:completeness': 'complete',
      },
    ],
  };
}

describe('bridge reverse-map: legacy gl:multiplicity → MECE presence × count', () => {
  it('compulsory → required + exactly_one', () => {
    const doc = docWithRelation([
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.4' }, 'gl:multiplicity': 'compulsory' },
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.5' }, 'gl:multiplicity': 'compulsory' },
    ]);
    const members = loadPartitives(doc);
    expect(members[0]).toEqual({ presence: 'required', count: 'exactly_one', is_delimiting: false });
    expect(members[1]).toEqual({ presence: 'required', count: 'exactly_one', is_delimiting: false });
  });

  it('optional → optional + exactly_one', () => {
    const doc = docWithRelation([
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.4' }, 'gl:multiplicity': 'optional' },
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.5' }, 'gl:multiplicity': 'compulsory' },
    ]);
    const members = loadPartitives(doc);
    expect(members[0]).toEqual({ presence: 'optional', count: 'exactly_one', is_delimiting: false });
  });

  it('compulsory_multiple → required + multiple', () => {
    const doc = docWithRelation([
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.4' }, 'gl:multiplicity': 'compulsory_multiple' },
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.5' }, 'gl:multiplicity': 'compulsory' },
    ]);
    const members = loadPartitives(doc);
    expect(members[0]).toEqual({ presence: 'required', count: 'multiple', is_delimiting: false });
  });

  it('optional_multiple → optional + multiple', () => {
    const doc = docWithRelation([
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.4' }, 'gl:multiplicity': 'optional_multiple' },
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.5' }, 'gl:multiplicity': 'compulsory' },
    ]);
    const members = loadPartitives(doc);
    expect(members[0]).toEqual({ presence: 'optional', count: 'multiple', is_delimiting: false });
  });

  it('compulsory_at_least_one → required + at_least_one', () => {
    const doc = docWithRelation([
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.4' }, 'gl:multiplicity': 'compulsory_at_least_one' },
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.5' }, 'gl:multiplicity': 'compulsory' },
    ]);
    const members = loadPartitives(doc);
    expect(members[0]).toEqual({ presence: 'required', count: 'at_least_one', is_delimiting: false });
  });

  it('legacy gl:certainty confirmed → required + exactly_one (v2 wire)', () => {
    const doc = docWithRelation([
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.4' }, 'gl:certainty': 'confirmed' },
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.5' }, 'gl:certainty': 'confirmed' },
    ]);
    const members = loadPartitives(doc);
    expect(members[0]).toEqual({ presence: 'required', count: 'exactly_one', is_delimiting: false });
  });

  it('legacy gl:certainty possible → optional + exactly_one (v2 wire)', () => {
    const doc = docWithRelation([
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.4' }, 'gl:certainty': 'possible' },
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.5' }, 'gl:certainty': 'confirmed' },
    ]);
    const members = loadPartitives(doc);
    expect(members[0]).toEqual({ presence: 'optional', count: 'exactly_one', is_delimiting: false });
  });
});

describe('bridge: native MECE gl:presence + gl:count passes through', () => {
  it('presence=optional + count=multiple loads natively', () => {
    const doc = docWithRelation([
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.4' }, 'gl:presence': 'optional', 'gl:count': 'multiple' },
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.5' }, 'gl:presence': 'required', 'gl:count': 'exactly_one' },
    ]);
    const members = loadPartitives(doc);
    expect(members[0]).toEqual({ presence: 'optional', count: 'multiple', is_delimiting: false });
    expect(members[1]).toEqual({ presence: 'required', count: 'exactly_one', is_delimiting: false });
  });

  it('gl:isDelimiting=true preserved', () => {
    const doc = docWithRelation([
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.4' }, 'gl:isDelimiting': true },
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.5' } },
    ]);
    const members = loadPartitives(doc);
    expect(members[0].is_delimiting).toBe(true);
    expect(members[1].is_delimiting).toBe(false);
  });
});

describe('bridge: defaults when no multiplicity fields present', () => {
  it('member with no presence/count/multiplicity/certainty defaults to required + exactly_one', () => {
    const doc = docWithRelation([
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.4' } },
      { 'gl:ref': { 'gl:source': 'VIM', 'gl:id': '1.5' } },
    ]);
    const members = loadPartitives(doc);
    expect(members[0]).toEqual({ presence: 'required', count: 'exactly_one', is_delimiting: false });
  });
});
