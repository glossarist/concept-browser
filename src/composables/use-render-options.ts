import { ref } from 'vue';
import type { RenderOptions, BibResolver, NonVerbalRefResolver } from '../utils/content-renderer';
import type { NonVerbalKind } from '../adapters/non-verbal/types';
import { getFactory } from '../adapters/factory';
import { anchorId } from '../utils/non-verbal-anchor';
import { escapeAttr } from '../utils/escape';

export function useRenderOptions(registerId: () => string) {
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
      return `<span class="bib-ref">${escapeAttr(title)}</span>`;
    }
    const display = title || entry.reference || refId;
    if (entry.link) {
      return `<a href="${escapeAttr(entry.link)}" target="_blank" rel="noopener" class="bib-link" title="${escapeAttr(entry.title ?? '')}">${escapeAttr(display)}</a>`;
    }
    return `<span class="bib-ref" title="${escapeAttr(entry.title ?? '')}">${escapeAttr(display)}</span>`;
  };

  const nonVerbalRefResolver: NonVerbalRefResolver = (kind: NonVerbalKind, entityId, display) => {
    const id = registerId();
    if (!id) {
      const label = display ?? entityId;
      return `<span class="nv-ref nv-ref--${kind}">${escapeAttr(label)}</span>`;
    }
    const href = `#${anchorId(kind, id, entityId)}`;
    const label = display ?? defaultLabelForKind(kind, entityId);
    const cls = `nv-ref nv-ref--${kind}`;
    return `<a href="${href}" class="${cls}" data-nv-kind="${escapeAttr(kind)}" data-nv-dataset="${escapeAttr(id)}" data-nv-entity="${escapeAttr(entityId)}">${escapeAttr(label)}</a>`;
  };

  return { ready, ensureBibLoaded, bibResolver, nonVerbalRefResolver };
}

function defaultLabelForKind(kind: NonVerbalKind, entityId: string): string {
  switch (kind) {
    case 'figure': return `Figure ${entityId}`;
    case 'table': return `Table ${entityId}`;
    case 'formula': return `Formula ${entityId}`;
  }
}
