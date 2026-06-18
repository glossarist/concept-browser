/**
 * Cross-reference highlight utility — shared by the click handler and the
 * router scroll guard. Both call `highlightEntity()` after scrolling into
 * view; the user sees a brief, accessible focus ring.
 *
 * Honors prefers-reduced-motion: the highlight class is added either way
 * (it's a state indicator), but the smooth-scroll behavior is gated
 * upstream by `useReducedMotion`.
 */

const HIGHLIGHT_CLASS = 'nv-entity--highlighted';
const HIGHLIGHT_DURATION_MS = 1600;

export function highlightEntity(el: HTMLElement | null): void {
  if (!el) return;
  el.classList.add(HIGHLIGHT_CLASS);
  el.setAttribute('tabindex', '-1');
  el.focus({ preventScroll: true });
  window.setTimeout(() => {
    el.classList.remove(HIGHLIGHT_CLASS);
  }, HIGHLIGHT_DURATION_MS);
}

export function scrollToEntity(el: HTMLElement | null, smooth: boolean): void {
  if (!el) return;
  el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
}
