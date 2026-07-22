# 06-P1: Verify broader_partitive binary edge coexistence

## Problem

The concept model has both:
- Binary `broader_partitive` / `narrower_partitive` edges (in RelatedConcept)
- One-to-many PartitiveHyperedge decompositions

Item 24 of the original plan says these should coexist without conflict.
Need to verify the browser handles both correctly: binary edges appear
in the relationship list, hyperedges appear in the PartitiveHyperedgeList,
and there's no duplication or confusion.

## Fix

1. Audit: check if any concept has BOTH broader_partitive edges AND
   partitive_hyperedges. If so, verify both render in the UI.
2. Add a guard in the composable: if a binary broader_partitive edge
   is already represented by a hyperedge, don't duplicate it in the
   relationship list.
3. Add a spec: given a concept with both, both sections render correctly.

## Verification
- A concept with broader_partitive + hyperedge shows both sections.
- No duplicate entries.
- Navigation works for both.
