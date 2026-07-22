# 04-P1: Add hyperedge category colors to styling system

## Problem

`src/utils/relation-categories.ts` and `src/utils/relation-sphere-styling.ts`
have ZERO hyperedge entries. The sphere visualization and relationship
display don't know about hyperedge types. Item 39 marked ✅ but no colors
exist.

## Fix

1. Add a `PARTITIVE_HYPEREDGE_CATEGORIES` mapping to
   `relation-categories.ts`:
   - `partitive` — base category color (teal)
   - `partitive-closed` — full intensity
   - `partitive-open` — reduced intensity (dashed visual)
   - `partitive-double` — accent overlay

2. Add hyperedge color resolution to `relation-sphere-styling.ts`:
   - `colorForHyperedge(enumeration, markers, isDark)` returns the
     correct hex.

3. Update `PartitiveHyperedgeList.vue` to use the category colors
   for enumeration/marker badges instead of static CSS classes.

## Verification
- `resolveHyperedgeColor('closed', [], false)` returns full-intensity teal.
- `resolveHyperedgeColor('open', [], false)` returns reduced alpha.
- `resolveHyperedgeColor('closed', ['double'], false)` returns accent.
- Specs cover all three cases.
