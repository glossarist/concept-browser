import { describe, it, expect } from 'vitest';
import { ontology } from '../adapters/ontology-registry';

describe('OntologyRegistry', () => {
  it('loads all 10 taxonomies', () => {
    expect(ontology.getAll('conceptStatus').length).toBe(7);
    expect(ontology.getAll('entryStatus').length).toBe(4);
    expect(ontology.getAll('normativeStatus').length).toBe(4);
    expect(ontology.getAll('sourceType').length).toBe(2);
    expect(ontology.getAll('sourceStatus').length).toBe(10);
    expect(ontology.getAll('relationshipType').length).toBe(51);
    expect(ontology.getAll('designationType').length).toBe(5);
    expect(ontology.getAll('termType').length).toBe(24);
    expect(ontology.getAll('grammarGender').length).toBe(4);
    expect(ontology.getAll('grammarNumber').length).toBe(3);
  });

  it('returns correct labels for conceptStatus', () => {
    expect(ontology.getLabel('conceptStatus', 'valid')).toBe('valid');
    expect(ontology.getLabel('conceptStatus', 'superseded')).toBe('superseded');
    expect(ontology.getLabel('conceptStatus', 'not_valid')).toBe('not valid');
  });

  it('returns correct labels for grammarGender', () => {
    expect(ontology.getLabel('grammarGender', 'm')).toBe('masculine');
    expect(ontology.getLabel('grammarGender', 'f')).toBe('feminine');
    expect(ontology.getLabel('grammarGender', 'n')).toBe('neuter');
    expect(ontology.getLabel('grammarGender', 'c')).toBe('common');
  });

  it('returns altLabel for grammarGender', () => {
    expect(ontology.getAltLabel('grammarGender', 'm')).toBe('m');
    expect(ontology.getAltLabel('grammarGender', 'f')).toBe('f');
  });

  it('returns definitions for every taxonomy value', () => {
    for (const status of ['draft', 'submitted', 'not_valid', 'invalid', 'valid', 'superseded', 'retired']) {
      expect(ontology.getDefinition('conceptStatus', status)).toBeTruthy();
    }
    for (const gender of ['m', 'f', 'n', 'c']) {
      expect(ontology.getDefinition('grammarGender', gender)).toBeTruthy();
    }
    for (const status of ['identical', 'similar', 'modified', 'restyle', 'context_added', 'generalisation', 'specialisation', 'unspecified', 'related', 'not_equal']) {
      expect(ontology.getDefinition('sourceStatus', status)).toBeTruthy();
    }
  });

  it('returns correct hierarchy for designationType', () => {
    expect(ontology.getBroader('designationType', 'abbreviation')).toBe('expression');
    expect(ontology.getBroader('designationType', 'letter_symbol')).toBe('symbol');
    expect(ontology.getBroader('designationType', 'graphical_symbol')).toBe('symbol');
    expect(ontology.getBroader('designationType', 'expression')).toBeNull();
    expect(ontology.getBroader('designationType', 'symbol')).toBeNull();
  });

  it('returns narrower for designationType', () => {
    const childrenOfExpression = ontology.getNarrower('designationType', 'expression');
    expect(childrenOfExpression.map(c => c.id)).toContain('abbreviation');

    const childrenOfSymbol = ontology.getNarrower('designationType', 'symbol');
    expect(childrenOfSymbol.map(c => c.id)).toEqual(expect.arrayContaining(['letter_symbol', 'graphical_symbol']));
  });

  it('returns broader for termType', () => {
    expect(ontology.getBroader('termType', 'acronym')).toBe('abbreviation');
    expect(ontology.getBroader('termType', 'initialism')).toBe('abbreviation');
  });

  it('returns null for unknown taxonomy/value', () => {
    expect(ontology.getConcept('conceptStatus', 'nonexistent')).toBeNull();
    expect(ontology.getLabel('conceptStatus', 'nonexistent')).toBe('nonexistent');
    expect(ontology.getDefinition('conceptStatus', 'nonexistent')).toBeNull();
  });

  it('returns scheme IRIs', () => {
    expect(ontology.getScheme('conceptStatus')).toContain('status');
    expect(ontology.getScheme('grammarGender')).toContain('gender');
  });

  it('has() checks work', () => {
    expect(ontology.has('conceptStatus', 'valid')).toBe(true);
    expect(ontology.has('conceptStatus', 'nonexistent')).toBe(false);
  });

  it('normativeStatus includes correct labels', () => {
    expect(ontology.getLabel('normativeStatus', 'preferred')).toBe('preferred');
    expect(ontology.getLabel('normativeStatus', 'admitted')).toBe('admitted');
    expect(ontology.getLabel('normativeStatus', 'deprecated')).toBe('deprecated');
    expect(ontology.getLabel('normativeStatus', 'superseded')).toBe('superseded');
  });

  it('relationshipType has all glossarist-specific types', () => {
    const types = ontology.getAll('relationshipType').map(c => c.id);
    expect(types).toContain('deprecates');
    expect(types).toContain('supersedes');
    expect(types).toContain('superseded_by');
    expect(types).toContain('compare');
    expect(types).toContain('contrast');
    expect(types).toContain('homograph');
    expect(types).toContain('false_friend');
    expect(types).toContain('abbreviated_form_for');
    expect(types).toContain('short_form_for');
    expect(types).toContain('sequentially_related_concept');
    expect(types).toContain('spatially_related_concept');
    expect(types).toContain('temporally_related_concept');
    expect(types).toContain('related_concept_broader');
    expect(types).toContain('related_concept_narrower');
  });
});
