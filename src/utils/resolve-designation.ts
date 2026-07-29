/**
 * Resolve a concept URI to its display designation (term string).
 *
 * Single SSOT for the designation fallback chain used by:
 *   - PartitiveRelationList.vue
 *   - GenericRelationList.vue
 *   - use-concept-edges.ts (designationFor method)
 *
 * Previously each site had its own copy with subtle divergences (one
 * used `entry.titles`, another used `entry.designations` — the former
 * is a bug since ConceptSummary has no `titles` property).
 *
 * Fallback chain:
 *   1. BFS graph node (already loaded as a neighbor) → locale → eng → any
 *   2. Dataset adapter index entry → designations[locale] → eng → any
 *   3. Concept ID (for internal URIs) or raw URI (for external)
 */
import type { useVocabularyStore } from '../stores/vocabulary';
import type { AdapterFactory } from '../adapters/factory';

type VocabularyStore = ReturnType<typeof useVocabularyStore>;
type Factory = AdapterFactory;

export function resolveDesignation(
  uri: string,
  store: VocabularyStore,
  factory: Factory,
  currentLocale: string,
): string {
  const node = store.graph.getNode(uri);
  if (node) {
    const des = node.designations[currentLocale]
      || node.designations.eng
      || Object.values(node.designations)[0];
    if (des) return des;
  }
  const resolution = factory.resolve(uri);
  if (resolution.type === 'internal') {
    const adapter = store.datasets.get(resolution.registerId);
    const entry = adapter?.getIndexEntry(resolution.conceptId);
    if (entry) {
      const des = entry.designations[currentLocale]
        || entry.designations.eng
        || Object.values(entry.designations)[0];
      if (des) return des;
    }
    return resolution.conceptId;
  }
  return uri;
}
