import { describe, it, expect } from 'vitest';
import {
  RELATIONSHIP_CATEGORIES,
  INVERSE_RELATIONSHIPS,
  categorizeRelationship,
  relationshipLabel,
  relationshipDefinition,
} from '../utils/relationship-categories';
import { ontology } from '../adapters/ontology-registry';

describe('RELATIONSHIP_CATEGORIES (taxonomy-derived)', () => {
  it('has expected category IDs', () => {
    const ids = RELATIONSHIP_CATEGORIES.map(c => c.id);
    expect(ids).toContain('hierarchical');
    expect(ids).toContain('mapping');
    expect(ids).toContain('associative');
    expect(ids).toContain('lifecycle');
    expect(ids).toContain('comparative');
    expect(ids).toContain('definitional');
    expect(ids).toContain('spatiotemporal');
    expect(ids).toContain('lexical');
    expect(ids).toContain('designation');
  });

  it('every category has required fields', () => {
    for (const cat of RELATIONSHIP_CATEGORIES) {
      expect(cat.id).toBeTruthy();
      expect(cat.label).toBeTruthy();
      expect(cat.types.length).toBeGreaterThan(0);
      expect(cat.color).toBeTruthy();
    }
  });

  it('no type appears in more than one category', () => {
    const seen = new Set<string>();
    for (const cat of RELATIONSHIP_CATEGORIES) {
      for (const t of cat.types) {
        expect(seen.has(t), `duplicate type: ${t}`).toBe(false);
        seen.add(t);
      }
    }
  });
});

describe('INVERSE_RELATIONSHIPS (taxonomy-derived)', () => {
  it('every entry is bidirectional', () => {
    for (const [key, value] of Object.entries(INVERSE_RELATIONSHIPS)) {
      expect(INVERSE_RELATIONSHIPS[value], `${key} -> ${value} is not bidirectional`).toBe(key);
    }
  });

  it('symmetric types map to themselves', () => {
    const symmetric = ['equivalent', 'exact_match', 'close_match', 'compare', 'contrast',
      'related_match', 'related_concept', 'homograph', 'false_friend',
      'sequentially_related', 'spatially_related', 'temporally_related'];
    for (const type of symmetric) {
      expect(INVERSE_RELATIONSHIPS[type], `${type} should be self-inverse`).toBe(type);
    }
  });

  it('known inverse pairs are correct', () => {
    expect(INVERSE_RELATIONSHIPS.supersedes).toBe('superseded_by');
    expect(INVERSE_RELATIONSHIPS.superseded_by).toBe('supersedes');
    expect(INVERSE_RELATIONSHIPS.broader).toBe('narrower');
    expect(INVERSE_RELATIONSHIPS.narrower).toBe('broader');
    expect(INVERSE_RELATIONSHIPS.has_part).toBe('is_part_of');
    expect(INVERSE_RELATIONSHIPS.is_part_of).toBe('has_part');
    expect(INVERSE_RELATIONSHIPS.broad_match).toBe('narrow_match');
    expect(INVERSE_RELATIONSHIPS.narrow_match).toBe('broad_match');
    expect(INVERSE_RELATIONSHIPS.related_concept_broader).toBe('related_concept_narrower');
    expect(INVERSE_RELATIONSHIPS.related_concept_narrower).toBe('related_concept_broader');
  });
});

describe('categorizeRelationship', () => {
  it('all 52 taxonomy types resolve to a known category', () => {
    const allTypes = ontology.getAll('relationshipType');
    for (const concept of allTypes) {
      const cat = categorizeRelationship(concept.id);
      expect(cat.id, `${concept.id} resolved to 'other'`).not.toBe('other');
    }
  });

  it('specific category assignments', () => {
    expect(categorizeRelationship('broader').id).toBe('hierarchical');
    expect(categorizeRelationship('equivalent').id).toBe('mapping');
    expect(categorizeRelationship('references').id).toBe('associative');
    expect(categorizeRelationship('supersedes').id).toBe('lifecycle');
    expect(categorizeRelationship('compare').id).toBe('comparative');
    expect(categorizeRelationship('has_definition').id).toBe('definitional');
    expect(categorizeRelationship('sequentially_related').id).toBe('spatiotemporal');
    expect(categorizeRelationship('homograph').id).toBe('lexical');
    expect(categorizeRelationship('abbreviated_form_for').id).toBe('designation');
  });

  it('returns other for unknown type', () => {
    expect(categorizeRelationship('unknown_type').id).toBe('other');
  });
});

describe('relationshipLabel', () => {
  it('all 52 taxonomy types produce non-empty labels', () => {
    const allTypes = ontology.getAll('relationshipType');
    for (const concept of allTypes) {
      const label = relationshipLabel(concept.id);
      expect(label, `${concept.id} has empty label`).toBeTruthy();
    }
  });

  it('taxonomy labels match expected values', () => {
    expect(relationshipLabel('broader_generic')).toBe('broader (generic)');
    expect(relationshipLabel('related_concept')).toBe('related concept');
    expect(relationshipLabel('broader')).toBe('broader');
    expect(relationshipLabel('supersedes')).toBe('supersedes');
    expect(relationshipLabel('superseded_by')).toBe('superseded by');
  });

  it('unknown type falls back to title-case computed form', () => {
    expect(relationshipLabel('some_new_type')).toBe('Some New Type');
  });
});

describe('relationshipDefinition', () => {
  it('all 52 taxonomy types have definitions', () => {
    const allTypes = ontology.getAll('relationshipType');
    for (const concept of allTypes) {
      const def = relationshipDefinition(concept.id);
      expect(def, `${concept.id} has no definition`).toBeTruthy();
    }
  });
});

describe('taxonomy-code synchronization', () => {
  it('every type in RELATIONSHIP_CATEGORIES exists in taxonomy', () => {
    for (const cat of RELATIONSHIP_CATEGORIES) {
      for (const t of cat.types) {
        expect(ontology.has('relationshipType', t), `${t} not in taxonomy`).toBe(true);
      }
    }
  });

  it('every type in INVERSE_RELATIONSHIPS exists in taxonomy', () => {
    for (const key of Object.keys(INVERSE_RELATIONSHIPS)) {
      expect(ontology.has('relationshipType', key), `${key} not in taxonomy`).toBe(true);
    }
  });

  it('every taxonomy entry has a category', () => {
    const allTypes = ontology.getAll('relationshipType');
    for (const concept of allTypes) {
      const cat = categorizeRelationship(concept.id);
      expect(cat.id, `${concept.id} has no category`).not.toBe('other');
    }
  });

  it('all IRIs use consistent gloss:rel/ prefix', () => {
    const allTypes = ontology.getAll('relationshipType');
    for (const concept of allTypes) {
      expect(concept.iri, `${concept.id} IRI: ${concept.iri}`).toMatch(/^gloss:rel\//);
    }
  });
});
