import { describe, it, expect } from 'vitest';
import { hyperedgeStyle, markerColor, enumerationLabel } from '../utils/hyperedge-styling';

describe('hyperedge-styling', () => {
  describe('hyperedgeStyle', () => {
    it('returns full opacity for closed enumeration', () => {
      expect(hyperedgeStyle('closed', [], false).opacity).toBe(1.0);
    });

    it('returns reduced opacity for open enumeration', () => {
      expect(hyperedgeStyle('open', [], false).opacity).toBe(0.6);
    });

    it('uses teal badge class for closed with no markers', () => {
      expect(hyperedgeStyle('closed', [], false).badgeClass).toBe('badge-teal');
    });

    it('uses blue badge class for double marker', () => {
      expect(hyperedgeStyle('closed', ['double'], false).badgeClass).toBe('badge-blue');
    });

    it('uses yellow badge class for dashed marker', () => {
      expect(hyperedgeStyle('closed', ['dashed'], false).badgeClass).toBe('badge-yellow');
    });

    it('returns different colors in dark mode', () => {
      const light = hyperedgeStyle('closed', [], false);
      const dark = hyperedgeStyle('closed', [], true);
      expect(light.color).not.toBe(dark.color);
    });
  });

  describe('markerColor', () => {
    it('returns blue for double marker', () => {
      expect(markerColor('double', false)).toBe('#3b82f6');
    });

    it('returns amber for dashed marker', () => {
      expect(markerColor('dashed', false)).toBe('#f59e0b');
    });

    it('returns dark-mode variants', () => {
      expect(markerColor('double', true)).toBe('#60a5fa');
      expect(markerColor('dashed', true)).toBe('#fbbf24');
    });
  });

  describe('enumerationLabel', () => {
    it('labels closed as "Closed (complete)"', () => {
      expect(enumerationLabel('closed')).toBe('Closed (complete)');
    });

    it('labels open as "Open (partial)"', () => {
      expect(enumerationLabel('open')).toBe('Open (partial)');
    });
  });
});
