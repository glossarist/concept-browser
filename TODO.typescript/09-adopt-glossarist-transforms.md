# 09 — [BLOCKED] Adopt glossarist/transforms (ConceptToGloss)

**Priority:** P2
**Status:** BLOCKED on TODO 04
**Estimated effort:** medium

## Context

glossarist-js ships `ConceptToGlossTransform` at `glossarist/transforms`. concept-browser's `scripts/generate-data.mjs` hand-rolls JSON-LD output. If the transform covers the same output, it could replace ~1,000+ lines of custom generation logic.

## Scope

- Read `ConceptToGlossTransform` source to understand its output shape
- Compare against current `generate-data.mjs` output
- If compatible: replace the hand-rolled JSON-LD generation with the transform
- If not fully compatible: adopt what's possible, keep custom generation for gaps

## Acceptance criteria

- [ ] Transform output matches current generate-data.mjs output for a representative concept
- [ ] OR: documented gaps where custom generation remains
