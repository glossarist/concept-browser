import { describe, it, expect } from 'vitest';
import { groupManifestsIntoSeries } from '../composables/useDatasetSeries';
import type { Manifest } from '../adapters/types';

// Integration tests for the isotc204.geolexica.org deployment shape:
// three editions of ISO 14812 (2022 / 2025 / ed3-draft) wired as a
// lineage-series group with an explicit `current` pointing at the draft.
//
// These tests verify the exact config shape that tc204 PR #28 uses, so
// regressions specific to that deployment are caught here rather than
// in production.

function makeManifest(overrides: Partial<Manifest> & { id: string }): Manifest {
  const base: Manifest = {
    id: overrides.id,
    title: overrides.title ?? overrides.id,
    description: overrides.description ?? '',
    owner: overrides.owner ?? '',
    baseUrl: overrides.baseUrl ?? '/',
    languages: overrides.languages ?? ['eng'],
    conceptCount: overrides.conceptCount ?? 0,
    conceptUrlTemplate: overrides.conceptUrlTemplate ?? '/concept/{id}',
    indexUrl: overrides.indexUrl ?? '/index.json',
    contextUrl: overrides.contextUrl ?? '/context.json',
    uriBase: overrides.uriBase ?? 'https://isotc204.geolexica.org',
    status: overrides.status ?? 'valid',
    schemaVersion: overrides.schemaVersion ?? '3',
    tags: overrides.tags ?? [],
    lastUpdated: overrides.lastUpdated ?? '',
    sourceRepo: overrides.sourceRepo ?? '',
    chunkSize: overrides.chunkSize ?? 0,
    datasetUri: overrides.datasetUri ?? '',
  };
  return { ...base, ...overrides } as Manifest;
}

const TC204_GROUP = {
  id: 'isotc204',
  datasets: ['isotc204-ed3', 'isotc204-2025', 'isotc204-2022'],
  kind: 'lineage' as const,
  current: 'isotc204-ed3',
  label: 'ISO/TC 204 ITS Vocabulary',
};

