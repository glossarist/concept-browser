/**
 * curation.ts — data-quality worklist extraction (issue #260).
 *
 * Pure functions over the harmonized concept YAML (the same shape the
 * STATS_PROCESSORS in generate-data.ts read). Three curation signals:
 *
 *   - validation          canonical model parse failures (build-side gate)
 *   - missingTranslations configured dataset languages with no terms
 *   - noSources           no concept-level and no per-language sources
 *
 * The caller (generate-data's processDataset) supplies the designation
 * and the parse outcome; this module owns the per-concept rules and
 * the report aggregation, so the wire shape has one source of truth.
 */

export interface CurationFlags {
  /** Configured dataset languages this entry has no terms for. */
  missingLanguages: string[];
  /** True when neither concept-level nor any language entry has sources. */
  noSources: boolean;
}

export interface CurationQueueItem {
  /** Concept termid (or source filename for unparseable files). */
  id: string;
  /** Plain-text primary designation, best effort. */
  designation: string;
  /** validation queue only: why the entry failed. */
  reason?: string;
  /** missingTranslations queue only: languages with no terms. */
  missing?: string[];
}

export interface CurationQueue {
  count: number;
  items: CurationQueueItem[];
}

export interface CurationReport {
  registerId: string;
  conceptCount: number;
  languages: string[];
  validation: CurationQueue;
  missingTranslations: CurationQueue;
  noSources: CurationQueue;
}

/** Per-concept rules: which configured languages lack terms, and
    whether the entry carries no sources at all. */
export function collectCurationFlags(
  conceptYaml: Record<string, any>,
  languages: string[],
): CurationFlags {
  const missingLanguages: string[] = [];
  let hasSources = Array.isArray(conceptYaml._sources) && conceptYaml._sources.length > 0;

  for (const lang of languages) {
    const lc = conceptYaml[lang] as Record<string, any> | undefined;
    const terms = lc?.terms;
    const hasTerms = Array.isArray(terms) && terms.length > 0;
    if (!hasTerms) missingLanguages.push(lang);
    if (Array.isArray(lc?.sources) && lc.sources.length > 0) hasSources = true;
  }

  return { missingLanguages, noSources: !hasSources };
}

export interface CurationEntry {
  id: string;
  designation: string;
  flags: CurationFlags;
  /** Set when the canonical model parse failed for this entry. */
  parseError?: string;
}

export function buildCurationReport(
  registerId: string,
  conceptCount: number,
  languages: string[],
  entries: CurationEntry[],
  /** Source files that could not be read/parsed at all (no termid). */
  unparseableFiles: string[] = [],
): CurationReport {
  const validation: CurationQueueItem[] = [];
  const missingTranslations: CurationQueueItem[] = [];
  const noSources: CurationQueueItem[] = [];

  for (const entry of entries) {
    if (entry.parseError) {
      validation.push({ id: entry.id, designation: entry.designation, reason: entry.parseError });
    }
    if (entry.flags.missingLanguages.length > 0) {
      missingTranslations.push({
        id: entry.id,
        designation: entry.designation,
        missing: entry.flags.missingLanguages,
      });
    }
    if (entry.flags.noSources) {
      noSources.push({ id: entry.id, designation: entry.designation });
    }
  }

  for (const file of unparseableFiles) {
    validation.push({ id: file, designation: '', reason: 'source file could not be parsed' });
  }

  const byId = (a: CurationQueueItem, b: CurationQueueItem) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

  return {
    registerId,
    conceptCount,
    languages,
    validation: { count: validation.length, items: validation.sort(byId) },
    missingTranslations: { count: missingTranslations.length, items: missingTranslations.sort(byId) },
    noSources: { count: noSources.length, items: noSources.sort(byId) },
  };
}
