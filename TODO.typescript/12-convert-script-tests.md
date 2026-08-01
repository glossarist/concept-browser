# 12 — Convert scripts/__tests__/ to .test.ts

**Priority:** P3
**Status:** pending (after TODO 02)
**Estimated effort:** medium

## Context

`scripts/__tests__/` has 7 `.mjs` test files:
- `bibliography.test.mjs`
- `cli-script-contract.test.mjs`
- `concept-groups.test.mjs`
- `doctor.test.mjs`
- `fetch-datasets.test.mjs`
- `first-non-empty.test.mjs`
- `process-about-pages.test.mjs`

These test the JS scripts with Node's built-in test runner or vitest. Once the scripts are TS (TODO 02), the tests should also be TS for end-to-end type safety.

## Scope

- Rename each `.test.mjs` → `.test.ts`
- Add types to test fixtures and assertions
- Update imports from `../generate-data.mjs` → `../generate-data.ts` (or extensionless with bundler resolution)
- Ensure vitest picks them up (check `vite.config.ts` test include pattern)

## Acceptance criteria

- [ ] All 7 test files converted to `.test.ts`
- [ ] `npm test` runs both `src/__tests__/` and `scripts/__tests__/`
- [ ] No `.mjs` test files remain
