import { describe, it, expect } from 'vitest';
import { formatExternalLabel } from '../../utils/external-detection';

describe('external concept label formatting', () => {
  it('wraps external concept labels in parentheses', () => {
    expect(formatExternalLabel('precision condition', true)).toBe('(precision condition)');
  });

  it('does not wrap regular concept labels', () => {
    expect(formatExternalLabel('measurement unit', false)).toBe('measurement unit');
  });

  it('handles empty labels', () => {
    expect(formatExternalLabel('', true)).toBe('()');
    expect(formatExternalLabel('', false)).toBe('');
  });

  it('does not double-wrap already parenthesized labels', () => {
    expect(formatExternalLabel('(precision)', true)).toBe('(precision)');
  });
});
