import { computed, ref, watch, type ComputedRef } from 'vue';
import type { Concept, LocalizedConcept, ConceptSource, Designation } from 'glossarist';
import type { Manifest } from '../adapters/types';
import type { RenderOptions } from '../utils/content-renderer';
import { renderContent, cleanContent } from '../utils/content-renderer';
import { getAnnotations } from '../adapters/model-bridge';
import { getPreferredTerm, entryStatusColor, entryStatusLabel, entryStatusDefinition } from '../utils/concept-helpers';
import { sortLanguages } from '../utils/lang';
import { useSiteConfig } from '../config/use-site-config';
import { useI18n } from '../i18n';

export interface LangContent {
  lang: string;
  lc: LocalizedConcept;
  renderedTerm: string;
  definition: string;
  renderedDefinition: string;
  annotations: string[];
  renderedAnnotations: string[];
  notes: string[];
  renderedNotes: string[];
  examples: string[];
  renderedExamples: string[];
  sources: ConceptSource[];
  designations: Designation[];
  renderedDesignations: Map<string, string>;
  entryStatus: string;
  classification: string | null;
  reviewType: string | null;
  release: string | null;
  lineageSourceSimilarity: number | null;
  lcScript: string | null;
  lcSystem: string | null;
}

export function useConceptContent(
  concept: ComputedRef<Concept>,
  manifest: ComputedRef<Manifest>,
  renderOpts: ComputedRef<RenderOptions>,
) {
  const { locale } = useI18n();
  const { config: siteConfig } = useSiteConfig();

  const languages = computed(() => {
    const sorted = sortLanguages(concept.value.languages, manifest.value.languageOrder);
    const current = locale.value;
    const idx = sorted.indexOf(current);
    if (idx > 0) {
      sorted.splice(idx, 1);
      sorted.unshift(current);
    }
    return sorted;
  });

  const allLangContent = computed(() => {
    const result: LangContent[] = [];
    for (const lang of languages.value) {
      const lc = concept.value.localization(lang);
      if (!lc) continue;

      const definition = lc.definitions
        .map(d => d.content).filter(Boolean).join('\n\n');
      const annotations = getAnnotations(lc).map(a => a.content).filter(Boolean);
      const notes = lc.notes.map(n => n.content).filter(Boolean);
      const examples = lc.examples.map(e => e.content).filter(Boolean);
      const opts = renderOpts.value;

      result.push({
        lang,
        lc,
        renderedTerm: renderContent(getPreferredTerm(lc, '')),
        definition,
        renderedDefinition: renderContent(definition, opts),
        annotations,
        renderedAnnotations: annotations.map((a: string) => renderContent(a, opts)),
        notes,
        renderedNotes: notes.map(n => renderContent(n, opts)),
        examples,
        renderedExamples: examples.map(e => renderContent(e, opts)),
        sources: lc.sources,
        designations: lc.terms,
        renderedDesignations: new Map(lc.terms.map(d => [d.designation, renderContent(d.designation)])),
        entryStatus: lc.entryStatus ?? '',
        classification: lc.classification,
        reviewType: lc.reviewType,
        release: lc.release,
        lineageSourceSimilarity: lc.lineageSourceSimilarity,
        lcScript: lc.script,
        lcSystem: lc.system,
      });
    }
    return result;
  });

  const langContentMap = computed(() => {
    const map = new Map<string, LangContent>();
    for (const lc of allLangContent.value) map.set(lc.lang, lc);
    return map;
  });

  function hasContent(lc: LangContent): boolean {
    return !!(lc.definition || lc.annotations.length || lc.notes.length || lc.examples.length || lc.sources.length);
  }

  const collapsedLangs = ref(new Set<string>());

  function initCollapsed() {
    const mainLangs = siteConfig.value?.defaults?.mainLanguages || [];
    const mainSet = new Set(mainLangs.length ? mainLangs : ['eng']);
    const collapsed = new Set<string>();
    for (const lc of allLangContent.value) {
      if (!hasContent(lc) && !mainSet.has(lc.lang)) {
        collapsed.add(lc.lang);
      }
    }
    collapsedLangs.value = collapsed;
  }

  watch(languages, () => { initCollapsed(); }, { immediate: true });

  const allCollapsed = computed(() => collapsedLangs.value.size === allLangContent.value.length);

  function toggleLang(lang: string) {
    const s = new Set(collapsedLangs.value);
    if (s.has(lang)) s.delete(lang); else s.add(lang);
    collapsedLangs.value = s;
  }

  function toggleAll() {
    collapsedLangs.value = allCollapsed.value
      ? new Set()
      : new Set(allLangContent.value.map(lc => lc.lang));
  }

  function plainTruncate(html: string, max: number = 120): string {
    const text = cleanContent(html).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
    return text.length <= max ? text : text.slice(0, max).trimEnd() + '…';
  }

  function orderedDesignations(lang: string): Designation[] {
    const desigs = langContentMap.value.get(lang)?.designations ?? [];
    const preferred = desigs.filter(d => d.normativeStatus === 'preferred');
    const admitted = desigs.filter(d => d.normativeStatus === 'admitted' || d.normativeStatus === 'deprecated');
    const rest = desigs.filter(d => d.normativeStatus !== 'preferred' && d.normativeStatus !== 'admitted' && d.normativeStatus !== 'deprecated');
    return [...preferred, ...admitted, ...rest];
  }

  return {
    languages,
    allLangContent,
    langContentMap,
    hasContent,
    collapsedLangs,
    allCollapsed,
    toggleLang,
    toggleAll,
    plainTruncate,
    orderedDesignations,
  };
}
