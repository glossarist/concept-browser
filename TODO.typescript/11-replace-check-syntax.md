# 11 — Replace check-syntax gate with tsc

**Priority:** P3
**Status:** pending (after TODO 02)
**Estimated effort:** small

## Context

`scripts/check-syntax.mjs` (78 lines) is a JS syntax linter that runs as a prebuild/pretest gate via `package.json`:
```json
"prebuild": "node scripts/check-syntax.mjs",
"pretest": "node scripts/check-syntax.mjs",
"check:scripts": "node scripts/check-syntax.mjs"
```

It parses every `.mjs`/`.js`/`.cjs` file under `scripts/` and `cli/` with `acorn`. Once those files are TypeScript (TODO 02), `tsc --noEmit` provides far better checking (syntax + types) and this script is obsolete.

## Scope

- Remove `scripts/check-syntax.mjs`
- Update `package.json`:
  - `"prebuild"` → `tsc --noEmit` (or remove if `build` already runs vue-tsc)
  - `"pretest"` → `tsc --noEmit` or remove
  - Remove `"check:scripts"` script entirely
- Ensure the CI pipeline still gates on type errors

## Acceptance criteria

- [ ] `scripts/check-syntax.mjs` deleted
- [ ] `package.json` updated
- [ ] CI still fails on syntax/type errors
