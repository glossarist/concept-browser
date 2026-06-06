import type { SearchHit } from '../adapters/types';

export function deduplicateSearchHits(hits: SearchHit[]): SearchHit[] {
  const best = new Map<string, SearchHit>();
  for (const hit of hits) {
    const key = `${hit.registerId}:${hit.conceptId}`;
    const existing = best.get(key);
    if (!existing) {
      best.set(key, hit);
    } else if (hit.matchField === 'designation' && existing.matchField === 'id') {
      best.set(key, hit);
    }
  }
  return [...best.values()];
}
