/**
 * Generic reduced-motion watcher. Shared across feature modules that need
 * to respect the user's `prefers-reduced-motion` setting.
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';

export function useReducedMotion() {
  const reduced = ref(false);
  let mql: MediaQueryList | null = null;

  const handler = (e: MediaQueryListEvent) => { reduced.value = e.matches; };

  onMounted(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduced.value = mql.matches;
    mql.addEventListener('change', handler);
  });

  onBeforeUnmount(() => {
    if (mql) mql.removeEventListener('change', handler);
    mql = null;
  });

  return reduced;
}
