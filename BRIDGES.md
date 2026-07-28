# Model Bridge Tracking

These bridges in `src/adapters/model-bridge.ts` manually map fields between JSON-LD wire format and glossarist-js model instances. Each bridge must be removed when glossarist-js publishes native support for the field.

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

## Active migrations (NOT bridges — these are documented adaptations between glossarist versions)

| Field | Why | Remove when |
|-------|-----|-------------|
| `presence × count` (MECE 2-axis) ↔ legacy `multiplicity` | glossarist 0.4.25 still uses the 5-value `multiplicity` enum. ISO 704:2022 + the MECE refactor split it into two orthogonal axes (`presence` × `count`). The bridge reverse-maps MECE axes → legacy `multiplicity` at JSON-LD ingestion; consumers split `model.multiplicity` back into axes via `splitLegacyMultiplicity()`. | glossarist publishes native `presence` + `count` fields (PR `glossarist/glossarist-js` MECE-native refactor) |
| `is_delimiting` | glossarist 0.4.25 carries `is_delimiting` natively. The bridge still writes it because the model ignores `presence`/`count` keys; once glossarist-js publishes MECE, this row can be folded into the row above. | glossarist-js MECE refactor merged |

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

The MECE (Mutually Exclusive, Collectively Exhaustive) refactor of partitive multiplicity is in flight across the four repos. Status as of 2026-07-28:

| Repo | Status | Notes |
|------|--------|-------|
| `concept-model` (LUTAML models, JSON Schema, SHACL) | ✅ Schema done; SHACL adds vacuous-combo rejection in this PR | `models/concepts/PartitiveMember.lutaml` carries `presence` + `count` + `is_delimiting` orthogonally |
| `glossarist-js` | ✅ Model refactored (uncommitted cleanup in working tree); published 0.4.25 still uses legacy 5-value `multiplicity` | When published with MECE native, drop the legacy reverse-map row in this file |
| `glossarist-ruby` | ✅ Model carries `presence` + `count` + `is_delimiting` (commit `9342aef`) | — |
| `concept-browser` | ✅ Local types + components refactored to 2-axis; bridge reverse-maps so it works against published glossarist 0.4.25 | Once glossarist-js publishes MECE-native, replace bridge reverse-map + consumer `splitLegacyMultiplicity()` with direct field reads |
