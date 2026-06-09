import { describe, it, expect } from 'vitest';
import { LocalizedConcept, Expression } from 'glossarist';
import {
  entryStatusColor,
  conceptStatusColor,
  conceptStatusLabel,
  conceptStatusDefinition,
  entryStatusLabel,
  entryStatusDefinition,
  getPreferredTerm,
} from '../utils/concept-helpers';
import { ontology } from '../adapters/ontology-registry';

describe('conceptStatusColor', () => {
  it('returns correct color for each concept status', () => {
    expect(conceptStatusColor('valid')).toBe('badge-green');
    expect(conceptStatusColor('superseded')).toBe('bg-red-50 text-red-700');
    expect(conceptStatusColor('draft')).toBe('badge-yellow');
    expect(conceptStatusColor('retired')).toBe('badge-gray');
    expect(conceptStatusColor('invalid')).toBe('bg-red-50 text-red-700');
  });

  it('returns badge-gray for null', () => {
    expect(conceptStatusColor(null)).toBe('badge-gray');
  });

  it('returns badge-gray for unknown status', () => {
    expect(conceptStatusColor('nonexistent')).toBe('badge-gray');
  });
});

describe('conceptStatusLabel', () => {
  it('returns label for each concept status', () => {
    expect(conceptStatusLabel('valid')).toBe('valid');
    expect(conceptStatusLabel('superseded')).toBe('superseded');
    expect(conceptStatusLabel('retired')).toBe('retired');
    expect(conceptStatusLabel('draft')).toBe('draft');
  });

  it('returns empty string for null', () => {
    expect(conceptStatusLabel(null)).toBe('');
  });

  it('returns raw id for unknown status', () => {
    expect(conceptStatusLabel('unknown_status')).toBe('unknown_status');
  });
});

describe('conceptStatusDefinition', () => {
  it('returns definition for known statuses', () => {
    const def = conceptStatusDefinition('valid');
    expect(def).toBeTruthy();
    expect(typeof def).toBe('string');
  });

  it('returns null for null', () => {
    expect(conceptStatusDefinition(null)).toBeNull();
  });
});

describe('entryStatusColor', () => {
  it('returns correct color for each entry status', () => {
    expect(entryStatusColor('valid')).toBe('badge-green');
    expect(entryStatusColor('not_valid')).toBe('bg-red-50 text-red-700');
    expect(entryStatusColor('draft')).toBe('badge-yellow');
  });

  it('returns badge-gray for unknown status', () => {
    expect(entryStatusColor('nonexistent')).toBe('badge-gray');
  });
});

describe('entryStatusLabel', () => {
  it('returns label for each entry status', () => {
    expect(entryStatusLabel('valid')).toBe('valid');
    expect(entryStatusLabel('not_valid')).toBe('not valid');
    expect(entryStatusLabel('draft')).toBe('draft');
  });

  it('returns empty string for null', () => {
    expect(entryStatusLabel(null)).toBe('');
  });
});

describe('entryStatusDefinition', () => {
  it('returns definition for known statuses', () => {
    const def = entryStatusDefinition('valid');
    expect(def).toBeTruthy();
  });

  it('returns null for null', () => {
    expect(entryStatusDefinition(null)).toBeNull();
  });
});

describe('getPreferredTerm', () => {
  it('returns primary designation when set', () => {
    const lc = LocalizedConcept.fromJSON({
      language_code: 'eng',
      terms: [
        { designation: 'preferred term', type: 'expression', normative_status: 'preferred' },
        { designation: 'admitted term', type: 'expression', normative_status: 'admitted' },
      ],
    });
    expect(getPreferredTerm(lc)).toBe('preferred term');
  });

  it('returns first term when no primary designation', () => {
    const lc = LocalizedConcept.fromJSON({
      language_code: 'eng',
      terms: [{ designation: 'only term', type: 'expression' }],
    });
    expect(getPreferredTerm(lc)).toBe('only term');
  });

  it('returns fallback for null', () => {
    expect(getPreferredTerm(null)).toBe('—');
    expect(getPreferredTerm(null, 'N/A')).toBe('N/A');
  });

  it('returns fallback for undefined', () => {
    expect(getPreferredTerm(undefined)).toBe('—');
  });

  it('returns fallback when no terms', () => {
    const lc = LocalizedConcept.fromJSON({ language_code: 'eng' });
    expect(getPreferredTerm(lc)).toBe('—');
  });
});
