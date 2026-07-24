import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PartitiveRelationDiagram, {
  type PartitiveMemberLabeled,
} from '../../components/PartitiveRelationDiagram.vue';

const members = (n: number, certainty: 'confirmed' | 'possible' = 'confirmed'): PartitiveMemberLabeled[] =>
  Array.from({ length: n }, (_, i) => ({
    uri: `https://example.org/test/concept/1.${i + 1}`,
    label: `1.${i + 1}`,
    certainty,
  }));

function svgLinesOf(wrapper: ReturnType<typeof mount>) {
  return wrapper.findAll('line');
}

describe('PartitiveRelationDiagram — ISO 704 rake rendering', () => {
  it('renders comprehensive + N partitive nodes as text', () => {
    const w = mount(PartitiveRelationDiagram, {
      props: {
        comprehensiveLabel: '1.3',
        partitives: members(3),
        completeness: 'complete',
        plurality: null,
      },
    });
    const texts = w.findAll('text').map(t => t.text());
    expect(texts).toContain('1.3');
    expect(texts).toContain('1.1');
    expect(texts).toContain('1.2');
    expect(texts).toContain('1.3');
  });

  it('renders criterion under the comprehensive', () => {
    const w = mount(PartitiveRelationDiagram, {
      props: {
        comprehensiveLabel: '1.3',
        partitives: members(2),
        completeness: 'complete',
        plurality: null,
        criterion: 'physical structure',
      },
    });
    expect(w.findAll('text').map(t => t.text())).toContain('physical structure');
  });

  describe('line variant by plurality', () => {
    it('single solid line when no plurality (3 lines: stem + spine + 2 drops = 4 actually)', () => {
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: '1.3',
          partitives: members(2),
          completeness: 'complete',
          plurality: null,
        },
      });
      // stem (1) + spine (1) + drops (2) = 4 single lines
      expect(svgLinesOf(w)).toHaveLength(4);
      // none should be dashed
      const dashed = svgLinesOf(w).filter(l => l.attributes('stroke-dasharray'));
      expect(dashed).toHaveLength(0);
    });

    it('close-set double solid lines when isShared && !isUncertain', () => {
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: '1.3',
          partitives: members(2),
          completeness: 'complete',
          plurality: { isShared: true, isUncertain: false },
        },
      });
      // stem doubles (2) + spine doubles (2) + drops (2, single) = 6 lines
      expect(svgLinesOf(w)).toHaveLength(6);
      const dashed = svgLinesOf(w).filter(l => l.attributes('stroke-dasharray'));
      expect(dashed).toHaveLength(0);
    });

    it('one solid + one dashed when isShared && isUncertain', () => {
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: '1.3',
          partitives: members(2),
          completeness: 'complete',
          plurality: { isShared: true, isUncertain: true },
        },
      });
      // stem (2: 1 solid + 1 dashed) + spine (2: 1 solid + 1 dashed) + drops (2, single solid) = 6
      const lines = svgLinesOf(w);
      expect(lines).toHaveLength(6);
      const dashed = lines.filter(l => l.attributes('stroke-dasharray'));
      // exactly 2 dashed lines (the second stem + the second spine)
      expect(dashed).toHaveLength(2);
    });
  });

  describe('completeness: partial extends spine', () => {
    it('extends spine past last tooth when completeness=partial', () => {
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: '1.3',
          partitives: members(2),
          completeness: 'partial',
          plurality: null,
        },
      });
      const lines = svgLinesOf(w);
      // stem + spine + 2 drops = 4 lines (same count, but spine is longer)
      expect(lines).toHaveLength(4);
      // The spine line's x2 should be > the last partitive's x
      const lastMember = w.props('partitives')[1];
      // visual assertion: the spine line's x2 is greater than the second
      // partitive's slot x. We can't compute slot exactly without internals,
      // but we know PARTIAL_TAIL (32) is added.
      const spineLine = lines.find(l => {
        const y1 = l.attributes('y1');
        const y2 = l.attributes('y2');
        return y1 && y2 && y1 === y2; // horizontal
      });
      expect(spineLine).toBeDefined();
      const x2 = Number(spineLine!.attributes('x2'));
      // last member x ≈ PADDING_X + NODE_W * 1.5 + GAP_X = 24 + 180 + 16 = 220
      // spine end with PARTIAL_TAIL = 220 + 32 = 252
      expect(x2).toBeGreaterThan(220);
      void lastMember;
    });
  });

  describe('per-member certainty', () => {
    it('renders possible members with dashed border', () => {
      const possibleMembers: PartitiveMemberLabeled[] = [
        { uri: 'u1', label: '1', certainty: 'confirmed' },
        { uri: 'u2', label: '2', certainty: 'possible' },
      ];
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: '0',
          partitives: possibleMembers,
          completeness: 'complete',
          plurality: null,
        },
      });
      // Find the rect for the 'possible' member (the 2nd node)
      const rects = w.findAll('rect');
      // 1 comp + 2 partitive = 3 rects
      expect(rects).toHaveLength(3);
      // The possible member's rect should have a dashed border
      const possibleRect = rects[2];
      expect(possibleRect.attributes('stroke-dasharray')).toBeTruthy();
    });

    it('emits navigate when a partitive is clicked', async () => {
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: '0',
          partitives: members(2),
          completeness: 'complete',
          plurality: null,
        },
      });
      // Click any of the partitive <g> elements
      const groups = w.findAll('g.cursor-pointer');
      expect(groups.length).toBeGreaterThan(0);
      await groups[0].trigger('click');
      expect(w.emitted('navigate')).toBeTruthy();
    });
  });
});
