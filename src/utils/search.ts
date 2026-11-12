import type { SearchHit } from '../adapters/types';

export function orderSearchHits(hits: SearchHit[], priorityLangs: string[]): SearchHit[] {
  const index = new Map(priorityLangs.map((language, i) => [language, i]));
  const tier = (hit: SearchHit) => hit.language === '' ? -1 : (index.get(hit.language) ?? priorityLangs.length);
  // Stable sorting preserves the adapter's score/alphabetical order within each tier.
  return [...hits].sort((a, b) => tier(a) - tier(b));
}

export function deduplicateSearchHits(hits: SearchHit[], priorityLangs: string[] = []): SearchHit[] {
  const index = new Map(priorityLangs.map((language, i) => [language, i]));
  const best = new Map<string, SearchHit>();
  for (const hit of hits) {
    const key = `${hit.registerId}:${hit.conceptId}`;
    const existing = best.get(key);
    if (!existing) {
      best.set(key, hit);
    } else if (hit.matchField === 'designation' && existing.matchField === 'id') {
      best.set(key, hit);
    } else if (
      hit.matchField === 'designation' && existing.matchField === 'designation' &&
      (index.get(hit.language) ?? priorityLangs.length) < (index.get(existing.language) ?? priorityLangs.length)
    ) {
      best.set(key, hit);
    }
  }
  return [...best.values()];
}
