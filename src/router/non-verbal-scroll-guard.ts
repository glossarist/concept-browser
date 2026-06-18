/**
 * installNonVerbalScroll — router hook that turns entity-hash deep-links
 * (`/concept/X#figure-{ds}-{id}`) into scroll + highlight on arrival.
 *
 * Why polling instead of an event? Entity components fetch their
 * JSON-LD asynchronously via the resolver; the target `<figure>` does
 * not exist in the DOM until that fetch resolves. Polling for up to
 * `timeoutMs` covers the slow-network worst case without coupling the
 * router to the resolver.
 *
 * The anchor id format is owned by `utils/non-verbal-anchor.ts`; this
 * guard only matches the hash prefix and hands off to the same
 * highlight utility used by click-driven navigation, so the user sees
 * identical behavior whether they arrived by click or by URL.
 */
import type { Router } from 'vue-router';
import { highlightEntity, scrollToEntity } from '../utils/non-verbal-highlight';

const DEFAULT_TIMEOUT_MS = 5000;
const POLL_INTERVAL_MS = 50;

const ENTITY_HASH_RE = /^#(?:figure|table|formula)-/;

export function installNonVerbalScroll(
  router: Router,
  options: { timeoutMs?: number } = {},
): void {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  router.afterEach((to) => {
    if (!to.hash || !ENTITY_HASH_RE.test(to.hash)) return;
    const anchorId = to.hash.slice(1);
    const prefersReducedMotion = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    void waitForElement(anchorId, timeoutMs).then((el) => {
      if (!el) return;
      scrollToEntity(el, !prefersReducedMotion);
      highlightEntity(el);
    });
  });
}

function waitForElement(id: string, timeoutMs: number): Promise<HTMLElement | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const start = Date.now();
    const tick = () => {
      const el = document.getElementById(id);
      if (el) return resolve(el);
      if (Date.now() - start > timeoutMs) return resolve(null);
      setTimeout(tick, POLL_INTERVAL_MS);
    };
    tick();
  });
}
