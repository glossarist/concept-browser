import { describe, it, expect, beforeEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import HyperedgeDiagram from '../../components/HyperedgeDiagram.vue';

/**
 * HyperedgeDiagram mounts a small SVG and calls the actual sphere
 * renderer (drawRakeBundles or drawGenericPipes) on mount. These
 * tests pin the contract: each kind produces the right kind of SVG
 * child elements, matching what the sphere itself renders.
 */
describe('HyperedgeDiagram', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders an SVG element', () => {
    const w = mount(HyperedgeDiagram, { props: { kind: 'partitive' } });
    expect(w.find('svg.hyperedge-diagram').exists()).toBe(true);
  });

  it('partitive kind calls drawRakeBundles (emits line.rake-seg + circle.rake-junction)', () => {
    const w = mount(HyperedgeDiagram, { props: { kind: 'partitive' } });
    const svg = w.element as SVGSVGElement;
    /* The sample fixture has 3 members with mixed multiplicity, so the
       rake emits ≥1 segment + exactly 1 junction circle + 1 diamond. */
    expect(svg.querySelectorAll('line.rake-seg').length).toBeGreaterThan(0);
    expect(svg.querySelectorAll('circle.rake-junction').length).toBe(1);
    expect(svg.querySelectorAll('path').length).toBe(1);
  });

  it('generic kind calls drawGenericPipes (emits line.pipe-seg + rect.pipe-junction)', () => {
    const w = mount(HyperedgeDiagram, { props: { kind: 'generic' } });
    const svg = w.element as SVGSVGElement;
    /* The sample fixture has 3 members → 1 thick pipe + 3 thin threads = 4 segments,
       plus 1 square junction and 1 diamond. */
    expect(svg.querySelectorAll('line.pipe-seg').length).toBe(4);
    expect(svg.querySelectorAll('rect.pipe-junction').length).toBe(1);
    expect(svg.querySelectorAll('path').length).toBe(1);
  });

  it('partitive kind does not leak pipe-and-thread artifacts', () => {
    const w = mount(HyperedgeDiagram, { props: { kind: 'partitive' } });
    const svg = w.element as SVGSVGElement;
    expect(svg.querySelectorAll('line.pipe-seg').length).toBe(0);
    expect(svg.querySelectorAll('rect.pipe-junction').length).toBe(0);
  });

  it('generic kind does not leak rake artifacts', () => {
    const w = mount(HyperedgeDiagram, { props: { kind: 'generic' } });
    const svg = w.element as SVGSVGElement;
    expect(svg.querySelectorAll('line.rake-seg').length).toBe(0);
    expect(svg.querySelectorAll('circle.rake-junction').length).toBe(0);
  });
});
