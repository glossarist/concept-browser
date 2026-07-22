# 07-P1: Add missing hyperedge specs

## Problem

Item 41 specified 4 specs. Only 1 exists (pipeline data flow test).
Missing: color resolution, UI render, stats.

## Fix

1. `src/__tests__/hyperedge-colors.test.ts` — test resolveHyperedgeColor
   for closed/open/double combinations in light and dark mode.

2. `src/__tests__/partitive-hyperedge-list.test.ts` — mount
   PartitiveHyperedgeList.vue with a fixture, verify it renders
   enumeration badges, marker badges, and concept links without error.

3. `src/__tests__/hyperedge-stats.test.ts` — verify STATS_PROCESSORS
   countHyperedges produces correct counts for a fixture with mixed
   closed/open/double/dashed hyperedges.

## Verification
- All 3 new spec files pass.
- `npm test` shows no regressions.
