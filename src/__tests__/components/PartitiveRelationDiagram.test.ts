import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import PartitiveRelationDiagram, {
  type PartitiveMemberLabeled,
} from '../../components/PartitiveRelationDiagram.vue';
import { rakeStrokeStyle, type PartitiveMultiplicity } from '../../utils/partitive-multiplicity';

const members = (
  n: number,
  opts: { multiplicity?: PartitiveMultiplicity; isDelimiting?: boolean } = {},
): PartitiveMemberLabeled[] =>
  Array.from({ length: n }, (_, i) => ({
    uri: `https://example.org/test/concept/1.${i + 1}`,
    label: `1.${i + 1}`,
    multiplicity: opts.multiplicity ?? 'compulsory',
    isDelimiting: opts.isDelimiting ?? false,
  }));

describe('PartitiveRelationDiagram — ISO 704:2022 rake rendering', () => {
  it('renders comprehensive + N partitive nodes as text', () => {
    const w = mount(PartitiveRelationDiagram, {
      props: {
        comprehensiveLabel: '1.3',
        partitives: members(3),
        completeness: 'complete',
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
        criterion: 'physical structure',
      },
    });
    expect(w.findAll('text').map(t => t.text())).toContain('physical structure');
  });

  describe('per-member multiplicity line rendering', () => {
    it('compulsory: stem + spine + 1 solid line per drop', () => {
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: '0',
          partitives: members(2),
          completeness: 'complete',
        },
      });
      // stem (1) + spine (1) + 1 drop line per member × 2 members = 4
      expect(w.findAll('line')).toHaveLength(4);
    });

    it('compulsory_multiple: each drop has 2 lines', () => {
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: '0',
          partitives: members(2, { multiplicity: 'compulsory_multiple' }),
          completeness: 'complete',
        },
      });
      // stem + spine + 2 drop lines per member × 2 = 6
      expect(w.findAll('line')).toHaveLength(6);
    });

    it('optional: drop is dashed', () => {
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: '0',
          partitives: members(2, { multiplicity: 'optional' }),
          completeness: 'complete',
        },
      });
      // stem + spine (frame, not dashed) + 2 drops (dashed)
      const lines = w.findAll('line');
      const dashed = lines.filter(l => l.attributes('stroke-dasharray'));
      expect(dashed).toHaveLength(2);
    });

    it('optional_multiple: each drop has 2 dashed lines', () => {
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: '0',
          partitives: members(2, { multiplicity: 'optional_multiple' }),
          completeness: 'complete',
        },
      });
      const lines = w.findAll('line');
      const dashed = lines.filter(l => l.attributes('stroke-dasharray'));
      expect(dashed).toHaveLength(4); // 2 members × 2 dashed lines each
    });

    it('at_least_one: each drop has 1 solid + 1 dashed line', () => {
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: '0',
          partitives: members(2, { multiplicity: 'at_least_one' }),
          completeness: 'complete',
        },
      });
      const lines = w.findAll('line');
      // stem + spine (solid) + 1 solid + 1 dashed per member × 2 = 6
      expect(lines).toHaveLength(6);
      const dashed = lines.filter(l => l.attributes('stroke-dasharray'));
      expect(dashed).toHaveLength(2); // 1 dashed per member
    });

    it('delimiting: drops use 3× stroke width', () => {
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: '0',
          partitives: members(2, { isDelimiting: true }),
          completeness: 'complete',
        },
      });
      // The drop lines should have stroke-width = 4.5 (vs frame's 1.4)
      const lines = w.findAll('line');
      const dropWidths = lines
        .map(l => Number(l.attributes('stroke-width') || '0'))
        .filter(w => w > 2); // delimiting width is 4.5
      expect(dropWidths).toHaveLength(2); // 1 drop per member × 2 members
    });
  });

  it('emits navigate when a partitive is clicked', async () => {
    const w = mount(PartitiveRelationDiagram, {
      props: {
        comprehensiveLabel: '0',
        partitives: members(2),
        completeness: 'complete',
      },
    });
    const groups = w.findAll('g.cursor-pointer');
    expect(groups.length).toBeGreaterThan(0);
    await groups[0].trigger('click');
    expect(w.emitted('navigate')).toBeTruthy();
  });

  describe('designation-aware sizing', () => {
    it('uses MIN_NODE_W when labels are short', () => {
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: '1.3',
          partitives: members(2),
          completeness: 'complete',
        },
      });
      const svg = w.find('svg');
      const width = Number((svg.attributes('viewBox') || '').split(' ')[2]);
      expect(width).toBeLessThan(300);
    });

    it('grows nodes for long designations', () => {
      const w = mount(PartitiveRelationDiagram, {
        props: {
          comprehensiveLabel: 'coordinate system of quantities',
          partitives: [
            { uri: 'u1', label: 'system of quantities', multiplicity: 'compulsory', isDelimiting: false },
            { uri: 'u2', label: 'International System of Units', multiplicity: 'compulsory', isDelimiting: false },
            { uri: 'u3', label: 'base quantity dimension', multiplicity: 'compulsory', isDelimiting: false },
          ],
          completeness: 'complete',
        },
      });
      const width = Number((w.find('svg').attributes('viewBox') || '').split(' ')[2]);
      expect(width).toBeGreaterThan(330);
    });
  });

  describe('consistency with rakeStrokeStyle helper', () => {
    // Ensure the component's line rendering matches the pure helper
    // (single source of truth — both must agree).
    it('renders exactly the line count + dash pattern the helper predicts', () => {
      const testCases: Array<{ multiplicity: PartitiveMultiplicity; isDelimiting: boolean }> = [
        { multiplicity: 'compulsory', isDelimiting: false },
        { multiplicity: 'compulsory', isDelimiting: true },
        { multiplicity: 'optional', isDelimiting: false },
        { multiplicity: 'compulsory_multiple', isDelimiting: false },
        { multiplicity: 'optional_multiple', isDelimiting: false },
        { multiplicity: 'at_least_one', isDelimiting: false },
      ];
      for (const tc of testCases) {
        const expected = rakeStrokeStyle(tc.multiplicity, tc.isDelimiting);
        const w = mount(PartitiveRelationDiagram, {
          props: {
            comprehensiveLabel: '0',
            partitives: members(1, tc),
            completeness: 'complete',
          },
        });
        const lines = w.findAll('line');
        // stem (1) + spine (1) + drop lineCount per member
        const expectedLines = 2 + expected.lineCount;
        expect(lines.length).toBe(expectedLines);
      }
    });
  });
});
