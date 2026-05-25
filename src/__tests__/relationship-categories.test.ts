import { describe, it, expect } from 'vitest';
import { categorizeRelationship, relationshipLabel, RELATIONSHIP_CATEGORIES } from '../utils/relationship-categories';

describe('RELATIONSHIP_CATEGORIES', () => {
  it('has expected categories', () => {
    const ids = RELATIONSHIP_CATEGORIES.map(c => c.id);
    expect(ids).toContain('hierarchical');
    expect(ids).toContain('mapping');
    expect(ids).toContain('associative');
    expect(ids).toContain('lifecycle');
    expect(ids).toContain('comparative');
    expect(ids).toContain('spatiotemporal');
    expect(ids).toContain('lexical');
    expect(ids).toContain('designation');
  });

  it('each category has required fields', () => {
    for (const cat of RELATIONSHIP_CATEGORIES) {
      expect(cat.id).toBeTruthy();
      expect(cat.label).toBeTruthy();
      expect(cat.types.length).toBeGreaterThan(0);
      expect(cat.color).toBeTruthy();
    }
  });
});

describe('categorizeRelationship', () => {
  it('categorizes broader as hierarchical', () => {
    expect(categorizeRelationship('broader').id).toBe('hierarchical');
  });

  it('categorizes equivalent as mapping', () => {
    expect(categorizeRelationship('equivalent').id).toBe('mapping');
  });

  it('categorizes references as associative', () => {
    expect(categorizeRelationship('references').id).toBe('associative');
  });

  it('categorizes supersedes as lifecycle', () => {
    expect(categorizeRelationship('supersedes').id).toBe('lifecycle');
  });

  it('categorizes compare as comparative', () => {
    expect(categorizeRelationship('compare').id).toBe('comparative');
  });

  it('returns other for unknown type', () => {
    expect(categorizeRelationship('unknown_type').id).toBe('other');
  });
});

describe('relationshipLabel', () => {
  it('formats snake_case as title case', () => {
    expect(relationshipLabel('broader_generic')).toBe('Broader Generic');
    expect(relationshipLabel('related_concept')).toBe('Related Concept');
  });

  it('handles single word', () => {
    expect(relationshipLabel('broader')).toBe('Broader');
  });
});
