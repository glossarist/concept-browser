# TypeScript Migration — concept-browser

## Context

glossarist-js has completed a full TypeScript migration (154 `.ts` source files, strict mode, proper subpath exports for `./models`, `./rdf`, `./transforms`, `./validators`, `./diff`). concept-browser needs to:

1. **Adopt** the new TS-published glossarist library (replacing the JS 0.4.34 + local `glossarist-augment.d.ts` workaround).
2. **Become** a fully TypeScript project itself (scripts, CLI, and configs — `src/` is already 100% TS).

## Current state (2026-08-01)

| Surface | Status |
|---------|--------|
| `src/` (.vue + .ts) | **Already TS** — 248 `.ts` + 71 `.vue` files, strict mode |
| `src/adapters/non-verbal/glossarist-augment.d.ts` | **339-line workaround** — patches missing types in glossarist@0.4.34. Removable once on 0.4.50+ |
| `scripts/` | **JS only** — 30 `.mjs`/`.js` files, ~5,400 lines, zero types |
| `cli/index.mjs` | **JS only** — 257 lines, the CLI entrypoint |
| `scripts/__tests__/` | **JS only** — 7 `.mjs` test files |
| `src/types/*.d.ts` | 8 `.d.ts` files shadowing `scripts/lib/*.mjs` for TS test imports |
| `glossarist` dependency | Pinned at `^0.4.34` (JS source, stale d.ts) |
| `tsconfig.json` | `strict: true`, `allowJs: false`, scripts excluded |
| Build pipeline | `vue-tsc --noEmit` typechecks `src/` only; scripts bypass typecheck |

## Blocker: glossarist@0.4.50 packaging bug

The published glossarist@0.4.50 ships **pure `.ts` source** (154 files, 0 `.js` files) with `main: src/index.js` — a path that **does not exist** on disk. The package is **broken at runtime** for any consumer (Node `require()` and `import()` both fail).

The glossarist-js **repo** has the correct config (`main: dist/index.js`, `prepublishOnly: npm run build`), but this fix **has not been published**. Versions 0.4.35–0.4.50 all have the broken packaging.

**Impact:** TODOs 04–09 (adopt new glossarist) are **BLOCKED** until glossarist-js publishes a version with compiled `.js` output. TODOs 02–03, 10–20 (concept-browser's own TS migration) can proceed independently.

## TODO index

| # | Priority | Title | Status |
|---|----------|-------|--------|
| 01 | P0 | Convert CLI entrypoint to TypeScript | pending |
| 02 | P0 | Convert scripts/ to TypeScript (batch) | pending |
| 03 | P0 | Update tsconfig + package.json for TS scripts | pending |
| 04 | P1 | **[BLOCKED]** Upgrade glossarist to TS-published version | blocked |
| 05 | P1 | **[BLOCKED]** Remove glossarist-augment.d.ts | blocked |
| 06 | P1 | **[BLOCKED]** Update all glossarist imports for new subpath exports | blocked |
| 07 | P2 | **[BLOCKED]** Adopt glossarist/rdf to replace custom IR | blocked |
| 08 | P2 | **[BLOCKED]** Adopt glossarist/validators | blocked |
| 09 | P2 | **[BLOCKED]** Adopt glossarist/transforms (ConceptToGloss) | blocked |
| 10 | P3 | Remove src/types/*.d.ts shadows (post-scripts-TS) | pending |
| 11 | P3 | Replace check-syntax.mjs gate with tsc | pending |
| 12 | P3 | Convert scripts/__tests__/ to .test.ts | pending |
| 13 | P3 | Convert config files (astro.config, tailwind.config) | pending |
| 14 | P4 | Review and remove dead model-bridge/ split directory | pending |
| 15 | P4 | Centralize all glossarist-js type imports | pending |
