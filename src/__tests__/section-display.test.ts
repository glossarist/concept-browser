import { describe, it, expect } from 'vitest';
import { sectionName, formatSectionLabel } from '../utils/section-display';

describe('sectionName', () => {
  it('prefers the requested language', () => {
    expect(sectionName({ id: 'x', names: { eng: 'X', fra: 'X (fra)' } }, 'fra')).toBe('X (fra)');
  });

  it('falls back to English when requested language missing', () => {
    expect(sectionName({ id: 'x', names: { eng: 'X' } }, 'deu')).toBe('X');
  });

  it('falls back to id when no names at all', () => {
    expect(sectionName({ id: 'x', names: {} }, 'fra')).toBe('x');
  });

  it('falls back to id when names object missing', () => {
    expect(sectionName({ id: 'x' }, 'fra')).toBe('x');
  });
});

describe('formatSectionLabel', () => {
  it('returns just id when name is empty', () => {
    expect(formatSectionLabel({ id: '102', names: {} }, 'eng')).toBe('102');
  });

  it('returns just id when name equals id', () => {
    expect(formatSectionLabel({ id: '102', names: { eng: '102' } }, 'eng')).toBe('102');
  });

  it('returns just name when name equals id-with-spaces (EXPRESS schema convention)', () => {
    expect(formatSectionLabel({ id: 'action_schema', names: { eng: 'action schema' } }, 'eng')).toBe('action schema');
  });

  it('returns "id — name" when name is meaningfully different', () => {
    expect(formatSectionLabel({ id: '102', names: { eng: 'Mathematics' } }, 'eng')).toBe('102 — Mathematics');
  });

  it('localizes the name lookup', () => {
    expect(formatSectionLabel({ id: '102', names: { eng: 'Math', fra: 'Maths' } }, 'fra')).toBe('102 — Maths');
  });

  it('falls back through English when requested language has no name', () => {
    expect(formatSectionLabel({ id: '102', names: { eng: 'Math' } }, 'fra')).toBe('102 — Math');
  });
});
