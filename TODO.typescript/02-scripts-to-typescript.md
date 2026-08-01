# 02 — Convert scripts/ to TypeScript

**Priority:** P0
**Status:** pending
**Depends on:** 01 (CLI types flow into scripts)
**Estimated effort:** large (30 files, ~5,400 lines)

## Context

`scripts/` contains 30 `.mjs`/`.js` files that form the concept-browser build pipeline. They are pure JS with zero types. The largest is `generate-data.mjs` (1,924 lines) which converts YAML concepts to JSON-LD static files. Others include `fetch-datasets.mjs`, `build-edges.js`, `doctor.mjs`, `validate-shacl.mjs`, etc.

`scripts/lib/` contains 14 helper modules (767 lines total) with `.d.ts` shadow files in `src/types/`.

## Migration strategy

### Phase A — scripts/lib/ (helpers, smallest first)
Convert each `scripts/lib/*.mjs` to `.ts`. Once converted, the corresponding `src/types/*.d.ts` shadow file becomes unnecessary (see TODO 10).

Files (by size, smallest first):
1. `lib/concept-groups.mjs` (16 lines)
2. `lib/bibliography.mjs` (18 lines)
3. `lib/first-non-empty.mjs` (19 lines)
4. `lib/version-turtle.mjs` (29 lines)
5. `lib/bibliography-turtle.mjs` (30 lines)
6. `lib/dataset-turtle.mjs` (33 lines)
7. `lib/agents-turtle.mjs` (33 lines)
8. `lib/build-activity-turtle.mjs` (26 lines)
9. `lib/vocab-turtle.mjs` (45 lines)
10. `lib/turtle-escape.mjs` (40 lines)
11. `lib/build-cache.mjs` (70 lines)
12. `lib/local-path-safety.mjs` (68 lines)
13. `lib/build/non-verbal-consumer.mjs`
14. `lib/build/image-assets.mjs`

### Phase B — small scripts
1. `generate-404.js` (15 lines) → `generate-404.ts`
2. `extract-source-refs.js` (32 lines) → `extract-source-refs.ts`
3. `check-syntax.mjs` (78 lines) → `check-syntax.ts`
4. `sync-concept-model.mjs` (87 lines) → `sync-concept-model.ts`
5. `normalize-yaml.mjs` (99 lines) → `normalize-yaml.ts`
6. `load-site-config.mjs` (115 lines) → `load-site-config.ts`

### Phase C — medium scripts
1. `bridge-to-astro.mjs` (154 lines) → `bridge-to-astro.ts`
2. `migrate-v1-to-v3.mjs` (176 lines) → `migrate-v1-to-v3.ts`
3. `generate-ontology-data.mjs` (184 lines) → `generate-ontology-data.ts`
4. `validate-shacl.mjs` (190 lines) → `validate-shacl.ts`
5. `process-about-pages.mjs` (193 lines) → `process-about-pages.ts`
6. `fetch-datasets.mjs` (210 lines) → `fetch-datasets.ts`
7. `doctor.mjs` (327 lines) → `doctor.ts`

### Phase D — large scripts
1. `build-edges.js` (574 lines) → `build-edges.ts`
2. `generate-ontology-schema.mjs` (617 lines) → `generate-ontology-schema.ts`
3. `generate-data.mjs` (1,924 lines) → `generate-data.ts` — **the big one**

## Pattern

For each file:
1. Rename `.mjs`/`.js` → `.ts`
2. Add types to all function signatures
3. Type all exports (interfaces for YAML config shapes, JSON-LD wire shapes, etc.)
4. Replace `/** @type {object} */` JSDoc annotations with proper TS types
5. Remove `as any` where possible; document where unavoidable
6. Update all cross-script imports to use `.ts` extensions (or extensionless with bundler resolution)
7. Update CLI dispatch (`cli/index.ts`) import paths

## Key design constraints

- **No new abstractions.** This is a 1:1 type annotation pass. Don't refactor logic.
- **DRY for shared types.** JSON-LD wire shapes (`gl:*` keys) should be shared via the existing `src/adapters/wire-keys.ts` + `src/adapters/model-bridge/jsonld-types.ts`.
- **MECE.** Each script has one concern. Types should reflect that boundary.
- **Performance.** The generate-data script processes thousands of concepts. Don't introduce runtime overhead (types are compile-time only, but avoid adding runtime validation that wasn't there before).

## Acceptance criteria

- [ ] All 30 scripts compile with strict TypeScript
- [ ] `npx tsc --noEmit` passes with scripts/ included
- [ ] `npm run build:full` produces the same output as before
- [ ] `npm test` passes (including scripts/__tests__/ — see TODO 12)
- [ ] No `@ts-nocheck` or `@ts-expect-error` directives
- [ ] Shared types (JSON-LD wire shapes, site-config) are centralized, not duplicated per script
