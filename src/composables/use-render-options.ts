/**
 * Render-options composable — builds resolvers for the content renderer.
 *
 * The citeResolver is the load-bearing addition: it connects inline
 * {{cite:sourceId}} mentions to the existing ReferenceResolver cascade
 * (factory.resolver.resolveCite). This closes the data/deployment
 * boundary: the data author writes {{cite:iev_702-02-07}}, the resolver
 * walks the deployment's sourceRefs → routing → link cascade, and the
 * renderer emits the correct HTML based on classification.
 */
import { ref, type Ref } from 'vue';
import type { RenderOptions, BibResolver, CiteResolver, NonVerbalRefResolver } from '../utils/content-renderer';
import type { NonVerbalKind } from '../adapters/non-verbal/types';
import { getFactory } from '../adapters/factory';
import { anchorId } from '../utils/non-verbal-anchor';
import { escapeAttr, escapeHtml } from '../utils/escape';

/** Minimal shape of a ConceptSource that citeResolver needs. */
interface ConceptSourceLike {
  id?: string | null;
  origin?: {
    ref?: { source?: string | null; id?: string | null; version?: string | null } | null;
    locality?: { type?: string | null; reference_from?: string | null; referenceTo?: string | null; reference_to?: string | null; referenceFrom?: string | null } | null;
    link?: string | null;
  } | null;
}

export function useRenderOptions(
  registerId: () => string,
  getSources?: () => readonly ConceptSourceLike[] | undefined,
) {
  const ready = ref(false);

  async function ensureBibLoaded() {
    const id = registerId();
    if (!id) return;
    await getFactory().bibliography(id).load();
    ready.value = true;
  }

  const bibResolver: BibResolver = (refId, title) => {
    const id = registerId();
    const entry = id ? getFactory().bibliography(id).findById(refId) : null;
    if (!entry) {
      return `<span class="bib-ref">${escapeHtml(title)}</span>`;
    }
    const display = title || entry.reference || refId;
    if (entry.link) {
      return `<a href="${escapeAttr(entry.link)}" target="_blank" rel="noopener" class="bib-link" title="${escapeAttr(entry.reference ?? '')}">${escapeHtml(display)}</a>`;
    }
    return `<span class="bib-ref" title="${escapeAttr(entry.reference ?? '')}">${escapeHtml(display)}</span>`;
  };

  /**
   * citeResolver — the canonical path for {{cite:sourceId}} mentions.
   *
   * Looks up the concept's own sources[] for a matching id, then
   * delegates to ReferenceResolver.resolveCite() which walks the
   * deployment's cascade (sourceRefs → routing → link → unresolved).
   */
  const citeResolver: CiteResolver = (key, label) => {
    const rid = registerId();
    const sources = getSources?.();
    if (!sources || !rid) {
      return `<span class="cite-ref">${escapeHtml(label ?? key)}</span>`;
    }

    const source = sources.find(s => s.id === key);
    if (!source?.origin) {
      return `<span class="cite-unresolved">${escapeHtml(label ?? key)}</span>`;
    }

    const factory = getFactory();
    const resolution = factory.resolver.resolveCite(source.origin, rid);
    const refId = source.origin.ref?.id ?? key;
    const refSource = source.origin.ref?.source ?? '';
    const display = label ?? refId;

    switch (resolution.classification) {
      case 'internal-citation': {
        if (!resolution.resolved) break;
        const { registerId: targetReg, conceptId } = resolution.resolved;
        const isCross = targetReg !== rid;
        const crossBadge = isCross ? '<span class="text-[9px] opacity-60">↗</span>' : '';
        return `<a href="#" class="cite-link" data-register="${escapeAttr(targetReg)}" data-concept="${escapeAttr(conceptId)}">${escapeHtml(display)} ${crossBadge}</a>`;
      }
      case 'self-contained-citation': {
        const link = source.origin.link;
        if (link) {
          return `<a href="${escapeAttr(link)}" target="_blank" rel="noopener" class="cite-link cite-external">${escapeHtml(refSource || display)} <span class="text-[9px] opacity-60">↗</span></a>`;
        }
        return `<span class="cite-ref">${escapeHtml(refSource || display)}</span>`;
      }
      case 'external-citation': {
        const link = source.origin.link;
        if (link) {
          return `<a href="${escapeAttr(link)}" target="_blank" rel="noopener" class="cite-link cite-external">${escapeHtml(refSource || display)} <span class="text-[9px] opacity-60">↗</span></a>`;
        }
        return `<span class="cite-ref">${escapeHtml(refSource || display)}</span>`;
      }
    }

    return `<span class="cite-unresolved">${escapeHtml(display)}</span>`;
  };

  const nonVerbalRefResolver: NonVerbalRefResolver = (kind: NonVerbalKind, entityId, display) => {
    const id = registerId();
    if (!id) {
      const label = display ?? entityId;
      return `<span class="nv-ref nv-ref--${kind}">${escapeHtml(label)}</span>`;
    }
    const href = `#${anchorId(kind, id, entityId)}`;
    const label = display ?? defaultLabelForKind(kind, entityId);
    const cls = `nv-ref nv-ref--${kind}`;
    return `<a href="${href}" class="${cls}" data-nv-kind="${escapeAttr(kind)}" data-nv-dataset="${escapeAttr(id)}" data-nv-entity="${escapeAttr(entityId)}">${escapeHtml(label)}</a>`;
  };

  return { ready, ensureBibLoaded, bibResolver, citeResolver, nonVerbalRefResolver };
}

function defaultLabelForKind(kind: NonVerbalKind, entityId: string): string {
  switch (kind) {
    case 'figure': return `Figure ${entityId}`;
    case 'table': return `Table ${entityId}`;
    case 'formula': return `Formula ${entityId}`;
  }
}

/** Ensure `ready` is tracked as a Ref for consumers that read `.value`. */
export type RenderOptionsReady = Ref<boolean>;
