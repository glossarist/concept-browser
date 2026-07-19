import { describe, it, expect } from 'vitest';
import { hashSeed, expandParams, portSide, portPoint, idToUriGet } from '../utils/sphere-math';

describe('sphere-math', () => {
  describe('hashSeed', () => {
    it('produces deterministic positive integers', () => {
      expect(hashSeed('abc')).toBe(hashSeed('abc'));
      expect(hashSeed('abc')).not.toBe(hashSeed('abd'));
      expect(hashSeed('')).toBeGreaterThanOrEqual(0);
      expect(hashSeed('test')).toBeGreaterThan(0);
    });
  });

  describe('expandParams', () => {
    it('clamps to [0, 10] and maps to physical constants', () => {
      const min = expandParams(0);
      const max = expandParams(10);
      expect(min.linkDist).toBeLessThan(max.linkDist);
      expect(min.repMin).toBeLessThan(max.repMin);
    });

    it('clamps out-of-range values', () => {
      expect(expandParams(-5)).toEqual(expandParams(0));
      expect(expandParams(20)).toEqual(expandParams(10));
    });
  });

  describe('portSide', () => {
    it('determines the dominant axis direction', () => {
      expect(portSide({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe('right');
      expect(portSide({ x: 0, y: 0 }, { x: -10, y: 0 })).toBe('left');
      expect(portSide({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe('bottom');
      expect(portSide({ x: 0, y: 0 }, { x: 0, y: -10 })).toBe('top');
    });
  });

  describe('portPoint', () => {
    it('computes the connection point on each side', () => {
      const c = { x: 100, y: 100 };
      const w = 220, h = 60;
      const right = portPoint(c, 'right', w, h, 0);
      expect(right.x).toBe(210);
      expect(right.y).toBe(100);
      const top = portPoint(c, 'top', w, h, 0);
      expect(top.y).toBe(70);
    });
  });

  describe('idToUriGet', () => {
    it('reverse-looks-up a URI in an ID→URI map', () => {
      const map = new Map([['a', '/uri/a'], ['b', '/uri/b']]);
      expect(idToUriGet(map, '/uri/b')).toBe('b');
      expect(idToUriGet(map, '/uri/unknown')).toBeUndefined();
    });
  });
});
