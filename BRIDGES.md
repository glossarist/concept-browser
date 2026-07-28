# Model Bridge Tracking

Bridges in `src/adapters/model-bridge.ts` manually map fields between JSON-LD wire format and glossarist-js model instances. Each bridge must be removed when glossarist-js publishes native support for the field.

## Active Bridges

| # | Field | Model Class | Bridge Type | Status |
|---|-------|-------------|-------------|--------|
| 1 | `annotations` | `LocalizedConcept` | `WeakMap` | Pending upstream |
| 2 | `designationTarget` | `RelatedConcept` | `WeakMap` | Pending upstream |
| 3 | `refText` | `ConceptRef` | `WeakMap` | Pending upstream |
| 4 | `relatedSourceId` | `RelatedConcept` | `WeakMap` | Pending upstream |
| 5 | `relatedCitation` | `RelatedConcept` | `WeakMap` | Pending upstream |
| 6 | `sourcedFrom` | `ConceptSource` | Inline attach | Pending upstream |

## Removed bridges

| # | Field | Removed in | Reason |
|---|-------|-----------|--------|
| 7 | `partitiveRelations` | feat/partitive-v2-nativize | glossarist 0.4.20 ships native v2 model — `Concept.partitiveRelations` is the SSOT |
| 8 | `presence × count` reverse-map into `multiplicity` | v0.7.87 | glossarist 0.4.26 publishes MECE-native `PartitiveMember` with `presence`, `count`, `is_delimiting` fields. `multiplicity` is gone; ISO 704 names are derived via `multiplicityFromPair(presence, count)` from `glossarist/models`. |

## Active migrations (NOT bridges — documented adaptations between glossarist versions)

| Field | Why | Remove when |
|-------|-----|-------------|
| `gl:multiplicity` / `gl:certainty` (legacy wire) → MECE `presence` + `count` | Older JSON-LD wire files in `public/data/` may still emit `gl:multiplicity` or the pre-multiplicity `gl:certainty`. The bridge reads those and projects them into the MECE axes before constructing the glossarist model. New YAML and new JSON-LD emit `gl:presence` + `gl:count` directly. | All published datasets migrate to the v3 JSON-LD wire (`gl:presence` + `gl:count`); bridge row can then be deleted. |

## Removal Criteria

A bridge can be removed when:
1. glossarist-js publishes a version that natively supports the field
2. The concept-browser bumps its glossarist-js dependency to that version
3. All code that uses the bridge's getter function is updated to use the model's native property
4. Tests pass with the native property

## How to Remove a Bridge

1. Bump `glossarist` in `package.json`
2. Find all usages of the bridge's getter (e.g., `getAnnotations(lc)`)
3. Replace with native property access (e.g., `lc.annotations`)
4. Delete the WeakMap declaration and getter function
5. Delete the bridge population code in `attachBridges()`
6. Run tests

## MECE Refactor State

The MECE (Mutually Exclusive, Collectively Exhaustive) refactor of partitive multiplicity is **complete** across all four repos as of 2026-07-28:

| Repo | Status | Notes |
|------|--------|-------|
| `concept-model` (LUTAML models, JSON Schema, SHACL) | ✅ Schema done; SHACL adds vacuous-combo rejection | `models/concepts/PartitiveMember.lutaml` carries `presence` + `count` + `is_delimiting` orthogonally |
| `glossarist-js` | ✅ MECE-native model published as 0.4.26 | `PartitiveMember` exposes `presence`, `count`, `is_delimiting` directly; `multiplicityFromPair(presence, count)` derives the 5 ISO 704 names |
| `glossarist-ruby` | ✅ Model carries `presence` + `count` + `is_delimiting` (commit `9342aef`) | — |
| `concept-browser` | ✅ Re-exports `PartitivePresence` / `PartitiveCount` types from glossarist-js; consumers read `member.presence` / `member.count` / `member.is_delimiting` directly | — |
