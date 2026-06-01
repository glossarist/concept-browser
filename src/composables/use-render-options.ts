import { ref, watch } from 'vue';
import type { RenderOptions, BibResolver, FigResolver } from '../utils/math';
import { getFactory } from '../adapters/factory';
import { escapeAttr } from '../utils/escape';

interface BibEntry {
  reference: string;
  title?: string;
  link?: string;
}

const bibCache = new Map<string, Record<string, BibEntry>>();

async function loadBibliography(registerId: string): Promise<Record<string, BibEntry> | null> {
  if (bibCache.has(registerId)) return bibCache.get(registerId)!;
  try {
    const resp = await fetch(`${import.meta.env.BASE_URL}data/${registerId}/bibliography.json`);
    if (!resp.ok) return null;
    const data = await resp.json();
    bibCache.set(registerId, data);
    return data;
  } catch {
    return null;
  }
}

export function useRenderOptions(registerId: () => string) {
  const bibData = ref<Record<string, BibEntry> | null>(null);

  async function ensureBibLoaded() {
    const id = registerId();
    if (!id) return;
    bibData.value = await loadBibliography(id);
  }

  const bibResolver: BibResolver = (refId, title) => {
    const entry = bibData.value?.[refId];
    if (!entry) {
      return `<span class="bib-ref">${escapeAttr(title)}</span>`;
    }
    const display = title || entry.reference;
    if (entry.link) {
      return `<a href="${escapeAttr(entry.link)}" target="_blank" rel="noopener" class="bib-link" title="${escapeAttr(entry.title || '')}">${escapeAttr(display)}</a>`;
    }
    return `<span class="bib-ref" title="${escapeAttr(entry.title || '')}">${escapeAttr(display)}</span>`;
  };

  const figResolver: FigResolver = (figId) => {
    const id = registerId();
    const imgSrc = `${import.meta.env.BASE_URL}data/${id}/images/${figId}.png`;
    return `<span class="fig-ref"><a href="${escapeAttr(imgSrc)}" target="_blank" rel="noopener">${escapeAttr(figId)}</a></span>`;
  };

  return { bibData, ensureBibLoaded, bibResolver, figResolver };
}
