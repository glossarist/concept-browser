import type { Concept } from 'glossarist';

interface StandardRef {
  readonly source?: string | null;
  readonly id?: string | null;
}

/** Combine source and id, retaining edition years and ignoring clause/locality fields. */
export function standardLabel(ref: StandardRef | null | undefined): string | null {
  const parts = [ref?.source, ref?.id]
    .map(part => part?.trim().replace(/\s+/g, ' ') ?? '')
    .filter(Boolean);
  return parts.join(' ') || null;
}

/** Case-insensitive, whitespace-normalized identity shared by build and browser. */
export function standardKey(ref: StandardRef | null | undefined): string | null {
  return standardLabel(ref)?.toLowerCase() ?? null;
}

/** Unique authoritative standards, in concept-then-localization encounter order. */
export function collectStandardKeys(concept: Pick<Concept, 'sources' | 'languages' | 'localization'>): string[] {
  const sources = [
    ...concept.sources,
    ...concept.languages.flatMap(lang => concept.localization(lang)?.sources ?? []),
  ];
  const keys = new Set<string>();
  for (const source of sources) {
    if (source.type !== 'authoritative') continue;
    const key = standardKey(source.origin?.ref);
    if (key !== null) keys.add(key);
  }
  return [...keys];
}
