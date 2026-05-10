import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import NavIcon from '../components/NavIcon.vue';

describe('NavIcon', () => {
  it('renders an SVG element', () => {
    const wrapper = mount(NavIcon, { props: { name: 'home' } });
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('renders home icon path', () => {
    const wrapper = mount(NavIcon, { props: { name: 'home' } });
    const path = wrapper.find('svg path');
    expect(path.exists()).toBe(true);
    expect(path.attributes('d')).toBeTruthy();
  });

  it('renders search icon', () => {
    const wrapper = mount(NavIcon, { props: { name: 'search' } });
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('renders graph icon', () => {
    const wrapper = mount(NavIcon, { props: { name: 'graph' } });
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('falls back to info icon for unknown name', () => {
    const wrapper = mount(NavIcon, { props: { name: 'nonexistent' } });
    expect(wrapper.find('svg').exists()).toBe(true);
  });

  it('applies correct CSS classes', () => {
    const wrapper = mount(NavIcon, { props: { name: 'home' } });
    const svg = wrapper.find('svg');
    expect(svg.classes()).toContain('w-4');
    expect(svg.classes()).toContain('h-4');
    expect(svg.classes()).toContain('text-ink-400');
  });

  it('renders all known icon types', () => {
    const icons = ['home', 'search', 'graph', 'newspaper', 'users', 'info', 'chart', 'list'];
    for (const name of icons) {
      const wrapper = mount(NavIcon, { props: { name } });
      expect(wrapper.find('svg').exists()).toBe(true);
    }
  });
});
