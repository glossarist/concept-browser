/**
 * Dataset series — groups related editions of the same vocabulary.
 *
 * A "series" is a family of datasets that share a base name but differ in
 * edition year/status. e.g. `viml-2022`, `viml-2013`, `viml-2000`, `viml-1968`
 * all belong to the `viml` series.
 *
 * Resolution order (most authoritative first):
 *   1. Explicit `datasetGroups` from site-config with `series: true` —
 *      config-driven series have stable ids, labels, and orderings.
 *   2. Auto-derivation by naming convention — `name-YYYY` → `name`. Used
 *      only when NO configured groups exist (backward compat).
 *
 * Within a series, editions are sorted by year ascending so the timeline
 * reads naturally left-to-right / top-to-bottom.
 */

import { computed } from 'vue';
import { useVocabularyStore } from '../stores/vocabulary';
import { useSiteConfig } from '../config/use-site-config';
import { resolveGroupKind } from '../config/group-types';
import type { Manifest } from '../adapters/types';

export interface DatasetSeriesMember {
  id: string;
  ref: string;
  year?: number;
  status: string;
  isCurrent: boolean;
  isActive: boolean;
  conceptCount?: number;
  registerId: string;
}

export interface DatasetSeries {
  /** Stable series key, e.g. `viml`. */
  key: string;
  /** Display title for the series, e.g. `VIML` or `International Vocabulary of Legal Metrology`. */
  title: string;
  /** Optional description from config. */
  description?: string;
  /** Optional accent color from config. Accepts single hex or { light, dark }. */
  color?: string | { light: string; dark: string };
  /** All known editions, oldest first. */
  members: DatasetSeriesMember[];
  /** The current (newest valid) member, if any. */
  current?: DatasetSeriesMember;
  /** Total concept count across the series (sum of members). */
  totalConcepts: number;
  /** Whether this series was explicitly configured (vs auto-derived). */
  configured: boolean;
}

const YEAR_SUFFIX = /[-_:](\d{4})([a-z]?)$/i;

/** Strip trailing year from a dataset id to get the series key. */
export function deriveSeriesKey(id: string): string {
  return id.replace(YEAR_SUFFIX, '').replace(/[-_:]+$/, '');
}

/** Extract a year from a string. Prefers the ISO convention
 *  (`:YYYY`, `:YYYYa`) used in ISO/IEC standard references, then
 *  falls back to a year-as-suffix match (`-YYYY`, `_YYYY`, ` YYYY`),
 *  then a bare 4-digit year. Returns undefined for out-of-range or
 *  4-digit runs that are clearly standard numbers (e.g. `ISO 10241`
 *  → 1024 is rejected because it's not preceded by `:`). */
export function extractYear(source: string): number | undefined {
  if (!source) return undefined;
  const isoMatch = source.match(/:(\d{4})([a-z]?)$/i);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    if (year >= 1900 && year <= 2100) return year;
  }
  const suffixMatch = source.match(/[-_\s](\d{4})([a-z]?)$/i);
  if (suffixMatch) {
    const year = parseInt(suffixMatch[1], 10);
    if (year >= 1900 && year <= 2100) return year;
  }
  if (/^\d{4}$/.test(source.trim())) {
    const year = parseInt(source.trim(), 10);
    if (year >= 1900 && year <= 2100) return year;
  }
  return undefined;
}

/** Build the series title from a member — `OIML V 1:2022` → `OIML V 1`.
 *  Returns the dataset id when the manifest is unavailable. */
function deriveSeriesTitle(m: Manifest | undefined): string {
  if (!m) return '';
  const ref = m.ref ?? m.title;
  return ref.replace(/[:\s-]\d{4}([a-z]?)$/i, '').trim() || m.title;
}

function manifestToMember(m: Manifest, activeDatasetId?: string): DatasetSeriesMember {
  const year = extractYear(m.id) ?? extractYear(m.ref ?? '') ?? extractYear(m.title);
  return {
    id: m.id,
    ref: m.ref ?? m.title,
    year,
    status: m.status ?? m.editionStatus ?? 'unknown',
    isCurrent: false,
    isActive: m.id === activeDatasetId,
    conceptCount: m.conceptCount,
    registerId: m.id,
  };
}

/**
 * Group manifests into series. Pure function.
 *
 * Strategy:
 *   1. If `configuredGroups` is provided AND has any group whose `kind` is
 *      `lineage` (or the legacy `series: true` flag), use ONLY configured
 *      lineage groups — config is the source of truth.
 *   2. Otherwise, fall back to auto-derivation by naming convention.
 */
