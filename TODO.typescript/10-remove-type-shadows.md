# 10 — Remove src/types/*.d.ts shadows

**Priority:** P3
**Status:** pending (after TODO 02)
**Estimated effort:** small

## Context

`src/types/` has 8 `.d.ts` files that shadow `scripts/lib/*.mjs` modules so TypeScript test files can import them with types:
- `bibliography-turtle.d.ts`
- `build-activity-turtle.d.ts`
- `build-cache.d.ts`
- `dataset-turtle.d.ts`
- `normalize-yaml.d.ts`
- `turtle-escape.d.ts`
- `vocab-turtle.d.ts`
- `agents-version-turtle.d.ts`

Once the corresponding `scripts/lib/*.mjs` files are converted to `.ts` (TODO 02, Phase A), these shadow declarations are redundant — the real types come from the `.ts` source.

## Scope

- Delete all 8 `.d.ts` files in `src/types/`
- Verify test imports resolve to the new `.ts` source types
- Remove `src/types/` from tsconfig `include` if empty

## Acceptance criteria

- [ ] All 8 shadow files deleted
- [ ] `vue-tsc --noEmit` passes
- [ ] No test file loses type coverage
