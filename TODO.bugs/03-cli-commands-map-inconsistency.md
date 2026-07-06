# 03 — CLI commands map: inconsistent invocation contract (MECE violation)

## Problem (audit of contributed fix acf7772)

The CLI dispatch table at `cli/index.mjs:32-40` has **two different
invocation patterns** for command scripts:

```js
const commands = {
  fetch:     () => import('../scripts/fetch-datasets.mjs'),     // pattern A
  generate:  () => import('../scripts/generate-data.mjs'),      // pattern A
  edges:     () => import('../scripts/build-edges.js'),         // pattern A
  about: async () => {                                          // pattern B
    const m = await import('../scripts/process-about-pages.mjs');
    await m.main();
  },
};
```

- **Pattern A** relies on import side-effects: the script auto-runs
  `main()` at module load.
- **Pattern B** imports the module then calls `m.main()` explicitly.

This was patched in `acf7772` (Bug 2 fix) because pattern A doesn't
work for `about` — that script guards auto-invocation with
`isDirectInvocation`. But the patch only fixed the symptom for one
command; the other three still rely on side-effects.

## Why this is wrong

- **MECE violation**: two patterns where one would do.
- **OCP violation**: adding a command requires deciding which pattern
  to use, then maybe switching later. New commands should follow one
  rule.
- **Test friction**: scripts that auto-run on import can't be unit
  tested without module-cache games (see the vitest cache issue that
  forced `process-about-pages.mjs` to export `main()`).
- **Implicit contract**: "this script runs when imported" is an
  undocumented invariant. Pattern B's contract ("export `main()`,
  caller invokes") is explicit and discoverable.

## Fix

Standardize on pattern B for every command:

1. Each script exports `main()` and guards auto-invocation with the
   `isDirectInvocation` check.
2. CLI commands map uniformly does `await m.main()` after import.

Apply to: `fetch-datasets.mjs`, `generate-data.mjs`,
`build-edges.js`, `process-about-pages.mjs` (already done).

## Deliverables

- [ ] Add `export function main()` + `isDirectInvocation` guard to
      `scripts/fetch-datasets.mjs`
- [ ] Same for `scripts/generate-data.mjs`
- [ ] Same for `scripts/build-edges.js`
- [ ] Update `cli/index.mjs` commands map to pattern B uniformly
- [ ] Add a test that imports each script and verifies `main` is a
      function (one assertion per script, no side-effect execution)

## Tests

- `expect(typeof fetchDatasetsModule.main).toBe('function')`
- Same for generate, edges, about
- Existing CLI integration tests still pass