export function groupManifestsIntoSeries(
  manifests: Manifest[],
  activeDatasetId?: string,
  configuredGroups?: Array<{
    id: string;
    label?: string;
    description?: string;
    color?: string | { light: string; dark: string };
    datasets: string[];
    series?: boolean;
    kind?: 'lineage' | 'topic' | 'family' | 'collection' | 'default';
    current?: string;
  }>,
): DatasetSeries[] {
  const manifestMap = new Map(manifests.map(m => [m.id, m] as const));

  /* Strategy 1: config-driven lineage series */
  const configSeries = (configuredGroups ?? []).filter(g => resolveGroupKind(g) === 'lineage');
  if (configSeries.length > 0) {
    const series: DatasetSeries[] = [];
    for (const g of configSeries) {
      const members: DatasetSeriesMember[] = [];
      /* Include EVERY dataset in the config, even if its manifest isn't loaded
         yet. Without this, visiting /dataset/viml-2000 (only manifest loaded)
         would shrink the series to one member and mis-mark viml-2000 as current. */
      for (const id of g.datasets) {
        const m = manifestMap.get(id);
        if (m) {
          members.push(manifestToMember(m, activeDatasetId));
        } else {
          /* Stub member from id alone — year derived from `<name>-YYYY` pattern. */
          members.push({
            id,
            ref: id,
            year: extractYear(id),
            status: 'unknown',
            isCurrent: false,
            isActive: id === activeDatasetId,
            conceptCount: undefined,
            registerId: id,
          });
        }
      }
      if (members.length === 0) continue;
      members.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));

      /* Determine current edition:
         1. Explicit `current` field from config (most authoritative)
         2. Newest member with status='valid'
         3. Last member (newest by year) */
      let current: DatasetSeriesMember | undefined;
      if (g.current) {
        current = members.find(m => m.id === g.current);
      }
      if (!current) {
        const validMembers = members.filter(m => m.status === 'valid');
        current = validMembers[validMembers.length - 1] ?? members[members.length - 1];
      }
      if (current) current.isCurrent = true;

      const totalConcepts = members.reduce((sum, m) => sum + (m.conceptCount ?? 0), 0);
      series.push({
        key: g.id,
        title: g.label ?? (deriveSeriesTitle(manifestMap.get(members[0].id)) || g.id),
        description: g.description,
        color: g.color,
        members,
        current,
        totalConcepts,
        configured: true,
      });
    }
    return series;
  }

  /* Strategy 2: auto-derive by naming convention */
  const groups = new Map<string, Manifest[]>();
  for (const m of manifests) {
    const key = deriveSeriesKey(m.id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(m);
  }

  const series: DatasetSeries[] = [];
  for (const [key, members] of groups) {
    if (members.length === 0) continue;
    const enriched = members.map(m => manifestToMember(m, activeDatasetId));
    enriched.sort((a, b) => (a.year ?? 0) - (b.year ?? 0));
    const validMembers = enriched.filter(m => m.status === 'valid');
    const current = validMembers[validMembers.length - 1] ?? enriched[enriched.length - 1];
    if (current) current.isCurrent = true;
    const totalConcepts = enriched.reduce((sum, m) => sum + (m.conceptCount ?? 0), 0);
    series.push({
      key,
      title: deriveSeriesTitle(members[0]),
      members: enriched,
      current,
      totalConcepts,
      configured: false,
    });
  }

  series.sort((a, b) => a.key.localeCompare(b.key));
  return series;
}

/**
 * Composable — exposes series for the currently-loaded datasets.
 * Reactive: re-derives when the store's dataset list changes.
 */
export function useDatasetSeries(activeDatasetId?: () => string | undefined) {
  const store = useVocabularyStore();
  const { datasetGroups } = useSiteConfig();

  const series = computed<DatasetSeries[]>(() => {
    const manifests: Manifest[] = [];
    for (const [, adapter] of store.datasets.entries()) {
      const m = adapter.manifest;
      if (m) manifests.push(m);
    }
    const activeId = activeDatasetId?.();
    const configured = datasetGroups.value?.map(g => ({
      id: g.id,
      label: g.label,
      description: g.description,
      color: g.color,
      datasets: g.datasets,
      series: g.series,
      kind: g.kind,
      current: g.current,
    }));
    return groupManifestsIntoSeries(manifests, activeId, configured);
  });

  const seriesForActive = computed<DatasetSeries | undefined>(() => {
    const activeId = activeDatasetId?.();
    if (!activeId) return undefined;
    return series.value.find(s => s.members.some(m => m.id === activeId));
  });

  return { series, seriesForActive };
}
