import { describe, it, expect } from 'vitest';
import { hashSeed, expandParams, portSide, portPoint, idToUriGet, visibleNodeIds, computePipeLayout } from '../utils/sphere-math';
import type { SphereHyperedgeLike } from '../utils/sphere-math';

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

  describe('visibleNodeIds', () => {
    const focus = { id: 'focus', register: 'main', depth: 0 };
    const a = { id: 'a', register: 'main', depth: 1 };
    const b = { id: 'b', register: 'main', depth: 1 };
    const c = { id: 'c', register: 'main', depth: 1 };
    const d = { id: 'd', register: 'other', depth: 1 };

    const buildLinks = (links: Array<[string, string, string]>) =>
      links.map(([source, target, type]) => ({ source, target, type }));

    it('always includes the focus node (depth 0)', () => {
      const nodes = [focus, a];
      const links = buildLinks([['focus', 'a', 'related']]);
      const visible = visibleNodeIds(nodes, links, new Set(), new Set());
      expect(visible.has('focus')).toBe(true);
    });

    it('includes a node that has at least one non-muted edge', () => {
      const nodes = [focus, a, b];
      const links = buildLinks([
        ['focus', 'a', 'related'],
        ['focus', 'b', 'see'],
      ]);
      const visible = visibleNodeIds(nodes, links, new Set(), new Set());
      expect(visible.has('a')).toBe(true);
      expect(visible.has('b')).toBe(true);
    });

    it('hides a node whose only edge type is muted', () => {
      const nodes = [focus, a, b];
      const links = buildLinks([
        ['focus', 'a', 'related'],
        ['focus', 'b', 'see'],
      ]);
      const visible = visibleNodeIds(nodes, links, new Set(['see']), new Set());
      expect(visible.has('a')).toBe(true);
      expect(visible.has('b')).toBe(false);
    });

    it('vice versa: hidden node reappears when type is unmuted', () => {
      const nodes = [focus, a, b];
      const links = buildLinks([
        ['focus', 'a', 'related'],
        ['focus', 'b', 'see'],
      ]);
      const muted = new Set(['see']);
      expect(visibleNodeIds(nodes, links, muted, new Set()).has('b')).toBe(false);
      muted.delete('see');
      expect(visibleNodeIds(nodes, links, muted, new Set()).has('b')).toBe(true);
    });

    it('keeps a node visible if it has at least one unmuted edge among several', () => {
      const nodes = [focus, a, b, c];
      const links = buildLinks([
        ['focus', 'a', 'related'],
        ['focus', 'a', 'see'],
        ['focus', 'b', 'see'],
        ['focus', 'c', 'related'],
      ]);
      const visible = visibleNodeIds(nodes, links, new Set(['see']), new Set());
      expect(visible.has('a')).toBe(true);
      expect(visible.has('b')).toBe(false);
      expect(visible.has('c')).toBe(true);
    });

    it('hides a node in a muted register (unless it is the focus)', () => {
      const nodes = [focus, a, d];
      const links = buildLinks([
        ['focus', 'a', 'related'],
        ['focus', 'd', 'related'],
      ]);
      const visible = visibleNodeIds(nodes, links, new Set(), new Set(['other']));
      expect(visible.has('a')).toBe(true);
      expect(visible.has('d')).toBe(false);
    });

    it('hides a node whose only edge endpoint is in a muted register', () => {
      const nodes = [focus, a, d];
      const links = buildLinks([
        ['a', 'd', 'related'],
      ]);
      const visible = visibleNodeIds(nodes, links, new Set(), new Set(['other']));
      expect(visible.has('a')).toBe(false);
      expect(visible.has('d')).toBe(false);
    });

    it('isolated non-focus node (no edges at all) is hidden', () => {
      const nodes = [focus, a];
      const links: Array<{ source: string; target: string; type: string }> = [];
      const visible = visibleNodeIds(nodes, links, new Set(), new Set());
      expect(visible.has('focus')).toBe(true);
      expect(visible.has('a')).toBe(false);
    });

    it('hyperedge member with no bilateral edges stays visible while its bundle is not muted', () => {
      const nodes = [focus, a, b];
      const links: Array<{ source: string; target: string; type: string }> = [];
      const hyperedges: SphereHyperedgeLike[] = [
        { comprehensive: 'focus', members: ['a', 'b'], muteKey: '__partitive__' },
      ];
      const visible = visibleNodeIds(nodes, links, new Set(), new Set(), hyperedges);
      expect(visible.has('focus')).toBe(true);
      expect(visible.has('a')).toBe(true);
      expect(visible.has('b')).toBe(true);
    });

    it('hyperedge members disappear when the bundle is muted', () => {
      const nodes = [focus, a, b];
      const links: Array<{ source: string; target: string; type: string }> = [];
      const hyperedges: SphereHyperedgeLike[] = [
        { comprehensive: 'focus', members: ['a', 'b'], muteKey: '__partitive__' },
      ];
      const visible = visibleNodeIds(nodes, links, new Set(['__partitive__']), new Set(), hyperedges);
      expect(visible.has('focus')).toBe(true);
      expect(visible.has('a')).toBe(false);
      expect(visible.has('b')).toBe(false);
    });

    it('all-visible when no mutes are set', () => {
      const nodes = [focus, a, b, c, d];
      const links = buildLinks([
        ['focus', 'a', 'related'],
        ['focus', 'b', 'see'],
        ['focus', 'c', 'related'],
        ['focus', 'd', 'references'],
      ]);
      const visible = visibleNodeIds(nodes, links, new Set(), new Set());
      expect([...visible].sort()).toEqual(['a', 'b', 'c', 'd', 'focus']);
    });
  });

  describe('computePipeLayout', () => {
    it('returns null for fewer than 2 members', () => {
      expect(computePipeLayout({ x: 0, y: 0 }, [])).toBeNull();
      expect(computePipeLayout({ x: 0, y: 0 }, [{ pos: { x: 1, y: 0 } }])).toBeNull();
    });

    it('places the middle node at the default 50% split between comp and centroid', () => {
      const comp = { x: 0, y: 0 };
      const members = [
        { pos: { x: 10, y: 0 } },
        { pos: { x: -10, y: 0 } },
      ];
      const layout = computePipeLayout(comp, members)!;
      /* Centroid is (0,0); midpoint between (0,0) and (0,0) is (0,0) */
      expect(layout.middleNode).toEqual({ x: 0, y: 0 });
      expect(layout.pipeStart).toEqual(comp);
      expect(layout.pipeEnd).toEqual(layout.middleNode);
      expect(layout.threads).toHaveLength(2);
    });

    it('middle node tracks the member centroid', () => {
      const comp = { x: 0, y: 0 };
      const members = [
        { pos: { x: 10, y: 0 } },
        { pos: { x: 10, y: 10 } },
        { pos: { x: 10, y: -10 } },
      ];
      const layout = computePipeLayout(comp, members)!;
      /* Centroid is (10, 0); splitFraction=0.5 → middle at (5, 0) */
      expect(layout.middleNode).toEqual({ x: 5, y: 0 });
    });

    it('respects a custom split fraction', () => {
      const comp = { x: 0, y: 0 };
      const members = [
        { pos: { x: 10, y: 0 } },
        { pos: { x: 10, y: 10 } },
        { pos: { x: 10, y: -10 } },
      ];
      /* splitFraction=0.8 → middle near centroid: (8, 0) */
      const layout = computePipeLayout(comp, members, 0.8)!;
      expect(layout.middleNode).toEqual({ x: 8, y: 0 });
    });

    it('threads connect the middle node to each member', () => {
      const comp = { x: 0, y: 0 };
      const members = [
        { pos: { x: 10, y: 0 } },
        { pos: { x: -10, y: 0 } },
      ];
      const layout = computePipeLayout(comp, members)!;
      const mid = layout.middleNode;
      expect(layout.threads[0].start).toEqual(mid);
      expect(layout.threads[0].end).toEqual(members[0].pos);
      expect(layout.threads[1].start).toEqual(mid);
      expect(layout.threads[1].end).toEqual(members[1].pos);
    });

    it('carries delimitingCharacteristic through to threads', () => {
      const dc1 = { eng: 'multiple of a unit' };
      const dc2 = { eng: 'submultiple of a unit' };
      const layout = computePipeLayout({ x: 0, y: 0 }, [
        { pos: { x: 10, y: 0 }, delimitingCharacteristic: dc1 },
        { pos: { x: -10, y: 0 }, delimitingCharacteristic: dc2 },
      ])!;
      expect(layout.threads[0].member.delimitingCharacteristic).toBe(dc1);
      expect(layout.threads[1].member.delimitingCharacteristic).toBe(dc2);
    });
  });
});
