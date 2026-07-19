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
| 7 | `partitiveHyperedges` | `ManagedConcept` | Computed | Pending upstream |

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
