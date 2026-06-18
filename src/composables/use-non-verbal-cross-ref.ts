/**
 * useNonVerbalCrossRef — wires renderer-emitted entity anchors
 * (`<a href="#figure-{ds}-{id}">`) to in-page scroll, highlight, focus,
 * and URL-hash update.
 *
 * Why a delegated document-level click handler? Entity references are
 * rendered into `v-html` by the content-renderer; Vue `@click` does
 * not bind to children of `v-html`. A single capture-phase handler on
 * `document` is the correct pattern, and it stays in one place
 * regardless of how many mentions the page contains.
 *
 * The behavior is identical across figure/table/formula — only the
 * anchor prefix differs. `ANCHOR_KIND_SELECTORS` (from the anchor SSOT)
 * is the single source for which prefixes count.
 */
import { onMounted, onBeforeUnmount } from 'vue';
import { useReducedMotion } from './use-reduced-motion';
import { ANCHOR_KIND_SELECTORS } from '../utils/non-verbal-anchor';
import { highlightEntity, scrollToEntity } from '../utils/non-verbal-highlight';

const ENTITY_LINK_SELECTOR = ANCHOR_KIND_SELECTORS.join(', ');

export interface NonVerbalCrossRefOptions {
  /** Override the document (injectable for tests). */
  document?: Document;
  /** Override the history API (injectable for tests). */
  history?: History;
}

export interface NonVerbalCrossRef {
  /** Programmatically activate an entity (e.g. from a list click). */
  navigateToEntity: (anchorId: string) => void;
}

export function useNonVerbalCrossRef(
  opts: NonVerbalCrossRefOptions = {},
): NonVerbalCrossRef {
  const doc = opts.document ?? (typeof document !== 'undefined' ? document : null);
  const hist = opts.history ?? (typeof history !== 'undefined' ? history : null);
  const reducedMotion = useReducedMotion();

  function onGlobalClick(event: MouseEvent): void {
    if (!doc) return;
    const target = (event.target as HTMLElement | null)?.closest<HTMLAnchorElement>(
      ENTITY_LINK_SELECTOR,
    );
    if (!target) return;
    const href = target.getAttribute('href') ?? '';
    if (!href.startsWith('#')) return;
    const anchorId = href.slice(1);
    const el = doc.getElementById(anchorId);
    if (!el) return;
    event.preventDefault();
    activate(el, anchorId);
  }

  function activate(el: HTMLElement, anchorId: string): void {
    scrollToEntity(el, !reducedMotion.value);
    highlightEntity(el);
    if (hist && doc && doc.location.hash !== `#${anchorId}`) {
      hist.pushState(null, '', `#${anchorId}`);
    }
  }

  function navigateToEntity(anchorId: string): void {
    const el = doc?.getElementById(anchorId);
    if (!el) return;
    activate(el, anchorId);
  }

  onMounted(() => {
    doc?.addEventListener('click', onGlobalClick, { capture: true });
  });
  onBeforeUnmount(() => {
    doc?.removeEventListener('click', onGlobalClick);
  });

  return { navigateToEntity };
}
