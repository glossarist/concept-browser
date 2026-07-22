# 08-P2: Track glossarist-js native PartitiveHyperedge model

## Problem

glossarist-js (installed version) has no PartitiveHyperedge model class.
The concept-browser hand-rolls the type in `src/adapters/types.ts` and
parses JSON-LD fields manually in `use-concept-edges.ts`. This violates
the model-driven principle — the browser should consume model instances,
not raw JSON-LD.

This is a bridge (like the WeakMap bridges in model-bridge.ts) that
should be removed when glossarist-js publishes native support.

## Fix

1. Add PartitiveHyperedge to BRIDGES.md as bridge #8.
2. When glossarist-js publishes native PartitiveHyperedge:
   - Import from glossarist instead of adapters/types.ts
   - Use the model's native parsing instead of manual JSON-LD field access
   - Delete the adapter-side PartitiveHyperedge interface
   - Update all consumers

## Verification
- BRIDGES.md lists PartitiveHyperedge with status "Pending upstream".
- No code changes needed until glossarist-js publishes.
