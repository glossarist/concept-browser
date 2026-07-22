# TODO.hyperedges-v2 — PartitiveHyperedge fixes for concept-browser

## Goal

Close 7 gaps found in the TODO.hyperedges cross-repo audit. The original
plan marked all browser items ✅, but verification revealed incomplete
implementations, invariant violations, and phantom config.

## Items

| # | Priority | Title | Invariant/Item |
|---|----------|-------|----------------|
| 01 | P0 | Fix marker validation: throw instead of filter | I5 |
| 02 | P0 | Fix content field: localized string, not plain string | I7 |
| 03 | P0 | Remove phantom partitive_relationships config | Item 43 |
| 04 | P1 | Add hyperedge category colors to styling system | Item 39 |
| 05 | P1 | Fix migration script: preserve YAML anchors | Item 42 |
| 06 | P1 | Verify broader_partitive binary edge coexistence | Item 24 |
| 07 | P1 | Add missing specs: color, render, stats | Item 41 |
| 08 | P2 | Track glossarist-js native PartitiveHyperedge model | Model-driven |

## Execution order

01 → 02 → 03 → 04 → 05 → 06 → 07 → 08

All items must end with: specs pass, no regressions.
