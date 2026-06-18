import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import NonVerbalList from '../components/non-verbal/NonVerbalList.vue';
import type { StructuralEntityRef } from '../composables/use-concept-entities';

function makeRef(overrides: Partial<StructuralEntityRef> = {}): StructuralEntityRef {
  return {
    kind: 'figure',
    entityId: 'mixed-reflection',
    display: null,
    anchor: 'figure-ds-mixed-reflection',
    ...overrides,
  };
}

describe('NonVerbalList.vue', () => {
  it('renders nothing when refs is empty', () => {
    const wrapper = mount(NonVerbalList, { props: { refs: [] } });
    expect(wrapper.find('.section-label').exists()).toBe(false);
  });

  it('renders one group per kind', () => {
    const wrapper = mount(NonVerbalList, {
      props: {
        refs: [
          makeRef({ kind: 'figure', entityId: 'foo', anchor: 'figure-ds-foo' }),
          makeRef({ kind: 'table', entityId: 'bar', anchor: 'table-ds-bar' }),
        ],
      },
    });
    expect(wrapper.text()).toContain('Figures');
    expect(wrapper.text()).toContain('Tables');
  });

  it('links to the anchor href', () => {
    const wrapper = mount(NonVerbalList, {
      props: {
        refs: [makeRef({ kind: 'figure', entityId: 'mixed', anchor: 'figure-ds-mixed' })],
      },
    });
    const a = wrapper.find('a[href="#figure-ds-mixed"]');
    expect(a.exists()).toBe(true);
  });

  it('uses display when present, falls back to entityId', () => {
    const wrapper = mount(NonVerbalList, {
      props: {
        refs: [
          makeRef({ entityId: 'mixed', display: 'Figure 3', anchor: 'figure-ds-mixed' }),
          makeRef({ entityId: 'plain', display: null, anchor: 'figure-ds-plain' }),
        ],
      },
    });
    expect(wrapper.text()).toContain('Figure 3');
    expect(wrapper.text()).toContain('plain');
  });

  it('shows the raw ID as a secondary label when display is present', () => {
    const wrapper = mount(NonVerbalList, {
      props: {
        refs: [makeRef({ entityId: 'dispersion-prism', display: 'Figure 3', anchor: 'figure-ds-x' })],
      },
    });
    const item = wrapper.find('.nv-list__id');
    expect(item.text()).toBe('dispersion-prism');
  });
});
