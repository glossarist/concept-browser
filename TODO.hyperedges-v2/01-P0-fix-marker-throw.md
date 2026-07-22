# 01-P0: Markers must throw on invalid values (not filter)

## Invariant I5

"Invalid enumeration and invalid markers both throw at construction time."

## Current state (BUG)

`src/composables/use-concept-edges.ts:136`:
```typescript
markers: he.markers.filter((m): m is 'double' | 'dashed' => m === 'double' || m === 'dashed'),
```
Silently drops invalid markers. Data corruption — the user never knows
a value was rejected.

Same pattern in `scripts/build-edges.js` extractPartitiveHyperedges:
```javascript
markers: (he['gl:hasPluralityMarker'] || []).filter(m => m === 'double' || m === 'dashed'),
```

And in `src/__tests__/partitive-hyperedge.test.ts:36` (test EXPECTS filtering).

## Fix

Replace `.filter()` with validation that throws on unknown marker values.
Both the composable and the build-edges extractor must throw.

## Verification
- Constructing a hyperedge with marker `"invalid"` throws.
- Existing valid markers (`"double"`, `"dashed"`) work unchanged.
- Test updated: `it('throws on invalid marker values')` instead of `it('filters')`.
