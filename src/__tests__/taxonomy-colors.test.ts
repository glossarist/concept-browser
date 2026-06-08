import { describe, it, expect } from 'vitest';
import { ontology } from '../adapters/ontology-registry';
import { entryStatusColor, conceptStatusColor } from '../utils/concept-helpers';
import { designationTypeInfo, normativeStatusInfo, sourceTypeInfo } from '../utils/designation-registry';

describe('OntologyRegistry.getColor', () => {
  it('returns correct color for conceptStatus', () => {
    expect(ontology.getColor('conceptStatus', 'valid')).toBe('badge-green');
    expect(ontology.getColor('conceptStatus', 'superseded')).toBe('bg-red-50 text-red-700');
    expect(ontology.getColor('conceptStatus', 'draft')).toBe('badge-yellow');
    expect(ontology.getColor('conceptStatus', 'retired')).toBe('badge-gray');
  });

  it('returns null for unknown status', () => {
    expect(ontology.getColor('conceptStatus', 'nonexistent')).toBeNull();
  });

  it('returns correct colors for normativeStatus', () => {
    expect(ontology.getColor('normativeStatus', 'preferred')).toBe('bg-emerald-50 text-emerald-700');
    expect(ontology.getColor('normativeStatus', 'deprecated')).toBe('bg-red-50 text-red-700');
  });

  it('returns correct colors for designationType', () => {
    expect(ontology.getColor('designationType', 'expression')).toBe('bg-sky-50 text-sky-700');
    expect(ontology.getColor('designationType', 'abbreviation')).toBe('bg-amber-50 text-amber-700');
  });

  it('returns correct colors for sourceType', () => {
    expect(ontology.getColor('sourceType', 'authoritative')).toBe('badge-purple');
    expect(ontology.getColor('sourceType', 'lineage')).toBe('badge-blue');
  });
});

describe('concept-helpers (ontology-driven colors)', () => {
  it('entryStatusColor returns taxonomy-driven colors', () => {
    expect(entryStatusColor('valid')).toBe('badge-green');
    expect(entryStatusColor('not_valid')).toBe('bg-red-50 text-red-700');
    expect(entryStatusColor('draft')).toBe('badge-yellow');
  });

  it('entryStatusColor falls back to badge-gray', () => {
    expect(entryStatusColor('unknown_status')).toBe('badge-gray');
  });

  it('conceptStatusColor returns taxonomy-driven colors', () => {
    expect(conceptStatusColor('valid')).toBe('badge-green');
    expect(conceptStatusColor('invalid')).toBe('bg-red-50 text-red-700');
    expect(conceptStatusColor('draft')).toBe('badge-yellow');
  });

  it('conceptStatusColor handles null', () => {
    expect(conceptStatusColor(null)).toBe('badge-gray');
  });
});

describe('designation-registry (ontology-driven colors)', () => {
  it('designationTypeInfo uses taxonomy colors', () => {
    const info = designationTypeInfo({ type: 'expression', designation: 'test' } as any);
    expect(info.color).toBe('bg-sky-50 text-sky-700');
  });

  it('normativeStatusInfo uses taxonomy colors', () => {
    const info = normativeStatusInfo('preferred');
    expect(info.color).toBe('bg-emerald-50 text-emerald-700');
  });

  it('sourceTypeInfo uses taxonomy colors', () => {
    const info = sourceTypeInfo('authoritative');
    expect(info.color).toBe('badge-purple');
  });
});
