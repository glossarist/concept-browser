import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { defineComponent, h } from 'vue';
import { mount } from '@vue/test-utils';
import { useNonVerbalCrossRef } from '../composables/use-non-verbal-cross-ref';

const Host = defineComponent({
  setup() {
    const { navigateToEntity } = useNonVerbalCrossRef();
    return { navigateToEntity };
  },
  render() {
    return h('div');
  },
});

function setHash(href: string) {
  // jsdom-compatible history stub
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, hash: '' },
  });
  // Some jsdom builds make location readonly; fall back to defining on the prototype chain.
  try {
    window.location.hash = href;
  } catch {
    Object.defineProperty(window.location, 'hash', { configurable: true, value: href });
  }
}

describe('useNonVerbalCrossRef', () => {
  let pushSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    pushSpy = vi.spyOn(window.history, 'pushState').mockImplementation(() => undefined);
    setHash('');
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function click(target: HTMLElement): void {
    const ev = new MouseEvent('click', { bubbles: true, cancelable: true });
    target.dispatchEvent(ev);
  }

  it('activates the target when a figure anchor link is clicked', async () => {
    const wrapper = mount(Host, { attachTo: document.body });
    const figure = document.createElement('figure');
    figure.id = 'figure-ds-mixed';
    const scrollSpy = vi.spyOn(figure, 'scrollIntoView').mockImplementation(() => undefined);
    const focusSpy = vi.spyOn(figure, 'focus').mockImplementation(() => undefined);
    document.body.appendChild(figure);

    const link = document.createElement('a');
    link.href = '#figure-ds-mixed';
    link.textContent = 'Fig 1';
    document.body.appendChild(link);

    click(link);

    expect(scrollSpy).toHaveBeenCalled();
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
    expect(figure.classList.contains('nv-entity--highlighted')).toBe(true);
    expect(pushSpy).toHaveBeenCalledWith(null, '', '#figure-ds-mixed');

    document.body.removeChild(figure);
    document.body.removeChild(link);
    wrapper.unmount();
  });

  it('responds to table and formula anchor prefixes', async () => {
    const wrapper = mount(Host, { attachTo: document.body });

    for (const kind of ['table', 'formula'] as const) {
      const target = document.createElement('div');
      target.id = `${kind}-ds-foo`;
      const scrollSpy = vi.spyOn(target, 'scrollIntoView').mockImplementation(() => undefined);
      document.body.appendChild(target);

      const link = document.createElement('a');
      link.href = `#${kind}-ds-foo`;
      document.body.appendChild(link);

      click(link);
      expect(scrollSpy).toHaveBeenCalled();
      vi.mocked(scrollSpy).mockRestore();

      document.body.removeChild(target);
      document.body.removeChild(link);
    }
    wrapper.unmount();
  });

  it('ignores clicks on links that are not entity anchors', async () => {
    const wrapper = mount(Host, { attachTo: document.body });
    const otherEl = document.createElement('div');
    otherEl.id = 'something-else';
    const scrollSpy = vi.spyOn(otherEl, 'scrollIntoView').mockImplementation(() => undefined);
    document.body.appendChild(otherEl);

    const link = document.createElement('a');
    link.href = '#something-else';
    document.body.appendChild(link);

    click(link);
    expect(scrollSpy).not.toHaveBeenCalled();
    expect(pushSpy).not.toHaveBeenCalled();

    document.body.removeChild(otherEl);
    document.body.removeChild(link);
    wrapper.unmount();
  });

  it('does not activate when the target element is missing', async () => {
    const wrapper = mount(Host, { attachTo: document.body });
    const link = document.createElement('a');
    link.href = '#figure-ds-missing';
    document.body.appendChild(link);

    expect(() => click(link)).not.toThrow();
    expect(pushSpy).not.toHaveBeenCalled();

    document.body.removeChild(link);
    wrapper.unmount();
  });

  it('navigateToEntity activates a known target programmatically', async () => {
    const wrapper = mount(Host, { attachTo: document.body });
    const target = document.createElement('figure');
    target.id = 'figure-ds-prog';
    const scrollSpy = vi.spyOn(target, 'scrollIntoView').mockImplementation(() => undefined);
    document.body.appendChild(target);

    (wrapper.vm as unknown as { navigateToEntity: (id: string) => void })
      .navigateToEntity('figure-ds-prog');

    expect(scrollSpy).toHaveBeenCalled();
    expect(target.classList.contains('nv-entity--highlighted')).toBe(true);

    document.body.removeChild(target);
    wrapper.unmount();
  });
});
