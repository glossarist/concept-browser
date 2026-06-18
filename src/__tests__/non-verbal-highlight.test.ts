import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { highlightEntity, scrollToEntity } from '../utils/non-verbal-highlight';

describe('non-verbal-highlight', () => {
  let el: HTMLElement;
  let focusSpy: ReturnType<typeof vi.spyOn>;
  let scrollIntoViewSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    el = document.createElement('div');
    focusSpy = vi.spyOn(el, 'focus').mockImplementation(() => undefined);
    scrollIntoViewSpy = vi.spyOn(el, 'scrollIntoView').mockImplementation(() => undefined);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('adds the highlight class and tabindex', () => {
    highlightEntity(el);
    expect(el.classList.contains('nv-entity--highlighted')).toBe(true);
    expect(el.getAttribute('tabindex')).toBe('-1');
  });

  it('focuses the element without scrolling', () => {
    highlightEntity(el);
    expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
  });

  it('removes the highlight class after the duration', () => {
    highlightEntity(el);
    expect(el.classList.contains('nv-entity--highlighted')).toBe(true);
    vi.advanceTimersByTime(2000);
    expect(el.classList.contains('nv-entity--highlighted')).toBe(false);
  });

  it('is a no-op for null target', () => {
    expect(() => highlightEntity(null)).not.toThrow();
  });

  it('scrollToEntity uses smooth behavior when smooth=true', () => {
    scrollToEntity(el, true);
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'smooth', block: 'start' });
  });

  it('scrollToEntity uses auto behavior when smooth=false', () => {
    scrollToEntity(el, false);
    expect(scrollIntoViewSpy).toHaveBeenCalledWith({ behavior: 'auto', block: 'start' });
  });

  it('scrollToEntity is a no-op for null target', () => {
    expect(() => scrollToEntity(null, true)).not.toThrow();
  });
});