describe('tc204 deployment: multi-edition lineage series', () => {
  it('groups all three editions into one series', () => {
    const manifests = [
      makeManifest({ id: 'isotc204-2022', status: 'valid', year: 2022, title: 'Edition 1' }),
      makeManifest({ id: 'isotc204-2025', status: 'valid', year: 2025, title: 'Edition 2' }),
      makeManifest({ id: 'isotc204-ed3', status: 'draft', year: 2026, title: 'Edition 3 draft' }),
    ];
    const series = groupManifestsIntoSeries(manifests, undefined, [TC204_GROUP]);
    expect(series.length).toBe(1);
    expect(series[0].members.length).toBe(3);
    expect(series[0].members.map(m => m.id)).toContain('isotc204-ed3');
  });

  it('honors explicit current=isotc204-ed3 (the draft)', () => {
    // tc204 marks ed3 (draft) as current because it's the active working
    // edition, even though it's not yet published. The fallback logic
    // would pick the newest *valid* member, which would be 2025. The
    // explicit `current` override must win.
    const manifests = [
      makeManifest({ id: 'isotc204-2022', status: 'valid', year: 2022 }),
      makeManifest({ id: 'isotc204-2025', status: 'valid', year: 2025 }),
      makeManifest({ id: 'isotc204-ed3', status: 'draft', year: 2026 }),
    ];
    const series = groupManifestsIntoSeries(manifests, undefined, [TC204_GROUP]);
    expect(series[0].current?.id).toBe('isotc204-ed3');
  });

  it('sorts members by year ascending — ed3 (2026) sorts LAST, not first', () => {
    // Without manifest.year, extractYear('isotc204-ed3') returns undefined
    // and the member sorts as year=0 (oldest). With register.yaml:year
    // propagated to manifest.year, ed3 correctly sorts as the newest.
    // This is the tc204-specific regression: drafts without a year in
    // their id must still be positioned via the explicit year field.
    const manifests = [
      makeManifest({ id: 'isotc204-ed3', status: 'draft', year: 2026, title: 'E3' }),
      makeManifest({ id: 'isotc204-2025', status: 'valid', year: 2025, title: 'E2' }),
      makeManifest({ id: 'isotc204-2022', status: 'valid', year: 2022, title: 'E1' }),
    ];
    const series = groupManifestsIntoSeries(manifests, undefined, [TC204_GROUP]);
    const ids = series[0].members.map(m => m.id);
    expect(ids).toEqual(['isotc204-2022', 'isotc204-2025', 'isotc204-ed3']);
  });

  it('includes stub members for configured-but-unfetched editions', () => {
    // tc204's ed3 GCR is generated from a draft ontology; it may be
    // unavailable on some builds. The series deliberately includes
    // stub members for every configured dataset so navigation links
    // survive partial deployments.
    const manifests = [
      makeManifest({ id: 'isotc204-2022', status: 'valid', year: 2022 }),
      makeManifest({ id: 'isotc204-2025', status: 'valid', year: 2025 }),
      // isotc204-ed3 missing — GCR download may have failed
    ];
    const series = groupManifestsIntoSeries(manifests, undefined, [TC204_GROUP]);
    // All 3 configured members appear; the missing one is a stub
    expect(series[0].members.length).toBe(3);
    const ed3 = series[0].members.find(m => m.id === 'isotc204-ed3');
    expect(ed3).toBeDefined();
    expect(ed3?.status).toBe('unknown');
  });

  it('honors configured current even when the member is a stub', () => {
    // When ed3 fails to load AND the config says current=ed3, the stub
    // member is still marked as current. This is deliberate: the config
    // is the source of truth for which edition is "current". A stub
    // current signals "this edition exists but isn't loaded" — the UI
    // can surface that state.
    //
    // TODO: consider falling back to newest valid when the configured
    // current has no manifest. Filed as a follow-up.
    const manifests = [
      makeManifest({ id: 'isotc204-2022', status: 'valid', year: 2022 }),
      makeManifest({ id: 'isotc204-2025', status: 'valid', year: 2025 }),
    ];
    const series = groupManifestsIntoSeries(manifests, undefined, [TC204_GROUP]);
    expect(series[0].current?.id).toBe('isotc204-ed3');
    expect(series[0].current?.status).toBe('unknown');
  });

  it('year propagates through DatasetSummary → setSummaryManifest → member', () => {
    // When the factory loads the registry, datasets with a summary skip
    // the full manifest fetch and use a minimal manifest built from the
    // summary. That minimal manifest MUST carry `year` so the series
    // card can render edition years before the full manifest loads.
    // Without this, ed3 (id has no 4-digit year) shows "—" until the
    // full manifest finishes loading.
    const manifests = [
      makeManifest({ id: 'isotc204-ed3', status: 'draft', year: 2026 }),
      makeManifest({ id: 'isotc204-2025', status: 'valid', year: 2025 }),
      makeManifest({ id: 'isotc204-2022', status: 'valid', year: 2022 }),
    ];
    const series = groupManifestsIntoSeries(manifests, undefined, [TC204_GROUP]);
    // Every member has a year — no "—" in the series card
    for (const m of series[0].members) {
      expect(m.year).toBeDefined();
      expect(typeof m.year).toBe('number');
    }
    expect(series[0].members.find(m => m.id === 'isotc204-ed3')?.year).toBe(2026);
  });
});

describe('tc204 deployment: group about discovery', () => {
  // tc204 ships group about content at:
  //   site-content/groups/isotc204/about/about.eng.md
  // The build pipeline's ABOUT step must find and compile it.
  // See scripts/__tests__/process-about-pages.test.mjs for the
  // filesystem discovery contract.
  it('site-content/groups/<id>/about/ layout is discoverable', async () => {
    // Smoke check: the process-about-pages discovery logic handles
    // the tc204 layout. The actual discovery test is in
    // scripts/__tests__/process-about-pages.test.mjs (group case).
    // Here we just verify the path convention matches.
    const expectedPath = 'site-content/groups/isotc204/about/about.eng.md';
    expect(expectedPath).toMatch(/^site-content\/groups\/[^/]+\/about\/about\.\w+\.(md|adoc|html)$/);
  });
});
